const {performance}=require('node:perf_hooks'),C=require('../src/core.js');
function legacy(content,viewport){
 let box=null;
 for(const item of content.items||[]){
  if(!item.str?.trim()||!item.transform)continue;
  const t=C.multiply(viewport.transform,item.transform);
  const length=Math.hypot(t[0],t[1]),h=Math.hypot(t[2],t[3]);
  if(!length||!h)continue;
  const style=content.styles?.[item.fontName]||{};
  const ascent=Number.isFinite(style.ascent)?style.ascent:1;
  const descent=Number.isFinite(style.descent)?style.descent:-0.3;
  const ux=t[0]/length,uy=t[1]/length,vx=t[2]/h,vy=t[3]/h;
  const advance=Math.abs(item.width*viewport.scale);
  const points=[];
  for(const x of [0,advance])for(const y of [descent*h,ascent*h])
    points.push([t[4]+ux*x+vx*y,t[5]+uy*x+vy*y]);
  box=C.union(box,[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),
    Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))]);
 }
 return box && [C.clamp(box[0],0,viewport.width),C.clamp(box[1],0,viewport.height),
  C.clamp(box[2],0,viewport.width),C.clamp(box[3],0,viewport.height)];
}
function scalarBox(content, viewport) {
 let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
 let found=false;
 for(const item of content.items||[]){
  if(!item.str?.trim()||!item.transform)continue;
  const t=C.multiply(viewport.transform,item.transform);
  const length=Math.hypot(t[0],t[1]),h=Math.hypot(t[2],t[3]);
  if(!length||!h)continue;
  const style=content.styles?.[item.fontName]||{};
  const ascent=Number.isFinite(style.ascent)?style.ascent:1;
  const descent=Number.isFinite(style.descent)?style.descent:-0.3;
  const ux=t[0]/length,uy=t[1]/length,vx=t[2]/h,vy=t[3]/h,advance=Math.abs(item.width*viewport.scale);
  const xx=t[4],yy=t[5],ax=ux*advance,ay=uy*advance,
    dx=vx*(descent*h),dy=vy*(descent*h),
    bx=vx*(ascent*h),by=vy*(ascent*h);
  const x0=xx+dx,x1=xx+dx+ax,x2=xx+bx,x3=xx+bx+ax;
  const y0=yy+dy,y1=yy+dy+ay,y2=yy+by,y3=yy+by+ay;
  const minx=Math.min(x0,x1,x2,x3),maxx=Math.max(x0,x1,x2,x3);
  const miny=Math.min(y0,y1,y2,y3),maxy=Math.max(y0,y1,y2,y3);
  if(minx<left)left=minx;if(miny<top)top=miny;
  if(maxx>right)right=maxx;if(maxy>bottom)bottom=maxy;
  found=true;
 }
 return found?[C.clamp(left,0,viewport.width),C.clamp(top,0,viewport.height),
 C.clamp(right,0,viewport.width),C.clamp(bottom,0,viewport.height)]:null;
}
for(const n of [100,1000,10000]){
 const content={items:Array.from({length:n},(_,i)=>({str:'Body text',fontName:'F1',
 transform:[10,0,0,10,(i*53)%480+40,(i*17)%700+20],width:10+(i%100)})),
 styles:{F1:{ascent:0.83,descent:-0.18}}};
 for(const rotation of [0,90]){
 const vp={scale:1,transform: rotation===0?[1,0,0,-1,0,800]:[0,1,1,0,0,0],width:rotation?800:600,height:rotation?600:800};
 const old=legacy(content,vp),nw=C.textBox(content,vp);
 if(old.some((x,i)=>Math.abs(x-nw[i])>1e-8)) throw Error('results differ:'+JSON.stringify({old,nw}));
 if(rotation)continue;
 for(let i=0;i<15;i++){legacy(content,vp);C.textBox(content,vp)}
 const reps=n>=10000?10:100;
 const measure=fn=>{const start=performance.now();for(let i=0;i<reps;i++)fn(content,vp);return +(performance.now()-start).toFixed(2)};
 const baseline=measure(legacy),opt=measure(C.textBox);
 console.log(JSON.stringify({items:n,repeats:reps,oldMs:baseline,optimizedMs:opt,speedup: +(baseline/opt).toFixed(2),sameBounds:true}));
 }
}
