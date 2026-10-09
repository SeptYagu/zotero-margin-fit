/* Run after publishing the matching XPI; the public feed must reference an available asset. */
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
const app=manifest.applications.zotero;
const filename=`zotero-margin-fit-${manifest.version}.xpi`;
const artifact=fs.readFileSync(path.join(root,'dist',filename));
const update={
  version:manifest.version,
  update_link:`${manifest.homepage_url}/releases/download/v${manifest.version}/${filename}`,
  update_hash:'sha256:'+crypto.createHash('sha256').update(artifact).digest('hex'),
  applications:{zotero:{strict_min_version:app.strict_min_version,strict_max_version:app.strict_max_version}}
};
fs.writeFileSync(path.join(root,'updates.json'),JSON.stringify({addons:{[app.id]:{updates:[update]}}},null,2)+'\n');
console.log(`Prepared update feed for ${manifest.version} (${update.update_hash})`);
