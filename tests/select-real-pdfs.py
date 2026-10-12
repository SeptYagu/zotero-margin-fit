"""Build a read-only, reproducible stratified sample from the user's PDF libraries.
Never opens Zotero database; accesses original PDFs strictly for reading.
Output manifest remains in .test-harness (gitignored).
"""
import argparse, fitz, hashlib, json
from pathlib import Path
base=Path(__file__).resolve().parent.parent
parser=argparse.ArgumentParser(description="Sample read-only real PDF roots for a controlled Zotero A/B benchmark")
parser.add_argument("--root",action="append",required=True,help="LABEL=ABSOLUTE_DIRECTORY (repeat for independent document collections)")
args=parser.parse_args()
roots=[]
for raw in args.root:
    label,separator,dirname=raw.partition("=")
    if not separator or not label or not dirname:parser.error("--root must be LABEL=ABSOLUTE_DIRECTORY")
    roots.append((label,Path(dirname)))
probes=[]
for source, root in roots:
    if not root.exists(): continue
    paths=[]
    for p in root.rglob("*.pdf"):
        s=str(p).lower()
        if any(k in s for k in (".pdf-reader-parts","\\tmp\\","\\staging-","\\cache\\","\\backup\\")):
            continue
        try:
            size=p.stat().st_size
        except OSError: continue
        if 180_000 <= size <= 12_000_000: paths.append((p,size))
    paths.sort(key=lambda x:hashlib.sha256(str(x[0]).encode("utf8")).hexdigest())
    paths=paths[:min(150,len(paths))]
    print("SOURCE",source,"eligible",len(paths),flush=True)
    for p,size in paths:
        try:
            with fitz.open(str(p)) as doc:
                count=len(doc)
                if count<4 or count>500 or doc.is_encrypted: continue
                inds=sorted(set((0,min(2,count-1),count//2)))
                chars=[]; images=[]; drawings=[]
                for i in inds:
                    page=doc[i]
                    chars.append(len(page.get_text("text")))
                    images.append(len(page.get_images(full=True)))
                    drawings.append(len(page.get_drawings()))
                avg=sum(chars)/len(chars); image=sum(images)/len(images); draw=sum(drawings)/len(drawings)
                if avg<100 and image>=0.7: kind="scan"
                elif avg<220 and draw>=30: kind="notation-vector"
                elif avg>=250 and (image>=0.5 or draw>=60):kind="mixed"
                elif avg>=250:kind="text"
                elif image>=0.3:kind="scan"
                else:kind="notation-vector"
                probes.append(dict(source=source,path=str(p),bytes=size,pages=count,
                    sample_chars=round(avg),sample_images=round(image,1),sample_drawings=round(draw,1),kind=kind))
        except Exception: continue
print("CLASS_COUNTS",json.dumps({k:sum(x["kind"]==k for x in probes) for k in ("text","mixed","scan","notation-vector")}),flush=True)
selection=[]
# Source-balanced, with genuine scanned and notation documents.
quotas={"text":5,"mixed":5,"scan":4,"notation-vector":4}
used=set()
for kind,quota in quotas.items():
    arr=[x for x in probes if x["kind"]==kind]
    # choose a mixture of high and low file sizes and locations, deterministic
    arr.sort(key=lambda x:(len([s for s in selection if s["source"]==x["source"]]),
                          hashlib.sha256(x["path"].encode("utf8")).hexdigest()))
    for x in arr:
        if sum(s["kind"]==kind for s in selection)>=quota:break
        if x["path"] in used:continue
        selection.append(x);used.add(x["path"])
# Fill if insufficient rare categories.
for x in probes:
    if len(selection)>=18:break
    if x["path"] not in used:selection.append(x);used.add(x["path"])
selection.sort(key=lambda x:(x["kind"],x["source"],x["path"]))
for i,x in enumerate(selection):
    x["id"]=f"P{i+1:02d}"; x["label"]=Path(x["path"]).name[:90]
out=base/".test-harness"/"real-pdf-sample.json"
out.parent.mkdir(exist_ok=True)
out.write_text(json.dumps(dict(seed="sha256-path-order",selection=selection),ensure_ascii=False,indent=2),encoding="utf8")
print("MANIFEST",out,"SELECTED",len(selection),flush=True)
for x in selection:
    print(x["id"],x["source"],x["kind"],"p="+str(x["pages"]),"MB="+str(round(x["bytes"]/1e6,2)),
          "chars="+str(x["sample_chars"]),"imgs="+str(x["sample_images"]),"draws="+str(x["sample_drawings"]),flush=True)
