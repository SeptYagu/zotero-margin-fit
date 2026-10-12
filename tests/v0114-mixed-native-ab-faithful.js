/* Paired baseline operator-list+raster vs raster-first in disposable Zotero reader copies. */
const rows=[],errors=[],checks=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=22000){const stop=Date.now()+ms;while(Date.now()<stop){try{if(fn())return true}catch(_){}await sleep(100)}return false;}
function startup(){if(!Services.prefs.getBoolPref('marginfit.integrationProfile',false))return;
 Zotero.uiReadyPromise.then(run).catch(e=>finish(false,e));}
async function finish(passed,error){await IOUtils.writeJSON(
 Services.prefs.getStringPref('marginfit.integrationResult'),
 {passed,checks,details:{rows,errors},error:error&&String(error),stack:error?.stack,measurements:{completed:rows.length}});
 Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit);}
function unwrap(x){return x?.wrappedJSObject||x;}
function into(win,o){const v=unwrap(new (unwrap(win).Object)());for(const [k,x] of Object.entries(o))v[k]=x;return v;}
async function measure(c,index,arm){
 const win=c.win,raw=unwrap(await c.app.pdfDocument.getPage(index));
 const view=unwrap(raw.getViewport(into(win,{scale:1})));
 const f=Math.min(1,560/Math.max(view.width,view.height));
 const low=unwrap(view.clone(into(win,{scale:f})));
 const t0=Date.now();
 const tx=unwrap(await raw.getTextContent());
 const textMs=Date.now()-t0;
 const t1=Date.now();
 let opCount=null,opMs=0,strictPure=false,annotationCount=null;
 if(arm==='baseline'){
   const instr=unwrap(await raw.getOperatorList()); opCount=instr.fnArray?.length||0;
   const names=['dependency','save','restore','transform','beginText','endText','setFont',
    'setCharSpacing','setWordSpacing','setHScale','setLeading','setTextRise','moveText',
    'setLeadingMoveText','setTextMatrix','nextLine','showText','showSpacedText',
    'nextLineShowText','nextLineSetSpacingShowText','setFillRGBColor','setFillGray',
    'setFillCMYKColor','setFillColor','setFillColorN','setFillColorSpace',
    'setStrokeRGBColor','setStrokeGray'];
   const ops=unwrap(win.pdfjsLib)?.OPS||unwrap(c.app.pdfjsLib)?.OPS;
   const codes=new Set(names.map(n=>ops?.[n]).filter(Number.isInteger));
   const showCodes=new Set(['showText','showSpacedText','nextLineShowText','nextLineSetSpacingShowText']
    .map(n=>ops?.[n]).filter(Number.isInteger));
   strictPure=!!ops&&opCount>0&&instr.fnArray.every(n=>codes.has(n))&&
     instr.fnArray.some(n=>showCodes.has(n));
   if(strictPure){const ann=unwrap(await raw.getAnnotations(into(win,{intent:'display'})));
     annotationCount=ann?.length||0;strictPure=annotationCount===0;}
   opMs=Date.now()-t1;
 }
 if(arm==='baseline' && strictPure && tx.items?.length>0)
   return {textMs,opMs,rasterMs:0,totalMs:Date.now()-t0,opCount,strictPure,
     annotationCount,chars:tx.items.reduce((n,i)=>n+(i.str?.length||0),0),ink:null,hash:null};
 const canvas=win.document.createElement('canvas');canvas.width=Math.ceil(low.width);canvas.height=Math.ceil(low.height);
 const ctx=unwrap(canvas.getContext('2d',{willReadFrequently:true}));ctx.skipBlender=true;
 ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);
 const t2=Date.now();const task=unwrap(raw.render(into(win,{
  canvasContext:ctx,viewport:low,background:'rgb(255,255,255)'})));
 await task.promise;const rasterMs=Date.now()-t2;
 const bytes=ctx.getImageData(0,0,canvas.width,canvas.height).data;
 let sum=0,ink=0; for(let i=0;i<bytes.length;i+=4){const q=bytes[i]+bytes[i+1]+bytes[i+2];if(q<660)ink++;sum=(sum*33+q)>>>0;}
 canvas.width=0;canvas.height=0;
 return {textMs,opMs,rasterMs,totalMs:Date.now()-t0,opCount,strictPure,annotationCount,
  chars:tx.items?.reduce((n,i)=>n+(i.str?.length||0),0)||0,ink,hash:sum};
}
async function run(){let reader=null;try{
 await Zotero.Libraries.get(Zotero.Libraries.userLibraryID).waitForDataLoad('item');
 const manifest=await IOUtils.readJSON(Services.prefs.getStringPref('marginfit.benchmarkManifest'));
 const {AddonManager}=ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs');
 const x=Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);
 x.initWithPath(Services.prefs.getStringPref('marginfit.integrationXPI'));
 await (await AddonManager.getInstallForFile(x)).install();
 Services.prefs.setBoolPref('extensions.marginfit.enabled',false);
 const docs=manifest.selection.filter(x=>x.kind==='mixed').slice(0,7);
 for(const entry of docs){
   const pageNums=[3,Math.min(5,entry.pages),Math.min(7,entry.pages)]
    .filter((x,i,a)=>x<=entry.pages && a.indexOf(x)===i);
   for(const arm of ['baseline','raster-first']){
     const item=await Zotero.Attachments.importFromFile({file:entry.path});
     reader=await Zotero.Reader.open(item.id,{position:{pageIndex:0}});
     if(!await until(()=>Zotero.MarginFit?.controllers.get(reader._internalReader?._primaryView)))
       throw Error('missing reader controller');
     const c=Zotero.MarginFit.controllers.get(reader._internalReader._primaryView);
     for(const p of pageNums){
       try{const data=await measure(c,p,arm);rows.push({id:entry.id,arm,page:p,...data});}
       catch(err){errors.push({id:entry.id,page:p,arm,error:String(err)})}
     }
     reader.close();reader=null;
     await sleep(120);
   }
   await IOUtils.writeJSON(Services.prefs.getStringPref('marginfit.integrationResult')+'.progress',
     {completed:entry.id,rows,errors});
 }
 checks.push('Pair-matched pages for operator-list+render vs raster-first; same PDF content, isolated copies');
 await finish(rows.length>0 && errors.length===0);
}catch(err){try{reader?.close()}catch(_){}
 await finish(false,err);}
}
