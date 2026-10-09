/* Deterministic dependency-free ZIP/XPI writer, works on Windows and CI. */
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const root = path.resolve(__dirname,'..');
const manifest = JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
const names = ['manifest.json','bootstrap.js','src/core.js','src/persistent-cache.js','src/runtime.js','LICENSE'];
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const b of bytes) {
    crc ^= b;
    for (let i=0;i<8;i++) crc = (crc>>>1) ^ ((crc&1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
const local=[],central=[];
let offset=0;
for (const name of names) {
  const filename=Buffer.from(name), data=fs.readFileSync(path.join(root,name)), packed=zlib.deflateRawSync(data);
  const crc=crc32(data), header=Buffer.alloc(30), directory=Buffer.alloc(46);
  header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20,4); header.writeUInt16LE(8,8);
  header.writeUInt16LE(0x5d41,12); header.writeUInt32LE(crc,14);
  header.writeUInt32LE(packed.length,18); header.writeUInt32LE(data.length,22); header.writeUInt16LE(filename.length,26);
  directory.writeUInt32LE(0x02014b50); directory.writeUInt16LE(20,4); directory.writeUInt16LE(20,6); directory.writeUInt16LE(8,10);
  directory.writeUInt16LE(0x5d41,14); directory.writeUInt32LE(crc,16); directory.writeUInt32LE(packed.length,20);
  directory.writeUInt32LE(data.length,24); directory.writeUInt16LE(filename.length,28); directory.writeUInt32LE(offset,42);
  local.push(header,filename,packed); central.push(directory,filename); offset+=header.length+filename.length+packed.length;
}
const cd=Buffer.concat(central),end=Buffer.alloc(22);
end.writeUInt32LE(0x06054b50); end.writeUInt16LE(names.length,8); end.writeUInt16LE(names.length,10);
end.writeUInt32LE(cd.length,12); end.writeUInt32LE(offset,16);
fs.mkdirSync(path.join(root,'dist'),{recursive:true});
const output=path.join(root,'dist',`zotero-margin-fit-${manifest.version}.xpi`);
fs.writeFileSync(output,Buffer.concat([...local,cd,end]));
console.log(output);
