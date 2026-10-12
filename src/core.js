/* Shared pure geometry and serial detection scheduler; no Zotero dependency. */
"use strict";
var MarginFitCore = (() => {
  const VERSION = 5; // v0.1.7: invalidate stale text-geometry bounds after ink calibration.
  // PDF.js scale=1 viewport units (1/72 inch), applied only at display time.
  const SAFETY = 16;
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
  function neighbors(p, count, direction = 1) {
    const step = direction < 0 ? -1 : 1;
    // Only the immediately adjacent pages earn speculative work.
    return [p, p + step, p - step].filter(n => n >= 1 && n <= count);
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
  // Some PDFs expose text advances that are much wider than the glyphs that
  // actually render (e.g. embedded-font metrics, synthetic spaces or clipping).
  // A text frame touching one page edge while the opposite margin is substantial
  // is a cheap, conservative reason to calibrate against real ink pixels.
  function textNeedsInkCalibration(box, width) {
    if (!box || !Number.isFinite(width) || width<=0 ||
        !box.every(Number.isFinite)) return false;
    const left = Math.max(0,box[0]), right = Math.max(0,width-box[2]);
    const tight = Math.max(3,width*.025), opposite = Math.max(18,width*.09);
    const imbalance = Math.max(24,width*.07), smallSide=Math.max(12,width*.075);
    // The offending article has similar bad font metrics on pages whose text
    // frame is 10-20 PDF units *inside* the physical edge. A severely lopsided
    // text frame with a small opposite margin also warrants an ink calibration.
    return (left>opposite && right<tight) || (right>opposite && left<tight) ||
      (Math.abs(left-right)>imbalance && Math.min(left,right)<smallSide);
  }
  // A long-lived ink edge, present at multiple separated heights, is evidence
  // that a 1/4-rate diagonal sample did not merely land on one random glyph.
  // A sparse absence is NEVER proof of empty pixels; lack of support retains
  // the original text frame. The 16 PDF-unit fitting pad protects small misses.
  function sparseEdgeSupport(ink,width,height) {
    if (!ink || ink.quality!=="estimated" || !ink.box ||
        !ink.inkByRow || !ink.leftByRow || !ink.rightByRow)
      return {left:false,right:false,confidence:0,reason:"no-sparse-evidence"};
    const stride=ink.stride||4;
    const tolerance=stride*2+2;
    const l=ink.box[0]+1,r=ink.box[2]-2;
    const evidence=[{rows:0,mask:0,first:height,last:-1},
      {rows:0,mask:0,first:height,last:-1}];
    for(let y=0;y<height;y++) {
      if(ink.inkByRow[y]<3)continue; // Reject single-pixel and thin isolated noise.
      for(let side=0;side<2;side++) {
        const match=side===0 ? ink.leftByRow[y]<=l+tolerance
          : ink.rightByRow[y]>=r-tolerance;
        if (!match)continue;
        const e=evidence[side];
        e.rows++;e.first=Math.min(e.first,y);e.last=Math.max(e.last,y);
        e.mask|=1<<Math.min(7,Math.floor(8*y/height));
      }
    }
    const bands=mask=>{let n=0;for(;mask;mask>>=1)n+=mask&1;return n;};
    const minRows=Math.max(8,Math.ceil(height*.018));
    const passed=e=>e.rows>=minRows && bands(e.mask)>=3 && e.last-e.first>=height*.25;
    const left=passed(evidence[0]),right=passed(evidence[1]);
    return {left,right,confidence:(left||right)?0.85:0,
      leftRows:evidence[0].rows,rightRows:evidence[1].rows,
      leftBands:bands(evidence[0].mask),rightBands:bands(evidence[1].mask),
      reason:left||right?"distributed-sparse-edge":"insufficient-edge-support"};
  }
  // For only the supported side, let visible ink override grossly inflated
  // text advances. Ordinary text and unsupported anomalies keep the union.
  function reconcileTextInk(text,raster,width,calibrate=false,support=null) {
    const result=union(text,raster);
    if (!result || !text || !raster || !calibrate || !support) return result;
    const mismatch=Math.max(SAFETY,width*.035);
    if (support.right && text[2]-raster[2]>mismatch) result[2]=raster[2];
    if (support.left && raster[0]-text[0]>mismatch) result[0]=raster[0];
    return result;
  }
  // Identify a folio candidate during the existing text-bbox traversal.
  // Pure-text mode only: a number at the edge is not sufficient on its own.
  function textAndFolio(content, viewport) {
    let bodyLeft=Infinity,bodyTop=Infinity,bodyRight=-Infinity,bodyBottom=-Infinity;
    let candidate = null, candidates = 0;
    let centerText = null;
    const all = textBox(content, viewport, (item,l,t,r,b) => {
      if (t >= viewport.height*.105 && b <= viewport.height*.885)
        centerText = union(centerText,[l,t,r,b]);
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
    if (!all || bodyLeft===Infinity || candidates !== 1 || !candidate) return {all,folio:null,centerText};
    const body=[bodyLeft,bodyTop,bodyRight,bodyBottom];
    const b = candidate.box;
    const gap = candidate.edge === 'top' ? body[1]-b[3] : b[1]-body[3];
    // A freestanding number requires whitespace from every other text glyph.
    if (gap < Math.max(12,viewport.height*.025)) return {all,folio:null,centerText};
    return {all,folio:{...candidate,body},centerText};
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
    // Keep the printed folio in Height Fit; only Width Fit excludes it.
    return {...record,widthFitRaw:[f.body[0],record.raw[1],f.body[2],record.raw[3]],
      folioExcluded:true};
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
  // Conservative body-width estimator. The sampled outermost points are not
  // silently discarded: protrusions must live exclusively in the small page
  // header/footer, and the central body must have distributed two-dimensional
  // support. The full raw bounds always remain available for Height Fit.
  function sparseBodyWidth(ink, width, height) {
    if(!ink || ink.quality!=="estimated" || !ink.box ||
      !ink.inkByRow || !ink.leftByRow || !ink.rightByRow)
      return {box:null,confidence:0,reason:"unreliable-raster"};
    const y0=Math.floor(height*.11),y1=Math.ceil(height*.88);
    let l=width,r=-1,first=height,last=-1,rows=0;
    for(let y=y0;y<y1;y++) {
      // A credible body line has multiple independent sampled positions.
      if(ink.inkByRow[y]<3)continue;
      rows++;first=Math.min(first,y);last=Math.max(last,y);
      l=Math.min(l,ink.leftByRow[y]);r=Math.max(r,ink.rightByRow[y]);
    }
    if(rows<12 || last-first < height*.25 || r-l < width*.22)
      return {box:null,confidence:0,reason:"insufficient-body-support"};
    const full=ink.box;
    const edgeGap=Math.max(12, width*.035);
    const leftOut=full[0]<l-edgeGap,rightOut=full[2]>r+edgeGap;
    if(!leftOut&&!rightOut)return {box:null,confidence:0,reason:"no-protrusion"};
    // Reject if a substantial independent graphic/footer is outlying:
    // a legitimate wide figure may be narrow vertically but wide horizontally.
    const maxOutRows=Math.max(15,Math.ceil(height*.055));
    let outRowsL=0,outRowsR=0;
    for(let y=0;y<height;y++) {
      const count=ink.inkByRow[y];
      if(!count)continue;
      const outsideLeft=leftOut && ink.leftByRow[y] < l-edgeGap;
      const outsideRight=rightOut && ink.rightByRow[y]>r+edgeGap;
      if(!outsideLeft&&!outsideRight)continue;
      if((y>=y0 && y<y1) || (ink.rightByRow[y]-ink.leftByRow[y]>width*.54))
        return {box:null,confidence:0,reason:"outlying-important-content"};
      if(outsideLeft)outRowsL++;
      if(outsideRight)outRowsR++;
    }
    if(outRowsL>maxOutRows || outRowsR>maxOutRows)
      return {box:null,confidence:0,reason:"protrusion-too-large"};
    const body=[leftOut?l:full[0],full[1],rightOut?r+1:full[2],full[3]];
    if(body[2]<=body[0])return {box:null,confidence:0,reason:"invalid-body"};
    return {box:body,confidence:0.85,reason:"isolated-marginal-protrusion",
      excludedLeft:leftOut,excludedRight:rightOut,bodyRows:rows,
      outlierRows:outRowsL+outRowsR};
  }
  function scaleDecision(record, mode, viewport, actual, anchor, explicit = false) {
    const fitRaw = mode === "width" && Array.isArray(record.widthFitRaw)
      ? record.widthFitRaw : record.raw;
    const safe = safeBox(fitRaw, record.width, record.height);
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
    constructor(count, detect, store = null, restore = null) {
      this.count = count;
      this.detect = detect;
      this.cache = new Map();
      this.store = store;
      this.ready = store ? store.load().then(saved => {
        if (this.closed) return;
        for (const [p,r] of saved) {
          const hydrated = restore ? restore(p,r) : r;
          if (hydrated) this.cache.set(p,hydrated);
        }
      }).catch(()=>{}) : Promise.resolve();
      this.models = null;
      this.folioPattern = null;
      this.l1Promise = null;
      this.tail = Promise.resolve();
      this.closed = false;
      this.paused = false;
      this.activeUntil = 0;
      this.visitedPages = new Set();
      this.speculative = new Map();
      this.folioValidationPromise = null;
      this.folioAttempts = new Set();
      this.metrics = { analyzed: [], cacheHits: 0, active: 0, peakConcurrent: 0,
        distinctVisits: 0, prefetchedRenders: 0, prefetchHits: 0,
        folioSkipped: 0, folioValidationRenders: 0, folioEarlyStops: 0 };
    }
    serial(job) {
      const task = this.tail.then(job);
      this.tail = task.catch(() => {});
      return task;
    }
    setEnabled(enabled) { this.paused = !enabled; }
    visit(p, rotation) {
      if (this.visitedPages.has(p)) return;
      this.visitedPages.add(p);
      this.metrics.distinctVisits++;
      if (this.speculative.get(p) === rotation) this.metrics.prefetchHits++;
      this.speculative.delete(p);
    }
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
          if (value?.reason !== "render-failed" && value?.reason !== "invalid-input") {
            if (this.store?.schedulePage) this.store.schedulePage(p,value);
            else this.store?.schedule(this.cache);
          }
        }
        return value;
      } finally { this.metrics.active--; }
    }
    l1() {
      if (this.closed || this.paused) return Promise.resolve(null);
      if (!this.l1Promise) this.l1Promise = (async () => {
        await this.ready;
        const started = Date.now();
        const pages = samples(this.count);
        // L1 is background work. Queue each sample individually, so an explicit
        // Fit or newly visible page can run after at most one in-flight render.
        for (const p of pages) {
          const completed = await this.serial(async () => {
            if (!await this.waitForQuiet() || this.closed || this.paused) return false;
            return !!await this.read(p);
          });
          if (!completed) return null;
        }
        if (!this.closed && !this.paused) {
          this.models = parityModels(this.cache, pages);
          this.folioPattern = folioPattern(pages, this.cache);
          const rotations = new Set(pages.map(p => this.cache.get(p)?.viewerRotation ?? 0));
          this.modelRotation = rotations.size === 1 ? [...rotations][0] : null;
          this.metrics.l1ElapsedMs = Date.now() - started;
        }
        return this.closed || this.paused ? null : this.models;
      })().then(models => {
        // Keep completed samples when paused; a later ON resumes the incomplete model.
        if (!models) this.l1Promise = null;
        return models;
      }, error => { this.l1Promise = null; throw error; });
      return this.l1Promise;
    }
    // Runtime only needs book-wide samples to verify a *current* pure-text
    // folio candidate. No useful candidate means zero distant-page renders.
    async validateFolio(p, valid = () => true) {
      await this.ready;
      if (this.closed || this.paused || !valid()) return null;
      const current = this.cache.get(p);
      if (this.count < 4 || !current?.fastPath || current.quality !== "reliable" || !current.folio) {
        this.metrics.folioSkipped++;
        return null;
      }
      if (this.folioPattern) return this.folioPattern;
      const key = p + ":" + current.rotation;
      if (this.folioAttempts.has(key)) return null;
      if (this.folioValidationPromise) {
        await this.folioValidationPromise;
        return this.closed || this.paused || !valid() ? null : this.validateFolio(p, valid);
      }
      // The current page plus already warm adjacent pages count toward the
      // same four-page corroboration requirement as the original folio model.
      const pages = [...new Set([p, ...neighbors(p, this.count), ...samples(this.count)])];
      const task = (async () => {
        const checked = [];
        for (const n of pages) {
          if (this.closed || this.paused || !valid()) return null;
          const outcome = await this.serial(async () => {
            if (!await this.waitForQuiet() || this.closed || this.paused || !valid()) return false;
            const cached = this.cache.has(n);
            const value = await this.read(n);
            if (value && !cached) this.metrics.folioValidationRenders++;
            return !!value;
          });
          if (!outcome || this.closed || this.paused || !valid()) return null;
          checked.push(n);
          const pattern = folioPattern(checked, this.cache);
          if (pattern && fitPageRecord(current, pattern, p).folioExcluded) {
            this.folioPattern = pattern;
            if (checked.length < pages.length) this.metrics.folioEarlyStops++;
            this.folioAttempts.add(key);
            return pattern;
          }
        }
        this.folioAttempts.add(key);
        return null;
      })();
      this.folioValidationPromise = task;
      try { return await task; }
      finally { if (this.folioValidationPromise === task) this.folioValidationPromise = null; }
    }
    // The actual page is never blocked by book-wide samples. Both startup and
    // explicit Fit share this serialized foreground path (one detector worker).
    visible(p, rotation, valid = () => true) {
      return this.serial(() => valid() ? this.read(p, rotation) : null);
    }
    async local(p, rotation, valid, onCurrent, direction = 1) {
      if (this.closed || this.paused || !valid()) return;
      // Render the current page before any representative or neighbor pages.
      await this.serial(async () => {
        if (!await this.waitForQuiet() || !valid()) return;
        const value = await this.read(p, rotation);
        if (value && !this.closed && !this.paused && valid()) await onCurrent(value);
      });
      // Warm only the two immediate neighbors, in the user's reading direction
      // first. This happens before distant L1 samples so the next page is ready.
      for (const n of neighbors(p, this.count, direction).slice(1)) {
        if (this.closed || this.paused || !valid()) break;
        await this.serial(async () => {
          if (!await this.waitForQuiet() || !valid()) return;
          const cached = this.cache.get(n);
          const alreadyCached = cached && cached.rotation === rotation;
          const value = await this.read(n, rotation);
          if (value && !alreadyCached && !this.visitedPages.has(n)) {
            this.speculative.set(n, rotation);
            this.metrics.prefetchedRenders++;
          }
        });
      }
      if (this.closed || this.paused || !valid()) return;
      const pattern = await this.validateFolio(p, valid);
      // A newly confirmed numbered-folio pattern may improve the current page's
      // width; notify once, without rerendering or disturbing other documents.
      const current = this.cache.get(p);
      if (pattern && current?.fastPath && current?.folio && valid())
        await onCurrent(current, true);
    }
    close() {
      this.closed = true; this.store?.close(this.cache); this.cache.clear();
      this.speculative.clear(); this.visitedPages.clear(); this.folioAttempts.clear();
    }
  }
  return { VERSION, SAFETY, IDLE_MS, DEAD_ZONE, MAX_SCALE, clamp, union, safeBox, samples, neighbors,
    parityModels, prediction, multiply, textBox, textNeedsInkCalibration, sparseEdgeSupport, reconcileTextInk, textAndFolio, folioPattern, fitPageRecord,
    isTextOnlyOps, inkBox, sparseInkBox, sparseBodyWidth, scaleDecision, primaryPage, hook, Session };
})();
if (typeof module !== "undefined") module.exports = MarginFitCore;
