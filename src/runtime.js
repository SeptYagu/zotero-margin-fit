/* global MarginFitCore */
"use strict";
var MarginFitRuntime = (() => {
  const C = MarginFitCore;
  const ID = "marginfit@septyagu.local";
  const PREF = "extensions.marginfit.enabled";
  const MODE = "extensions.marginfit.mode";
  // Awaiting a content-compartment Promise can reintroduce Firefox Xray wrappers.
  const unwrap = value => value?.wrappedJSObject || value;
  const alive = value => !!value && (typeof Components === "undefined" || !Components.utils.isDeadWrapper(value));
  function into(win, values) {
    // Native JS methods in the content compartment cannot read chrome-realm expandos.
    const object = unwrap(new (unwrap(win).Object)());
    for (const [key,value] of Object.entries(values)) object[key] = value;
    return object;
  }
  class Controller {
    constructor(view, session, host) {
      this.view = view; this.session = session; this.host = host;
      this.app = view._iframeWindow.PDFViewerApplication;
      this.document = this.app.pdfDocument;
      this.viewer = this.app.pdfViewer;
      this.win = view._iframeWindow;
      this.container = this.viewer.container;
      this.mode = host.mode(); this.anchor = this.viewer.currentScale;
      this.epoch = 0; this.lastInput = host.now(); this.lastPage = this.viewer.currentPageNumber;
      this.closed = false; this.muted = false; this.manual = false;
      this.appliedEpoch = -1; this.restores = []; this.listeners = [];
      this.prefetchedEpoch = -1; this.refiningEpoch = null;
      this.inputFlushTimer = null;
      this.session.setEnabled(host.enabled());
      this.metrics = { writes: [], fallback: 0 };
      const width = view.zoomPageWidth, height = view.zoomPageHeight, stats = view._onChangeViewStats;
      this.restores.push(C.hook(view, "zoomPageWidth", () => {
        if (!host.enabled()) { this.mode = "width"; host.setMode("width"); return width.call(view); }
        return this.request("width");
      }));
      this.restores.push(C.hook(view, "zoomPageHeight", () => {
        if (!host.enabled()) { this.mode = "height"; host.setMode("height"); return height.call(view); }
        return this.request("height");
      }));
      this.restores.push(C.hook(view, "_onChangeViewStats", data => stats.call(view,
        host.enabled() ? into(this.win,{ ...data, canZoomReset: true }) : data)));
      this.listen(this.container, "scroll", () => { if (!this.muted) this.input(); });
      this.listen(this.container, "wheel", () => this.input(), { passive: true });
      this.listen(this.container, "touchmove", () => this.input(), { passive: true });
      this.listen(this.win, "pointerdown", () => { this.dragging = true; this.input(); }, true);
      this.listen(this.win, "pointerup", () => { this.dragging = false; this.arm(); }, true);
      this.listen(this.win, "pointercancel", () => { this.dragging = false; this.arm(); }, true);
      this.listen(this.win, "keydown", event => {
        if (["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "PageDown", "PageUp", "Home", "End", " "].includes(event.key)) this.input();
      }, true);
      this.bus("scalechanging", () => {
        if (this.muted) return;
        this.anchor = this.viewer.currentScale;
        this.manual = true; this.epoch++; this.cancelTimer();
      });
      this.bus("rotationchanging", () => { this.manual = false; this.input(); });
      this.bus("pagechanging", () => { if (!this.muted) this.input(); });
      if (this.win.ResizeObserver) {
        this.size = [this.container.clientWidth,this.container.clientHeight];
        this.resize = new this.win.ResizeObserver(() => {
          const size = [this.container.clientWidth,this.container.clientHeight];
          if (size.every((value,i) => value === this.size[i])) return;
          this.size = size;
          if (this.muted) return;
          this.anchor = this.viewer.currentScale;
          this.manual = false; this.input();
        });
        this.resize.observe(this.container);
      }
      this.view._updateViewStats();
      this.listen(this.win,"unload",() => this.close(true));
      this.begin();
    }
    listen(object, type, fn, options) {
      object.addEventListener(type, fn, options);
      this.listeners.push(() => object.removeEventListener(type, fn, options));
    }
    bus(type, fn) {
      this.app.eventBus.on(type, fn);
      this.listeners.push(() => this.app.eventBus.off(type, fn));
    }
    cancelTimer() { this.host.clearTimeout(this.timer); this.timer = null; }
    page() {
      if (this.closed || !alive(this.container)) return this.lastPage;
      const root = this.container.getBoundingClientRect();
      const visible = [];
      // Native visible-page calculation avoids an O(book length) DOM walk.
      const entries = this.viewer._getVisiblePages?.().views || [];
      for (const { id, view } of entries) {
        const r = view.div.getBoundingClientRect();
        const w = Math.max(0, Math.min(r.right,root.right)-Math.max(r.left,root.left));
        const h = Math.max(0, Math.min(r.bottom,root.bottom)-Math.max(r.top,root.top));
        if (w*h) visible.push({ id, area: w*h });
      }
      return C.primaryPage(visible, this.lastPage, this.viewer.currentPageNumber);
    }
    input() {
      if (this.closed) return;
      this.muted = false;
      this.epoch++; this.lastInput = this.host.now();
      this.cancelTimer();
      // Wheel and native scroll events often describe the same movement. Invalidate
      // pending work immediately, but only inspect page geometry once per short window.
      if (!this.host.enabled()) return;
      this.session.noteActivity?.(this.lastInput);
      if (this.inputFlushTimer) return;
      this.inputFlushTimer = this.host.setTimeout(() => {
        this.inputFlushTimer = null;
        if (this.closed || !this.host.enabled()) return;
        const p = this.page();
        if (p !== this.lastPage) this.manual = false;
        this.lastPage = p;
        this.arm();
      }, 75);
    }
    arm() {
      this.cancelTimer();
      if (!this.closed && this.host.enabled() && !this.manual)
        this.timer = this.host.setTimeout(() => this.refine(), C.IDLE_MS);
    }
    stable(token, p) {
      return !this.closed && this.host.enabled() && !this.dragging && !this.manual &&
        alive(this.app) && alive(this.view) && alive(this.container) &&
        this.document === this.app.pdfDocument &&
        this.epoch === token && this.page() === p && this.host.now()-this.lastInput >= C.IDLE_MS;
    }
    async begin() {
      if (this.closed || !this.host.enabled()) return;
      const token = this.epoch;
      try {
        const modelsReady = await this.session.l1();
        if (!modelsReady) { this.arm(); return; }
        if (!this.closed && this.host.enabled() && token === this.epoch && !this.dragging && !this.manual) {
          const p = this.page();
          const vp = unwrap(this.viewer.getPageView(p-1).viewport.clone(into(this.win,{ scale: 1 })));
          const cached = this.session.cache.get(p);
          const models = this.session.modelRotation === (this.viewer.pagesRotation || 0)
            ? this.session.models : { 0: [0,0,1,1], 1: [0,0,1,1] };
          const r = cached?.rotation === vp.rotation ? cached : C.prediction(models, p, vp.width, vp.height, vp.rotation);
          if (r.quality === "fallback") this.fallback(r.reason);
          else await this.apply(r, p, token, false, true);
        }
        if (this.host.now()-this.lastInput >= C.IDLE_MS) this.refine();
        else this.arm();
      } catch (error) { this.failure(error); }
    }
    async refine() {
      const token = this.epoch, p = this.page();
      if (!this.stable(token, p) || this.prefetchedEpoch === token || this.refiningEpoch === token) {
        if (this.dragging) this.arm(); return;
      }
      this.refiningEpoch = token;
      this.lastPage = p;
      const rotation = this.viewer.getPageView(p-1).viewport.rotation;
      try {
        await this.session.local(p, rotation, () => this.stable(token, p), async record => {
          if (!this.stable(token,p) || this.appliedEpoch === token) return;
          this.appliedEpoch = token;
          if (record.quality !== "reliable") { this.fallback(record.reason); return; }
          await this.apply(record, p, token);
        });
        if (this.stable(token,p)) this.prefetchedEpoch = token;
      } catch (error) { this.failure(error); }
      finally { if (this.refiningEpoch === token) this.refiningEpoch = null; }
    }
    async request(mode) {
      this.mode = mode; this.host.setMode(mode);
      this.manual = false; this.epoch++; this.cancelTimer();
      this.anchor = this.viewer.currentScale;
      const token = this.epoch, p = this.page();
      // Explicit Fit commands bypass the background scrolling cooldown;
      // the L1-before-L2 ordering still applies.
      this.session.allowExplicitRequest?.();
      try {
        if (!await this.session.l1()) { this.arm(); return; }
        const rotation = this.viewer.getPageView(p-1).viewport.rotation;
        const record = await this.session.serial(() => {
          if (this.closed || !this.host.enabled() || token !== this.epoch) return null;
          return this.session.read(p, rotation);
        });
        if (!record || this.closed || token !== this.epoch || !this.host.enabled()) return;
        if (record.quality !== "reliable") this.fallback(record.reason);
        else await this.apply(record, p, token, true);
        if (this.closed || token !== this.epoch || !this.host.enabled()) return;
        this.appliedEpoch = token;
        this.arm();
      } catch (error) { this.failure(error); }
    }
    failure(error) {
      if (this.closed || /dead object/i.test(String(error))) this.close(true);
      else this.host.error(error);
    }
    fallback(reason) {
      this.metrics.fallback++;
      this.host.status(this.view, reason || "unreliable");
    }
    async apply(record, p, token, explicit = false, initial = false) {
      const valid = () => !this.closed && this.host.enabled() && token === this.epoch &&
        alive(this.app) && alive(this.container) &&
        this.document === this.app.pdfDocument &&
        (explicit || (!this.dragging && !this.manual &&
          (initial || this.host.now()-this.lastInput >= C.IDLE_MS)));
      if (!valid() || (!explicit && !initial && !this.stable(token,p))) return;
      // PDF.js currentScale excludes its 96/72 CSS conversion; viewport.scale includes it.
      const unitScale = this.viewer.getPageView(p-1).viewport.scale / this.viewer.currentScale;
      const fitting = C.fitPageRecord(record, this.session.folioPattern, p);
      const decision = C.scaleDecision(fitting, this.mode,
        { width: Math.max(1,this.container.clientWidth-16)/unitScale, height: Math.max(1,this.container.clientHeight-16)/unitScale },
        this.viewer.currentScale, this.anchor, explicit);
      const currentPage = this.viewer.getPageView(p-1);
      const before = currentPage.div.getBoundingClientRect();
      const root = this.container.getBoundingClientRect();
      // A center in the page gap belongs to neither page: analyze/cache, but do not snap the view.
      const centerY = (root.top+root.bottom)/2;
      if (!explicit && (centerY < before.top || centerY > before.bottom)) return;
      // Preserve the restored/current PDF coordinate, including blank page margins.
      const anchorY = (centerY-before.top) / (this.viewer.currentScale*unitScale);
      let scaled = false;
      this.muted = true;
      try {
        if (decision.change && Math.abs(decision.scale-this.viewer.currentScale)>1e-6) {
          this.viewer.currentScaleValue = decision.scale;
          this.anchor = this.viewer.currentScale;
          scaled = true;
          this.metrics.writes.push({ type: "scale", page: p, value: this.anchor, explicit, time: this.host.now() });
        }
        // Native zoom synchronously updates page viewports; allow layout one frame to catch up.
        await new Promise(resolve => this.host.setTimeout(resolve, 0));
        if (!valid()) return;
        const page = this.viewer.getPageView(p-1);
        const r = page.div.getBoundingClientRect();
        const scale = this.viewer.currentScale*unitScale;
        const box = decision.safe;
        const left = this.container.scrollLeft + r.left-root.left;
        const top = this.container.scrollTop + r.top-root.top;
        const x = left + (box[0]+box[2])*scale/2 - this.container.clientWidth/2;
        this.container.scrollLeft = Math.max(0,x);
        // At unchanged scale leave scrollTop completely untouched (including subpixel rounding).
        // Only an explicit fit aligns content; automatic zoom compensates to retain the reading anchor.
        if (explicit || scaled) {
          const y = explicit ? (this.mode === "height"
            ? top + (box[1]+box[3])*scale/2 - this.container.clientHeight/2
            : top + box[1]*scale - 8)
            : top + anchorY*scale - (centerY-root.top);
          this.container.scrollTop = Math.max(0,y);
        }
        this.lastPage = p;
        this.metrics.writes.push({ type: "position", page: p, x: this.container.scrollLeft,
          y: this.container.scrollTop, verticalWritten: explicit || scaled, explicit, time: this.host.now() });
        this.host.status(this.view, null);
        // Scroll events from our own writes arrive in the next animation frame.
        await new Promise(resolve => this.host.setTimeout(resolve, 50));
      } finally { if (token === this.epoch) this.muted = false; }
    }
    toggle() {
      if (this.closed) return;
      this.epoch++; this.cancelTimer(); this.manual = false; this.muted = false;
      this.host.clearTimeout(this.inputFlushTimer); this.inputFlushTimer = null;
      this.session.setEnabled(this.host.enabled());
      this.anchor = this.viewer.currentScale;
      this.view._updateViewStats();
      if (this.host.enabled()) this.begin();
    }
    close(unloading = false) {
      if (this.closed) return;
      this.closed = true; this.epoch++; this.cancelTimer();
      this.host.clearTimeout(this.inputFlushTimer); this.inputFlushTimer = null;
      try { this.resize?.disconnect(); } catch (_) { /* frame already destroyed */ }
      for (const remove of this.listeners) try { remove(); } catch (_) { /* dead event target */ }
      for (const restore of this.restores.reverse()) try { restore(); } catch (_) { /* dead view */ }
      if (!unloading) try { if (!this.view._destroyed) this.view._updateViewStats(); } catch (_) { /* dead view */ }
    }
  }
  async function detect(app, win, p, rotation) {
    const start = Date.now();
    const page = unwrap(await app.pdfDocument.getPage(p));
    const viewerRotation = app.pdfViewer.pagesRotation || 0;
    const viewport = unwrap(page.getViewport(into(win,{ scale: 1, rotation: rotation ?? (page.rotate+viewerRotation)%360 })));
    let canvas;
    try {
      const content = unwrap(await page.getTextContent());
      const folioAnalysis = C.textAndFolio(content,viewport);
      const text = folioAnalysis.all;
      // A strict PDF.js operator allowlist forbids graphics, scans and unknown paint ops.
      // Only then can the cheap text geometry replace offscreen rasterization.
      if (text) {
        try {
          const ops = unwrap(win.pdfjsLib)?.OPS || unwrap(app.pdfjsLib)?.OPS;
          const instructions = unwrap(await page.getOperatorList());
          if (C.isTextOnlyOps(instructions,ops,text)) {
            // Annotation appearances may extend beyond text; a non-empty list is unsafe
            // for a text-only crop, even when the underlying page operations are text.
            const annotations=unwrap(await page.getAnnotations(into(win,{intent:'display'})));
            if (Array.isArray(annotations) && annotations.length === 0)
              return {raw:text,width:viewport.width,height:viewport.height,rotation:viewport.rotation,
                viewerRotation,quality:'reliable',version:C.VERSION,fastPath:true,
                folio:folioAnalysis.folio,
                revision:app.pdfDocument.fingerprints?.join(':'),elapsedMs:Date.now()-start,rasterBytes:0};
          }
        } catch (_) { /* No reliable operator list: use the existing raster detector. */ }
      }
      const factor = Math.min(1, 800 / Math.max(viewport.width,viewport.height));
      const low = unwrap(viewport.clone(into(win,{ scale: factor })));
      canvas = win.document.createElement("canvas");
      canvas.width = Math.ceil(low.width); canvas.height = Math.ceil(low.height);
      const context = unwrap(canvas.getContext("2d", { willReadFrequently: true }));
      // Zotero's PDF.js fork otherwise applies window.theme to offscreen renders too.
      context.skipBlender = true;
      context.fillStyle = "rgb(255,255,255)";
      context.fillRect(0,0,canvas.width,canvas.height);
      await unwrap(page.render(into(win,{ canvasContext: context, viewport: low, background: "rgb(255,255,255)" }))).promise;
      const pixels = context.getImageData(0,0,canvas.width,canvas.height);
      // Copy once into the chrome realm instead of paying cross-compartment costs per pixel.
      const rgba = Components.utils.cloneInto(pixels.data,{});
      const ink = C.inkBox({ width: pixels.width, height: pixels.height, data: rgba });
      const raster = ink.box?.map(n => n/factor);
      const merged = C.union(text,raster);
      const raw = ink.quality === "reliable" ? [C.clamp(merged[0],0,viewport.width),C.clamp(merged[1],0,viewport.height),
        C.clamp(merged[2],0,viewport.width),C.clamp(merged[3],0,viewport.height)] : [0,0,viewport.width,viewport.height];
      return { raw, width: viewport.width, height: viewport.height, rotation: viewport.rotation,
        quality: ink.quality, reason: ink.reason, version: C.VERSION, viewerRotation, revision: app.pdfDocument.fingerprints?.join(":"), elapsedMs: Date.now()-start,
        rasterBytes: canvas.width*canvas.height*4, copiedRasterBytes: rgba.byteLength };
    } catch (error) {
      return { raw: [0,0,viewport.width,viewport.height], width: viewport.width, height: viewport.height,
        rotation: viewport.rotation, quality: "fallback", reason: "render-failed", detail: String(error), version: C.VERSION };
    } finally { if (canvas) { canvas.width = 0; canvas.height = 0; } }
  }
  class Plugin {
    constructor({ Zotero, Services, timers, cacheModule }) {
      this.Zotero = Zotero; this.Services = Services; this.timers = timers;
      this.cacheModule = cacheModule;
      this.cacheIO = null;
      try {
        // IOUtils/PathUtils are privileged window globals on Zotero 10, not
        // guaranteed to be exported by a resource://gre/modules ESM.
        const chromeWindow = Zotero.getMainWindows()[0];
        const IOUtils = chromeWindow?.IOUtils;
        const PathUtils = chromeWindow?.PathUtils;
        if (IOUtils && PathUtils) this.cacheIO = { IOUtils, PathUtils };
      } catch (_) { /* Keep the plugin functional if profile cache APIs are unavailable. */ }
      this.controllers = new Map(); this.sessions = new Map(); this.toolbars = new Map();
      this.pending = new Set(); this.active = false;
      this.render = event => this.toolbar(event);
      this.observer = { observe: () => {
        for (const c of this.controllers.values()) c.toggle();
        this.updateButtons();
      } };
    }
    enabled() { return this.Services.prefs.getBoolPref(PREF, true); }
    mode() { return this.Services.prefs.getStringPref(MODE, "width") === "height" ? "height" : "width"; }
    setMode(mode) { this.Services.prefs.setStringPref(MODE, mode); }
    now() { return Date.now(); }
    setTimeout(fn,ms) { return this.timers.setTimeout(fn,ms); }
    clearTimeout(timer) { if (timer) this.timers.clearTimeout(timer); }
    error(error) { this.Zotero.logError(new Error(`MarginFit: ${error}`)); }
    async start() {
      this.active = true;
      this.Zotero.Reader.registerEventListener("renderToolbar",this.render,ID);
      this.Services.prefs.addObserver(PREF,this.observer);
      // A short discovery timer covers existing tabs, split panes, and detached reader windows.
      this.poll = this.timers.setInterval(() => this.discover(),500);
      this.discover();
    }
    discover() {
      if (!this.active) return;
      const live = new Set();
      for (const reader of this.Zotero.Reader._readers || []) {
        try {
        if (reader.type !== "pdf" && reader._type !== "pdf") continue;
        const internal = reader._internalReader;
        for (const view of [internal?._primaryView,internal?._secondaryView].filter(Boolean)) {
          if (!alive(view) || view._destroyed) continue;
          live.add(view);
          const existing = this.controllers.get(view);
          if (existing && existing.document !== existing.app.pdfDocument) {
            existing.close(); this.controllers.delete(view);
          }
          if (!this.controllers.has(view) && !this.pending.has(view)) this.attach(view);
        }
        if (!this.toolbars.has(reader) && reader._iframeWindow?.document)
          this.toolbar({ reader, doc: reader._iframeWindow.document });
        } catch (_) { /* A detached window can be destroyed between discovery ticks. */ }
      }
      for (const [view,c] of this.controllers) if (c.closed || !live.has(view) || !alive(view) || !alive(c.app)) {
        c.close(true); this.controllers.delete(view);
      }
      for (const [key,session] of this.sessions) if (![...this.controllers.values()].some(c => c.session === session)) {
        session.close(); this.sessions.delete(key);
      }
      for (const [reader,bar] of this.toolbars) if (!this.Zotero.Reader._readers.includes(reader)) {
        try { bar.remove(); } catch (_) { /* dead toolbar document */ }
        this.toolbars.delete(reader);
      }
    }
    async attach(view) {
      this.pending.add(view);
      try {
        await view.initializedPromise;
        // Let the native restoration's queued scroll/layout events settle before observing input.
        await new Promise(resolve => this.setTimeout(resolve,100));
        if (!this.active || view._destroyed || this.controllers.has(view)) return;
        const app = view._iframeWindow?.PDFViewerApplication;
        if (!app?.pdfDocument || !app.pdfViewer?.container) return;
        // Share only a live PDFDocumentProxy. A reopened/revised file gets a fresh cache,
        // and closing one window cannot invalidate another proxy's detector.
        const key = app.pdfDocument;
        let session = this.sessions.get(key);
        if (!session) {
          let store = null;
          if (this.cacheIO && this.cacheModule) {
            const {IOUtils,PathUtils}=this.cacheIO;
            let fileStamp=null;
            try {
              const reader=this.Zotero.Reader._readers.find(r =>
                [r._internalReader?._primaryView,r._internalReader?._secondaryView].includes(view));
              const itemID=reader?._itemID ?? reader?.itemID;
              if (Number.isSafeInteger(itemID)) {
                const filePath=await this.Zotero.Items.get(itemID)?.getFilePathAsync?.();
                if (filePath) {
                  const stat=await IOUtils.stat(filePath);
                  if (Number.isSafeInteger(stat.size) && Number.isFinite(stat.lastModified) && stat.lastModified >= 0)
                    fileStamp=stat.size+'-'+Math.floor(stat.lastModified);
                }
              }
            } catch (_) { /* Non-file readers can fall back to the PDF fingerprint. */ }
            if (!this.active || view._destroyed || app.pdfDocument !== key) return;
            store = new this.cacheModule.Store({io:IOUtils,path:PathUtils,timers:this.timers,
              fingerprints:app.pdfDocument.fingerprints,count:app.pdfDocument.numPages,
              fileStamp,version:C.VERSION});
          }
          session = new C.Session(app.pdfDocument.numPages, (p,r) => detect(app,view._iframeWindow,p,r),store);
          this.sessions.set(key,session);
        }
        this.controllers.set(view,new Controller(view,session,this));
      } catch (error) { if (!/dead object/i.test(String(error))) this.error(error); }
      finally { this.pending.delete(view); }
    }
    strings() {
      return { height: "Fit Height / 适合高度", detect: "Detect Margins / 识别边界" };
    }
    detectTitle(fallback = false) {
      const state = this.enabled() ? ["On", "开启"] : ["Off", "关闭"];
      return `Detect Margins: ${state[0]}${fallback ? " — Uncertain page boundaries; keeping the current view" : ""}` +
        ` / 识别边界：${state[1]}${fallback ? " — 无法可靠识别，保留当前视图" : ""}`;
    }
    toolbar({ reader,doc,append }) {
      if (!this.active || (reader.type !== "pdf" && reader._type !== "pdf")) return;
      const old = this.toolbars.get(reader);
      try { if (old?.isConnected) return; old?.remove(); } catch (_) { /* previous iframe is dead */ }
      const bar = doc.createElement("span");
      bar.className = "marginfit-toolbar";
      const style = doc.createElement("style");
      style.textContent = `.marginfit-toolbar {display:inline-flex;align-items:center;gap:2px;margin-inline:4px;-moz-window-dragging:no-drag}
        .marginfit-toolbar button {font:inherit;color:inherit;border:0;background:transparent;cursor:pointer;min-width:28px;height:28px;border-radius:4px;padding:4px;-moz-window-dragging:no-drag}
        .marginfit-toolbar button:hover {background:color-mix(in srgb,currentColor 12%,transparent)}
        .marginfit-toolbar button[aria-pressed=true] {background:color-mix(in srgb,Highlight 22%,transparent)}
        .marginfit-toolbar button:focus-visible {outline:2px solid Highlight;outline-offset:1px}
        .marginfit-toolbar svg {display:block;width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.5;pointer-events:none}`;
      const button = (name,path) => {
        const el = doc.createElement("button"); el.type = "button"; el.dataset.marginfit = name;
        el.className = "toolbar-button";
        const svg = doc.createElementNS("http://www.w3.org/2000/svg","svg");
        svg.setAttribute("viewBox","0 0 24 24"); svg.setAttribute("aria-hidden","true");
        const line = doc.createElementNS(svg.namespaceURI,"path"); line.setAttribute("d",path);
        svg.append(line); el.append(svg); return el;
      };
      const height = button("height","M5 3h14M5 21h14M12 5v14M8 9l4-4 4 4M8 15l4 4 4-4");
      const toggle = button("detect","M3 8V3h5M16 3h5v5M21 16v5h-5M8 21H3v-5M7 7h10v10H7z");
      height.addEventListener("click", () => reader._internalReader?.zoomPageHeight());
      toggle.addEventListener("click", () => this.Services.prefs.setBoolPref(PREF,!this.enabled()));
      bar.append(style,height,toggle);
      if (append) append(bar);
      else {
        const original = doc.getElementById("zoomAuto");
        if (!original?.parentNode) return;
        original.after(bar);
      }
      this.toolbars.set(reader,bar);
      this.updateButtons(); this.discoverViews(reader);
    }
    discoverViews(reader) {
      for (const view of [reader._internalReader?._primaryView,reader._internalReader?._secondaryView].filter(Boolean))
        if (!this.pending.has(view) && !this.controllers.has(view)) this.attach(view);
    }
    updateButtons() {
      const t = this.strings();
      for (const bar of this.toolbars.values()) {
        try {
        const height = bar.querySelector('[data-marginfit="height"]');
        const toggle = bar.querySelector('[data-marginfit="detect"]');
        height.title = t.height;
        height.setAttribute("aria-label",t.height);
        toggle.title = this.detectTitle();
        toggle.setAttribute("aria-label",t.detect);
        toggle.setAttribute("aria-pressed",String(this.enabled()));
        } catch (_) { /* closed iframe; discovery will remove this entry */ }
      }
    }
    status(view,reason) {
      for (const [reader,bar] of this.toolbars) {
        try {
        if (![reader._internalReader?._primaryView,reader._internalReader?._secondaryView].includes(view)) continue;
        const toggle = bar.querySelector('[data-marginfit="detect"]');
        toggle.title = this.detectTitle(!!reason);
        toggle.dataset.status = reason ? "fallback" : "ready";
        } catch (_) { /* closed iframe */ }
      }
    }
    stop() {
      this.active = false;
      this.timers.clearInterval(this.poll);
      this.Services.prefs.removeObserver(PREF,this.observer);
      this.Zotero.Reader.unregisterEventListener("renderToolbar",this.render);
      for (const c of this.controllers.values()) c.close();
      for (const s of this.sessions.values()) s.close();
      for (const b of this.toolbars.values()) try { b.remove(); } catch (_) { /* closed reader */ }
      this.controllers.clear(); this.sessions.clear(); this.toolbars.clear();
    }
  }
  return { Plugin, Controller, detect, PREF, MODE, ID };
})();
if (typeof module !== "undefined") module.exports = MarginFitRuntime;
