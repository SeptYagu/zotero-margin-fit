/* Shared pure geometry and serial detection scheduler; no Zotero dependency. */
"use strict";
var MarginFitCore = (() => {
  const VERSION = 1;
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
  function textBox(content, viewport) {
    let box = null;
    for (const item of content.items || []) {
      if (!item.str?.trim() || !item.transform) continue;
      const t = multiply(viewport.transform, item.transform);
      const length = Math.hypot(t[0], t[1]);
      const h = Math.hypot(t[2], t[3]);
      if (!length || !h) continue;
      const style = content.styles?.[item.fontName] || {};
      const ascent = Number.isFinite(style.ascent) ? style.ascent : 1;
      const descent = Number.isFinite(style.descent) ? style.descent : -0.3;
      // Baseline and font axis work for landscape/rotated text as well as pages.
      const ux = t[0] / length, uy = t[1] / length;
      const vx = t[2] / h, vy = t[3] / h;
      const advance = Math.abs(item.width * viewport.scale);
      const points = [];
      for (const x of [0, advance]) for (const y of [descent*h, ascent*h])
        points.push([t[4] + ux*x + vx*y, t[5] + uy*x + vy*y]);
      box = union(box, [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1])),
        Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))]);
    }
    return box && [clamp(box[0], 0, viewport.width), clamp(box[1], 0, viewport.height),
      clamp(box[2], 0, viewport.width), clamp(box[3], 0, viewport.height)];
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
    constructor(count, detect) {
      this.count = count;
      this.detect = detect;
      this.cache = new Map();
      this.models = null;
      this.l1Promise = null;
      this.tail = Promise.resolve();
      this.closed = false;
      this.paused = false;
      this.metrics = { analyzed: [], cacheHits: 0, active: 0, peakConcurrent: 0 };
    }
    serial(job) {
      const task = this.tail.then(job);
      this.tail = task.catch(() => {});
      return task;
    }
    setEnabled(enabled) { this.paused = !enabled; }
    async read(p, rotation) {
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
        }
        return value;
      } finally { this.metrics.active--; }
    }
    l1() {
      if (this.closed || this.paused) return Promise.resolve(null);
      if (!this.l1Promise) this.l1Promise = this.serial(async () => {
        const started = Date.now();
        const pages = samples(this.count);
        for (const p of pages) {
          if (this.closed || this.paused) return null;
          await this.read(p);
        }
        if (!this.closed && !this.paused) {
          this.models = parityModels(this.cache, pages);
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
          if (this.closed || this.paused || !valid()) return;
          const value = await this.read(n, rotation);
          if (value && n === p && !this.closed && !this.paused && valid()) await onCurrent(value);
        });
      }
    }
    close() { this.closed = true; this.cache.clear(); }
  }
  return { VERSION, SAFETY, IDLE_MS, DEAD_ZONE, MAX_SCALE, clamp, union, safeBox, samples, neighbors,
    parityModels, prediction, multiply, textBox, inkBox, scaleDecision, primaryPage, hook, Session };
})();
if (typeof module !== "undefined") module.exports = MarginFitCore;
