import csv
import io
import json
import os

from dotenv import load_dotenv
from flask import Flask, Response, jsonify, request
from flask_cors import CORS

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

import db  # noqa: E402
import icp as icp_mod  # noqa: E402
import pipeline  # noqa: E402

app = Flask(__name__)
CORS(app)


def _campaign(cid):
    with db.conn() as c:
        camp = c.execute("SELECT * FROM campaigns WHERE id=?", (cid,)).fetchone()
        if not camp:
            return None
        steps = c.execute("SELECT name,status,detail,ts FROM steps WHERE campaign_id=? ORDER BY id", (cid,)).fetchall()
        comps = {r["id"]: r for r in c.execute("SELECT * FROM companies WHERE campaign_id=?", (cid,))}
        pros = c.execute("SELECT * FROM prospects WHERE campaign_id=? ORDER BY score DESC", (cid,)).fetchall()
    prospects = []
    for p in pros:
        co = comps.get(p["company_id"])
        prospects.append({
            "id": p["id"], "person": json.loads(p["data_json"]),
            "company": json.loads(co["data_json"]) if co else None,
            "company_source": co["source"] if co else None, "company_fetched_at": co["fetched_at"] if co else None,
            "score": p["score"], "breakdown": json.loads(p["breakdown_json"]),
            "explanation": json.loads(p["explanation_json"]),
            "draft_subject": p["draft_subject"], "draft_body": p["draft_body"],
            "approval": p["approval"], "source": p["source"], "fetched_at": p["fetched_at"],
        })
    return {
        "id": camp["id"], "prompt": camp["prompt"], "status": camp["status"], "error": camp["error"],
        "icp": json.loads(camp["icp_json"]) if camp["icp_json"] else None,
        "created_at": camp["created_at"], "steps": [dict(s) for s in steps],
        "companies_count": len(comps), "prospects": prospects,
    }


@app.get("/api/health")
def health():
    load_dotenv(os.path.join(os.path.dirname(__file__), ".env"), override=True)
    return jsonify(ok=True, crustdata_key=bool(os.getenv("CRUSTDATA_API_KEY", "").strip()))


@app.post("/api/parse")
def parse():
    body = request.get_json(force=True)
    return jsonify(icp_mod.parse(body.get("prompt", ""), body.get("offering", "")))


@app.get("/api/campaigns")
def list_campaigns():
    with db.conn() as c:
        rows = c.execute(
            "SELECT c.id,c.prompt,c.status,c.created_at,"
            " (SELECT COUNT(*) FROM prospects p WHERE p.campaign_id=c.id) AS prospects,"
            " (SELECT COUNT(*) FROM prospects p WHERE p.campaign_id=c.id AND p.approval='approved') AS approved"
            " FROM campaigns c ORDER BY c.id DESC LIMIT 50").fetchall()
    return jsonify([dict(r) for r in rows])


@app.post("/api/campaigns")
def create_campaign():
    body = request.get_json(force=True)
    prompt = (body.get("prompt") or "").strip()
    if not prompt:
        return jsonify(error="prompt is required"), 400
    n = max(1, min(int(body.get("max_companies") or 10), 25))
    cid = pipeline.start(prompt, body.get("offering", ""), body.get("sender", ""), n)
    return jsonify(id=cid), 201


@app.get("/api/campaigns/<int:cid>")
def get_campaign(cid):
    camp = _campaign(cid)
    return (jsonify(camp), 200) if camp else (jsonify(error="not found"), 404)


@app.patch("/api/prospects/<int:pid>")
def update_prospect(pid):
    body = request.get_json(force=True)
    sets, vals = [], []
    if body.get("approval") in ("approved", "rejected", "pending"):
        sets.append("approval=?"); vals.append(body["approval"])
    for k in ("draft_subject", "draft_body"):
        if isinstance(body.get(k), str):
            sets.append(f"{k}=?"); vals.append(body[k])
    if not sets:
        return jsonify(error="nothing to update"), 400
    with db.conn() as c:
        c.execute(f"UPDATE prospects SET {','.join(sets)}, updated_at=? WHERE id=?", (*vals, db.now(), pid))
    return jsonify(ok=True)


@app.get("/api/campaigns/<int:cid>/export.csv")
def export(cid):
    camp = _campaign(cid)
    if not camp:
        return jsonify(error="not found"), 404
    rows = [p for p in camp["prospects"] if request.args.get("all") or p["approval"] == "approved"]
    out = io.StringIO()
    w = csv.writer(out)
    w.writerow(["name", "title", "seniority", "company", "domain", "headcount", "score", "tier", "approval",
                "linkedin_url", "company_url", "email_subject", "email_body", "score_breakdown",
                "source", "fetched_at"])
    for p in rows:
        per, co = p["person"], p["company"] or {}
        w.writerow([per.get("name"), per.get("title"), per.get("seniority"), co.get("name"), co.get("domain"),
                    co.get("headcount"), p["score"], per.get("tier"), p["approval"], per.get("profile_url"),
                    co.get("source_url"), p["draft_subject"], p["draft_body"],
                    "; ".join(f'{b["criterion"]}: {b["points"]}/{b["max"]}' for b in p["breakdown"]),
                    p["source"], p["fetched_at"]])
    return Response(out.getvalue(), mimetype="text/csv",
                    headers={"Content-Disposition": f"attachment; filename=dealflow-campaign-{cid}.csv"})


if __name__ == "__main__":
    app.run(port=5000, debug=False, threaded=True)
