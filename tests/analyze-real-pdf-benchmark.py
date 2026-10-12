"""Analyze the three Zotero isolated-profile PDF A/B runs.
Keep private source paths in ignored .test-harness; safe markdown summaries
mention only anonymized sample IDs/categories and aggregate measurements.
"""
import json, math, random, statistics
from pathlib import Path
BASE=Path(__file__).resolve().parent.parent
H=BASE/".test-harness"
def read(p): return json.loads(Path(p).read_text(encoding="utf-8-sig"))
status=read(H/"real-ab-status.json")
bylabel={}
for arm in status["completed"]:
    if not arm.get("result"): continue
    data=read(arm["result"])
    bylabel[arm["label"]]=data
required=("v016-clean","p2-clean","latest-clean")
if not all(a in bylabel for a in required):
    print("NOT_DONE",list(bylabel)); raise SystemExit(1)
rows={lab:{x["id"]:x for x in bylabel[lab]["rows"]} for lab in required}
identifiers=sorted(set.intersection(*(set(x.keys()) for x in rows.values())))
matched=[i for i in identifiers if all(rows[a][i]["status"]=="ok" and rows[a][i].get("targetPage")==rows[a][i].get("initialPage") for a in required)]
def nrow(lab,key,ids=matched):
    return [rows[lab][i][key] for i in ids if isinstance(rows[lab][i].get(key),(float,int))]
def extract(lab,key):
    if key=="detectors": return [rows[lab][i]["initial"]["uniqueAnalyzed"] for i in matched]
    if key=="detectorWall":return [rows[lab][i]["initial"]["detectedElapsedMs"] for i in matched]
    if key=="writes":return [rows[lab][i]["firstFitWrites"] for i in matched]
    return nrow(lab,key)
def summary(vals):
    if not vals:return None
    vals=sorted(vals);return dict(n=len(vals),mean=round(statistics.mean(vals),1),
        median=round(statistics.median(vals),1),min=min(vals),
        p90=round(vals[min(len(vals)-1,math.ceil(.9*len(vals))-1)],1),max=max(vals),sum=round(sum(vals),1))
stats={arm:{k:summary(extract(arm,k)) for k in ("firstGeometryMs","initialWallMs","detectors","detectorWall","writes")} for arm in required}
def bbox_dict(row): return {r["p"]:r for r in row["initial"]["exactRecords"]}
differences=[]
for i in matched:
    a=rows["v016-clean"][i]; b=rows["latest-clean"][i]
    an=bbox_dict(a).get(a["initialPage"]); bn=bbox_dict(b).get(b["initialPage"])
    if not an or not bn or not an["raw"] or not bn["raw"]:continue
    if an["quality"]!="reliable" or bn["quality"]!="reliable":continue
    difference=[round(bn["raw"][j]-an["raw"][j],2) for j in range(4)]
    differences.append(dict(id=i,kind=a["kind"],source=a["source"],page=a["initialPage"],
      maxAbsDelta=round(max(map(abs,difference)),2),edgeDeltas=difference,
      prior=an["raw"],latest=bn["raw"],pageWidth=bn["width"],pageHeight=bn["height"],
      oldKind=an["kind"],newKind=bn["kind"]))
wins=[]
for i in matched:
    old=rows["v016-clean"][i];new=rows["latest-clean"][i]
    wins.append(dict(id=i,kind=new["kind"],source=new["source"],
      oldMs=old.get("firstGeometryMs"),newMs=new.get("firstGeometryMs"),
      deltaMs=(old["firstGeometryMs"]-new["firstGeometryMs"]) if old.get("firstGeometryMs") is not None and new.get("firstGeometryMs") is not None else None,
      oldDet=old["initial"]["uniqueAnalyzed"],newDet=new["initial"]["uniqueAnalyzed"],
      oldDetectorWall=old["initial"]["detectedElapsedMs"],newDetectorWall=new["initial"]["detectedElapsedMs"],
      oldWrites=old["firstFitWrites"],newWrites=new["firstFitWrites"]))
paired=[v["deltaMs"] for v in wins if v["deltaMs"] is not None]
boot=[]
if paired:
    rng=random.Random(20261011)
    for _ in range(3000):
        boot.append(statistics.median(rng.choices(paired,k=len(paired))))
    boot.sort()
ci=[round(boot[int(.025*len(boot))],1),round(boot[int(.975*len(boot))-1],1)]
data=dict(stage=status.get("stage"),arms={k:dict(passed=bylabel[k]["passed"],successful=bylabel[k]["measurements"]["successes"],
   total=bylabel[k]["measurements"]["completed"]) for k in required},matched=len(matched),
   excluded=sorted(set(identifiers)-set(matched)),stats=stats,
   winnerCount=sum(1 for w in wins if w["deltaMs"] is not None and w["deltaMs"]>0),
   loserCount=sum(1 for w in wins if w["deltaMs"] is not None and w["deltaMs"]<0),
   pairedMedianDeltaMs=round(statistics.median(paired),1) if paired else None,
   pairedMedianDeltaBootstrap95CI=ci if paired else None,
   perDoc=wins,edgeDiffs=sorted(differences,key=lambda d:d["maxAbsDelta"],reverse=True))
(H/"real-ab-analysis.json").write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding="utf8")
print("MATCHED",len(matched),"EXCLUDED",data["excluded"])
for arm in required:print("SUMMARY",arm,stats[arm])
print("WINS/LOSSES",data["winnerCount"],data["loserCount"],"MEDIAN-DELTA",data["pairedMedianDeltaMs"],"CI",data["pairedMedianDeltaBootstrap95CI"])
for w in wins:print("DOC",w)
print("TOP_GEOMETRY_DIFFERENCES")
for d in data["edgeDiffs"][:18]:print("EDGE",d["id"],d["kind"],d["maxAbsDelta"],d["edgeDeltas"])
