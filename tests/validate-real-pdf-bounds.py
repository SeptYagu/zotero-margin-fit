"""Independent raster-ink check for PDF.js boundary records in real Zotero A/B runs.
Read original PDFs without modification, compare on-page ink to 16pt protected fitting
bounds. Intended as conservative screening, not pixel-perfect PDF.js equivalence.
"""
from pathlib import Path
import json, math
import fitz, numpy as np
B=Path(__file__).resolve().parent.parent/".test-harness"
status=json.loads((B/"real-ab-status.json").read_text(encoding="utf-8-sig"))
versions={}
for x in status["completed"]:
    if x.get("result"):
        d=json.loads(Path(x["result"]).read_text(encoding="utf-8-sig"))
        versions[x["label"]]={r["id"]:r for r in d["rows"]}
wanted=("v016-clean","latest-clean")
if not all(x in versions for x in wanted):raise SystemExit("Run both benchmarks first")
manifest=json.loads((B/"real-pdf-sample.json").read_text(encoding="utf8"))
report=[]
for entry in manifest["selection"]:
    ident=entry["id"];page_num=min(8,entry["pages"])
    readings={}
    for arm in wanted:
        row=versions[arm].get(ident,{})
        init=row.get("initial") or {}
        readings[arm]=next((r for r in init.get("exactRecords",[]) if r["p"]==page_num),None)
    try:
        with fitz.open(entry["path"]) as doc:
            page=doc[page_num-1]
            ref=readings["latest-clean"]
            if not ref or not ref["raw"]:raise ValueError("no exact current-page record")
            if abs(page.rect.width-ref["width"])>2 or abs(page.rect.height-ref["height"])>2:
                raise ValueError("page viewport geometry differs: cropbox/rotation")
            pix=page.get_pixmap(matrix=fitz.Matrix(1,1),colorspace=fitz.csRGB,alpha=False)
            if pix.n!=3:raise ValueError("unexpected color space")
            a=np.frombuffer(pix.samples,dtype=np.uint8).reshape((pix.height,pix.width,3))
            corners=[a[0,0],a[0,-1],a[-1,0],a[-1,-1]]
            if any(int(p.min())<240 for p in corners):raise ValueError("nonwhite-page-corner")
            mask=np.min(a,axis=2)<235
            rate=float(mask.mean())
            if rate<0.00001 or rate>0.6:raise ValueError("blank-or-dense")
            yy,xx=np.where(mask)
            oracle=[int(xx.min()),int(yy.min()),int(xx.max()+1),int(yy.max()+1)]
            row=dict(id=ident,kind=entry["kind"],source=entry["source"],page=page_num,
                inkRatio=round(rate,3),ink=oracle,checks={})
            for arm,record in readings.items():
                if not record or not record.get("raw") or record["quality"]!="reliable":
                    row["checks"][arm]={"status":"no-reliable-record"};continue
                raw=record["raw"]
                safe=[max(0,raw[0]-16),max(0,raw[1]-16),min(ref["width"],raw[2]+16),min(ref["height"],raw[3]+16)]
                missing=[round(max(0,safe[0]-oracle[0]),2),
                    round(max(0,safe[1]-oracle[1]),2),
                    round(max(0,oracle[2]-safe[2]),2),
                    round(max(0,oracle[3]-safe[3]),2)]
                row["checks"][arm]=dict(status="ok",raw=raw,safe=safe,
                    outsideInkPt=missing,maxOutsideInkPt=max(missing),
                    overextensionXPt=round((raw[2]-raw[0])-(oracle[2]-oracle[0]),1))
            report.append(row)
    except Exception as e:
        report.append(dict(id=ident,kind=entry["kind"],page=page_num,skip=str(e)))
(B/"real-ab-ink-oracle.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf8")
print("EVALUATED",sum("checks" in r for r in report),"SKIPPED",sum("skip" in r for r in report))
for row in report:
    if "skip" in row:print("SKIP",row["id"],row["kind"],row["skip"]);continue
    old=row["checks"]["v016-clean"];new=row["checks"]["latest-clean"]
    print("INK",row["id"],row["kind"],"missingOld",old.get("maxOutsideInkPt"),"missingNew",new.get("maxOutsideInkPt"),
          "overOld",old.get("overextensionXPt"),"overNew",new.get("overextensionXPt"))
