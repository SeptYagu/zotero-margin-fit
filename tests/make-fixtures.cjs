/* All fixtures are generated here, with known geometric truth and no third-party PDFs. */
const fs=require('node:fs');
const path=require('node:path');
const zlib=require('node:zlib');
const out=path.resolve(__dirname,'../.test-harness/fixtures');
fs.mkdirSync(out,{recursive:true});
function pdf(name, definitions) {
  const objects=[];
  const add=buffer=>{objects.push(Buffer.isBuffer(buffer)?buffer:Buffer.from(buffer));return objects.length;};
  const set=(id,text)=>{objects[id-1]=Buffer.from(text);};
  const catalog=add(''), pages=add(''), font=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const ids=[];
  const stream=(dict,data)=>Buffer.concat([Buffer.from(`<< ${dict} /Length ${data.length} >>\nstream\n`),data,Buffer.from('\nendstream')]);
  for(const d of definitions) {
    let resource=`/Font << /F1 ${font} 0 R >>`;
    if(d.image) {
      const id=add(stream(`/Type /XObject /Subtype /Image /Width ${d.image.w} /Height ${d.image.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode`,zlib.deflateSync(d.image.data)));
      resource+=` /XObject << /Im1 ${id} 0 R >>`;
    }
    const content=add(stream('',Buffer.from(d.content)));
    ids.push(add(`<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 600 800] /Rotate ${d.rotate||0} /Resources << ${resource} >> /Contents ${content} 0 R >>`));
  }
  set(pages,`<< /Type /Pages /Count ${ids.length} /Kids [${ids.map(id=>id+' 0 R').join(' ')}] >>`);
  set(catalog,`<< /Type /Catalog /Pages ${pages} 0 R >>`);
  const parts=[Buffer.from('%PDF-1.4\n')],offsets=[0];let offset=parts[0].length;
  objects.forEach((obj,i)=>{offsets.push(offset);const item=Buffer.concat([Buffer.from(`${i+1} 0 obj\n`),obj,Buffer.from('\nendobj\n')]);parts.push(item);offset+=item.length;});
  const xref=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size ${objects.length+1} /Root ${catalog} 0 R >>\nstartxref\n${offset}\n%%EOF\n`;
  fs.writeFileSync(path.join(out,name),Buffer.concat([...parts,Buffer.from(xref)]));
}
const book=[];
for(let p=1;p<=24;p++) {
  const left=p%2?150:60;
  let content=`0 g\nBT /F1 12 Tf ${left} 650 Td (MarginFit generated page ${p}) Tj ET\n`;
  for(let row=0;row<24;row++) content+=`BT /F1 10 Tf ${left} ${620-row*14} Td (Body text, footnotes, figures and asymmetric margins.) Tj ET\n`;
  content+=`${left} 200 300 12 re f\nBT /F1 7 Tf ${left} 175 Td (A tiny footnote must remain visible.) Tj ET\nBT /F1 8 Tf ${left+145} 150 Td (${p}) Tj ET\n`;
  book.push({content});
}
pdf('asymmetric-book.pdf',book);
// Distinct initial bytes keep OFF-during-L1 regression cold despite the new disk cache.
pdf('asymmetric-book-pause.pdf',book.map(d=>({content:d.content.replace('MarginFit generated','PauseCase generated')})));
const w=600,h=800,data=Buffer.alloc(w*h*3,255);
function rect(x,y,ww,hh) {for(let j=y;j<y+hh;j++)for(let i=x;i<x+ww;i++){const k=(j*w+i)*3;data[k]=data[k+1]=data[k+2]=20;}}
for(let row=0;row<22;row++)for(let col=0;col<45;col++){
  rect(95+col*7,120+row*19,1,10);rect(95+col*7,120+row*19,5,1);rect(95+col*7,125+row*19,4,1);
}
rect(253,670,1,7);rect(250,677,7,1); // thin isolated page number
pdf('clean-scan.pdf',[{image:{w,h,data},content:'q 600 0 0 800 0 0 cm /Im1 Do Q'}]);
pdf('rotated.pdf',[{...book[0],rotate:90}]);
pdf('blank.pdf',[{content:''}]);
pdf('dark-background.pdf',[{content:'0.2 0.2 0.2 rg 0 0 600 800 re f'}]);
pdf('wide-figure.pdf',[{content:'0 g 30 350 540 100 re f BT /F1 10 Tf 30 465 Td (Wide figure: height mode must permit horizontal scrolling.) Tj ET'}]);
pdf('pure-text.pdf',Array.from({length:12},(_,i)=>({content:`0 g BT /F1 12 Tf 80 680 Td (Pure text page ${i+1} no graphics.) Tj ET BT /F1 10 Tf 80 600 Td (This body contains only ordinary PDF text.) Tj ET`})));
fs.writeFileSync(path.join(out,'truth.json'),JSON.stringify({
  book:{odd:[150,138,450,652],even:[60,138,360,652],tolerance:4},
  scan:{raw:[95,120,408,678],tolerance:3},rotated:true,blank:'fallback',dark:'fallback'
},null,2));
console.log(out);
