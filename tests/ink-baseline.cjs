const {performance}=require('node:perf_hooks');
const C=require('../src/core.js');
function fast(image){
 const {width:w,height:h,data:d}=image;
 const corners=[0,(w-1)*4,((h-1)*w)*4,(h*w-1)*4];
 for(const i of corners) if(d[i]<240||d[i+1]<240||d[i+2]<240)
   return {box:null,quality:'fallback',reason:'background'};
 let l=w,t=h,r=-1,b=-1,count=0;
 const denseThreshold=0.6*w*h;
 for(let y=0,i=0;y<h;y++) for(let x=0;x<w;x++,i+=4){
   if(d[i+3]>32 && (d[i]<235||d[i+1]<235||d[i+2]<235)){
     if(x<l)l=x;if(x>r)r=x;if(y<t)t=y;if(y>b)b=y;
     count++;
     if(count>denseThreshold)return {box:null,quality:'fallback',reason:'dense-background'};
   }
 }
 if(r<0)return {box:null,quality:'fallback',reason:'blank'};
 return {box:[Math.max(0,l-1),Math.max(0,t-1),Math.min(w,r+2),Math.min(h,b+2)],quality:'reliable'};
}
const patterns=['body','scan','page-number','blank','dense'];
const W=600,H=800;
function create(name){
 const d=new Uint8ClampedArray(W*H*4);
 d.fill(255);
 function dot(x,y,v=12){const i=(y*W+x)*4;d[i]=d[i+1]=d[i+2]=v;}
 if(name==='body'||name==='scan'){
  for(let y=100;y<720;y+=13)for(let x=80;x<525;x+=8)
    for(let dy=0;dy<7;dy++) for(let dx=0;dx<3;dx++)dot(x+dx,y+dy);
 }else if(name==='page-number'){dot(300,790);}
 else if(name==='dense'){
  for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++)if(x%9)dot(x,y);
 }
 return {width:W,height:H,data:d};
}
for(const name of patterns){
 const data=create(name);
 const aa=C.inkBox(data),bb=fast(data);
 if(JSON.stringify(aa)!==JSON.stringify(bb))throw Error(name+': mismatched '+JSON.stringify({aa,bb}));
 for(let j=0;j<15;j++){C.inkBox(data);fast(data)}
 const samples=30;
 function run(f){const a=performance.now();for(let j=0;j<samples;j++)f(data);return +(performance.now()-a).toFixed(1)}
 const old=run(C.inkBox),nw=run(fast);
 console.log(JSON.stringify({pattern:name,iterations:samples,originalMs:old,candidateMs:nw,speedup: +(old/nw).toFixed(2),identical:true}));
}
