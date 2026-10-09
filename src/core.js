/* Shared pure geometry and serial detection scheduler; no Zotero dependency. */
"use strict";
var MarginFitCore = (() => {
  const VERSION = 3; // P1-C: versioned page-number candidate metadata; 0.1.4 caches invalidate.
  // PDF.js scale=1 viewport units (1/72 inch), applied only at display time.
  const SAFETY = 8;
  const IDLE_MS = 500;
  const DEAD_ZONE = 0.05;
  const MAX_SCALE = 5;
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  function union(a, b) {
    if (!a) return b && [...b];
    if (!b) return [...a];
    return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
  }
  function safeBox(raw, width, height) {
    return [clamp(raw[0] - SAFETY, 0, width), clamp(raw[1] - SAFETY, 0, height),
      clamp(raw[2] + SAFETY, 0, width), clamp(raw[3] + SAFETY, 0, height)];
  }
  function samples(count) {
    const result = [];
    for (const fraction of [0.25, 0.5, 0.75]) {
      const p = clamp(Math.round(count * fraction), 1, count);
      const odd = p % 2 ? p : p - 1;
      for (const n of [odd, odd + 1]) if (n >= 1 && n <= count && !result.includes(n)) result.push(n);
    }
    return result;
  }
  function neighbors(p, count) {
    return [p, p + 1, p + 2, p + 3, p - 1, p - 2, p - 3].filter(n => n >= 1 && n <= count);
  }
  function parityModels(cache, pages) {
    const models = {};
    for (const parity of [0, 1]) {
      let box = null;
      for (const p of pages.filter(n => n % 2 === parity)) {
        const r = cache.get(p);
        const normalized = r?.quality === "reliable"
          ? [r.raw[0] / r.width, r.raw[1] / r.height, r.raw[2] / r.width, r.raw[3] / r.height]
          : [0, 0, 1, 1];
        box = union(box, normalized);
      }
      models[parity] = box || [0, 0, 1, 1];
    }
    return models;
  }
  function prediction(models, p, width, height, rotation) {
    const b = models[p % 2];
    return { raw: [b[0] * width, b[1] * height, b[2] * width, b[3] * height], width, height,
      rotation, quality: "prediction", version: VERSION };
  }
  function multiply(a, b) {
    return [a[0]*b[0]+a[2]*b[1], a[1]*b[0]+a[3]*b[1], a[0]*b[2]+a[2]*b[3],
      a[1]*b[2]+a[3]*b[3], a[0]*b[4]+a[2]*b[5]+a[4], a[1]*b[4]+a[3]*b[5]+a[5]];
  }
  function textBox(content, viewport, visit = null) {
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    for (const item of content.items || []) {
      if (!item.str?.trim() || !item.transform) continue;
      const t = multiply(viewport.transform, item.transform);
      const length = Math.hypot(t[0], t[1]);
      const h = Math.hypot(t[2], t[3]);
      if (!length || !h) continue;
      const style = content.styles?.[item.fontName] || {};
      const ascent = Number.isFinite(style.ascent) ? style.ascent : 1;
      const descent = Number.isFinite(style.descent) ? style.descent : -0.3;
      // Preserve exactly the same four glyph-corner transforms, without arrays.
      const ux = t[0] / length, uy = t[1] / length;
      const vx = t[2] / h, vy = t[3] / h;
      const advance = Math.abs(item.width * viewport.scale);
      const ax = ux * advance, ay = uy * advance;
      const dx = vx * (descent * h), dy = vy * (descent * h);
      const bx = vx * (ascent * h), by = vy * (ascent * h);
      const x0 = t[4] + dx, x1 = t[4] + dx + ax;
      const x2 = t[4] + bx, x3 = t[4] + bx + ax;
      const y0 = t[5] + dy, y1 = t[5] + dy + ay;
      const y2 = t[5] + by, y3 = t[5] + by + ay;
      const l = Math.min(x0,x1,x2,x3), r = Math.max(x0,x1,x2,x3);
      const a = Math.min(y0,y1,y2,y3), b = Math.max(y0,y1,y2,y3);
      if (l < left) left = l;
      if (a < top) top = a;
      if (r > right) right = r;
      if (b > bottom) bottom = b;
      // P1-C may gather a small set of edge candidates during this same pass.
      if (visit) visit(item,l,a,r,b);
    }
    return left === Infinity ? null : [clamp(left,0,viewport.width), clamp(top,0,viewport.height),
      clamp(right,0,viewport.width), clamp(bottom,0,viewport.height)];
  }
  // Identify a folio candidate during the existing text-bbox traversal.
  // Pure-text mode only: a number at the edge is not sufficient on its own.
  function textAndFolio(content, viewport) {
    let bodyLeft=Infinity,bodyTop=Infinity,bodyRight=-Infinity,bodyBottom=-Infinity;
    let candidate = null, candidates = 0;
    const all = textBox(content, viewport, (item,l,t,r,b) => {
      const text = item.str.trim();
      const h = viewport.height, w = viewport.width;
      const upper = t >= 0 && b < h * .105;
      const lower = b <= h && t > h * .895;
      const short = b-t > 0 && b-t < h*.035 && r-l > 0 && r-l < w*.22;
      let ordinal = null;
      if (short && (upper || lower)) {
        if (/^\d{1,4}$/.test(text)) ordinal = Number(text);
        else if (/^[IVXLCDM]{1,8}$/i.test(text)) {
          const values = {I:1,V:5,X:10,L:50,C:100,D:500,M:1000};
          let total = 0, previous = 0;
          for (let i=text.length-1;i>=0;i--) {
            const v=values[text[i].toUpperCase()];
            total+=v<previous?-v:v;previous=v;
          }
          if (total>0 && total<4000) ordinal=total;
        }
      }
      if (ordinal !== null) {
        candidates++;
        if (candidates === 1) candidate = {box:[l,t,r,b],ordinal,edge:upper?'top':'bottom'};
      } else {
        if(l<bodyLeft)bodyLeft=l;
        if(t<bodyTop)bodyTop=t;
        if(r>bodyRight)bodyRight=r;
        if(b>bodyBottom)bodyBottom=b;
      }
    });
    if (!all || bodyLeft===Infinity || candidates !== 1 || !candidate) return {all,folio:null};
    const body=[bodyLeft,bodyTop,bodyRight,bodyBottom];
    const b = candidate.box;
    const gap = candidate.edge === 'top' ? body[1]-b[3] : b[1]-body[3];
    // A freestanding number requires whitespace from every other text glyph.
    if (gap < Math.max(12,viewport.height*.025)) return {all,folio:null};
    return {all,folio:{...candidate,body}};
  }
  function folioPattern(pages, cache) {
    const votes=new Map();
    for (const p of pages) {
      const r=cache.get(p),f=r?.folio;
      if (!r || !r.fastPath || r.quality!=='reliable' || !f) continue;
      const offset=f.ordinal-p,key=f.edge+':'+offset;
      let v=votes.get(key);
      if(!v){v={edge:f.edge,offset,positions:[],pages:[]};votes.set(key,v);}
      v.positions.push((f.box[1]+f.box[3])/(2*r.height));
      v.pages.push(p);
    }
    for (const candidate of votes.values()) {
      if (candidate.pages.length < 4) continue;
      const positions=candidate.positions,mean=positions.reduce((a,b)=>a+b,0)/positions.length;
      if (!positions.every(n=>Math.abs(n-mean)<.035)) continue;
      return {edge:candidate.edge,offset:candidate.offset,relativeY:mean,samples:candidate.pages.length};
    }
    return null;
  }
  function fitPageRecord(record,pattern,p) {
    const f=record?.folio;
    if (!pattern || !f || !record.fastPath || record.quality!=='reliable' ||
      f.edge!==pattern.edge || f.ordinal-p!==pattern.offset ||
      Math.abs((f.box[1]+f.box[3])/(2*record.height)-pattern.relativeY)>.035)
      return record;
    // Original raw remains full-content bounds; only the fitting calculation changes.
    return {...record,raw:f.body,fullRaw:record.raw,folioExcluded:true};
  }
  // Deny by default: a single graphic/image/shading/unknown operation requires raster analysis.
  const TEXT_OPS = new Set(["dependency","save","restore","transform","beginText","endText",
    "setFont","setCharSpacing","setWordSpacing","setHScale","setLeading","setTextRise",
    "moveText","setLeadingMoveText","setTextMatrix","nextLine","showText",
    "showSpacedText","nextLineShowText","nextLineSetSpacingShowText",
    "setFillRGBColor","setFillGray","setFillCMYKColor","setFillColor","setFillColorN",
    "setFillColorSpace","setStrokeRGBColor","setStrokeGray"]);
  function isTextOnlyOps(list, ops, box) {
    if (!ops || !list?.fnArray?.length || !box || !box.every(Number.isFinite) ||
        box[2]-box[0] < 2 || box[3]-box[1] < 2) return false;
    const safeCodes = new Set([...TEXT_OPS].map(n => ops[n]).filter(Number.isInteger));
    const showCodes = new Set([ops.showText,ops.showSpacedText,ops.nextLineShowText,
      ops.nextLineSetSpacingShowText].filter(Number.isInteger));
    let glyphs = 0;
    for (const op of list.fnArray) {
      if (!safeCodes.has(op)) return false;
      if (showCodes.has(op)) glyphs++;
    }
    return glyphs > 0;
  }
  function inkBox(image) {
    const { width, height, data } = image;
    // Dirty/dark borders are ambiguous; never interpret them as removable white margins.
    const color = (x, y) => {
      const i = (y * width + x) * 4;
      return Math.min(data[i], data[i+1], data[i+2]);
    };
    const corners = [[0,0], [width-1,0], [0,height-1], [width-1,height-1]];
    if (corners.some(([x,y]) => color(x,y) < 240)) return { box: null, quality: "fallback", reason: "background" };
    let left = width, top = height, right = -1, bottom = -1, count = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = (y*width + x)*4;
      // Preserve isolated page numbers/thin strokes; no aggressive noise removal.
      if (data[i+3] > 32 && Math.min(data[i], data[i+1], data[i+2]) < 235) {
        left = Math.min(left,x); right = Math.max(right,x);
        top = Math.min(top,y); bottom = Math.max(bottom,y); count++;
      }
    }
    if (right < 0) return { box: null, quality: "fallback", reason: "blank" };
    if (count / (width*height) > 0.6) return { box: null, quality: "fallback", reason: "dense-background" };
    // One raster pixel protects antialiasing at the low-resolution boundary.
    return { box: [Math.max(0,left-1), Math.max(0,top-1), Math.min(width,right+2), Math.min(height,bottom+2)], quality: "reliable" };
  }
  // v0.1.6 S1: deterministic, diagonally staggered sampling. This estimates
  // bounds only; unlike inkBox(), a non-hit cannot prove pixels are absent.
  function sparseInkBox(image, stride = 4, phasePeriod = 16) {
    const {width, height, data} = image;
    if (!Number.isSafeInteger(stride) || stride < 2 || stride > 8 ||
        !Number.isSafeInteger(phasePeriod) || phasePeriod < stride ||
        !Number.isSafeInteger(width) || !Number.isSafeInteger(height) ||
        width < 1 || height < 1 || !data || data.length < width*height*4)
      return {box:null,quality:"fallback",reason:"invalid-input"};
    const corners=[0,(width-1)*4,(height-1)*width*4,(height*width-1)*4];
    if (corners.some(i => Math.min(data[i],data[i+1],data[i+2]) < 240))
      return {box:null,quality:"fallback",reason:"background"};
    const leftByRow=new Int32Array(height);
    const rightByRow=new Int32Array(height);
    const inkByRow=new Uint32Array(height);
    leftByRow.fill(width); rightByRow.fill(-1);
    let left=width,top=height,right=-1,bottom=-1,hits=0,visited=0;
    for(let y=0;y<height;y++) {
      const phase=(y + Math.floor(y/phasePeriod)) % stride;
      for(let x=phase;x<width;x+=stride) {
        visited++;
        const i=(y*width+x)*4;
        if(data[i+3]<=32 || Math.min(data[i],data[i+1],data[i+2])>=235)continue;
        hits++;inkByRow[y]++;
        if(x<leftByRow[y])leftByRow[y]=x;
        rightByRow[y]=x;
        if(x<left)left=x;
        if(x>right)right=x;
        if(y<top)top=y;
        if(y>bottom)bottom=y;
      }
    }
    if(right<0)return {box:null,quality:"fallback",reason:"blank-or-missed",visited,hits};
    if(hits/visited>0.6)return {box:null,quality:"fallback",reason:"dense-background",visited,hits};
    return {box:[Math.max(0,left-1),Math.max(0,top-1),
      Math.min(width,right+2),Math.min(height,bottom+2)],
      quality:"estimated",visited,hits,stride,phasePeriod,
      leftByRow,rightByRow,inkByRow};
  }
  function scaleDecision(record, mode, viewport, actual, anchor, explicit = false) {
    const safe = safeBox(record.raw, record.width, record.height);
    const available = mode === "height" ? viewport.height : viewport.width;
    const dimension = mode === "height" ? safe[3] - safe[1] : safe[2] - safe[0];
    const target = Math.min(MAX_SCALE, Math.max(0.1, available / Math.max(1, dimension)));
    const fits = dimension * actual <= available + 0.5;
    const change = explicit || !fits || !anchor || Math.abs(target / anchor - 1) + 1e-10 >= DEAD_ZONE;
    return { scale: change ? target : actual, target, change, safe };
  }
  function primaryPage(visible, previous, fallback) {
    const sorted = [...visible].sort((a,b) => b.area - a.area);
    if (!sorted.length) return fallback;
    const old = sorted.find(p => p.id === previous);
    if (old && old.area >= sorted[0].area * 0.95) return previous;
    return sorted[0].id;
  }
  function hook(object, name, replacement) {
    const own = Object.getOwnPropertyDescriptor(object, name);
    const original = object[name];
    Object.defineProperty(object, name, { configurable: true, writable: true, value: replacement });
    return () => {
      // Do not overwrite a hook installed later by another extension.
      if (object[name] !== replacement) return;
      if (own) Object.defineProperty(object, name, own);
      else delete object[name];
    };
  }
  class Session {
    constructor(count, detect, store = null) {
      this.count = count;
      this.detect = detect;
      this.cache = new Map();
      this.store = store;
      this.ready = store ? store.load().then(saved => {
        if (!this.closed) for (const [p,r] of saved) this.cache.set(p,r);
      }).catch(()=>{}) : Promise.resolve();
      this.models = null;
      this.l1Promise = null;
      this.tail = Promise.resolve();
      this.closed = false;
      this.paused = false;
      this.activeUntil = 0;
      this.metrics = { analyzed: [], cacheHits: 0, active: 0, peakConcurrent: 0 };
    }
    serial(job) {
      const task = this.tail.then(job);
      this.tail = task.catch(() => {});
      return task;
    }
    setEnabled(enabled) { this.paused = !enabled; }
    noteActivity(time = Date.now()) { this.activeUntil = Math.max(this.activeUntil, time + IDLE_MS); }
    allowExplicitRequest() { this.activeUntil = 0; }
    async waitForQuiet() {
      while (!this.closed && !this.paused) {
        const remaining = this.activeUntil - Date.now();
        if (remaining <= 0) return true;
        await new Promise(resolve => setTimeout(resolve, Math.min(remaining, 100)));
      }
      return false;
    }
    async read(p, rotation) {
      await this.ready;
      const prior = this.cache.get(p);
      if (prior && (rotation === undefined || prior.rotation === rotation)) {
        this.metrics.cacheHits++;
        return prior;
      }
      if (this.closed || this.paused) return null;
      this.metrics.active++;
      this.metrics.peakConcurrent = Math.max(this.metrics.peakConcurrent, this.metrics.active);
      try {
        const value = await this.detect(p, rotation);
        if (!this.closed) {
          this.cache.set(p, value);
          this.metrics.analyzed.push(p);
          if (this.store?.schedulePage) this.store.schedulePage(p,value);
          else this.store?.schedule(this.cache);
        }
        return value;
      } finally { this.metrics.active--; }
    }
    l1() {
      if (this.closed || this.paused) return Promise.resolve(null);
      if (!this.l1Promise) this.l1Promise = this.serial(async () => {
        await this.ready;
        const started = Date.now();
        const pages = samples(this.count);
        for (const p of pages) {
          if (!await this.waitForQuiet()) return null;
          await this.read(p);
        }
        if (!this.closed && !this.paused) {
          this.models = parityModels(this.cache, pages);
          this.folioPattern = folioPattern(pages, this.cache);
          const rotations = new Set(pages.map(p => this.cache.get(p)?.viewerRotation ?? 0));
          this.modelRotation = rotations.size === 1 ? [...rotations][0] : null;
          this.metrics.l1ElapsedMs = Date.now() - started;
        }
        return this.closed || this.paused ? null : this.models;
      }).then(models => {
        // Keep completed samples when paused; a later ON resumes the incomplete model.
        if (!models) this.l1Promise = null;
        return models;
      }, error => { this.l1Promise = null; throw error; });
      return this.l1Promise;
    }
    async local(p, rotation, valid, onCurrent) {
      if (!await this.l1()) return;
      for (const n of neighbors(p, this.count)) {
        if (this.closed || this.paused || !valid()) break;
        await this.serial(async () => {
          if (!await this.waitForQuiet() || !valid()) return;
          const value = await this.read(n, rotation);
          if (value && n === p && !this.closed && !this.paused && valid()) await onCurrent(value);
        });
      }
    }
    close() { this.closed = true; this.store?.close(this.cache); this.cache.clear(); }
  }
  return { VERSION, SAFETY, IDLE_MS, DEAD_ZONE, MAX_SCALE, clamp, union, safeBox, samples, neighbors,
    parityModels, prediction, multiply, textBox, textAndFolio, folioPattern, fitPageRecord,
    isTextOnlyOps, inkBox, sparseInkBox, scaleDecision, primaryPage, hook, Session };
})();
if (typeof module !== "undefined") module.exports = MarginFitCore;
