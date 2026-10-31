"""The DealFlow agent: parse -> discover -> find people -> normalize -> score -> explain -> draft.

Each step logs progress to SQLite so the UI can poll it. Failures keep partial results.
"""
import json
import threading
import traceback

import crustdata
import db
import icp as icp_mod
import scoring

STEPS = ["Interpret request", "Discover companies", "Find decision-makers",
         "Normalize records", "Score & explain", "Draft outreach"]
MAX_PER_COMPANY = 3


def _g(d, path, default=None):
    for k in path.split("."):
        if not isinstance(d, dict):
            return default
        d = d.get(k)
    return default if d is None else d


def _first(v):
    return v[0] if isinstance(v, list) and v else v


def log(cid, name, status, detail=""):
    with db.conn() as c:
        row = c.execute("SELECT id FROM steps WHERE campaign_id=? AND name=?", (cid, name)).fetchone()
        if row:
            c.execute("UPDATE steps SET status=?, detail=?, ts=? WHERE id=?", (status, detail, db.now(), row["id"]))
        else:
            c.execute("INSERT INTO steps (campaign_id,name,status,detail,ts) VALUES (?,?,?,?,?)",
                      (cid, name, status, detail, db.now()))


def set_status(cid, status, error=None):
    with db.conn() as c:
        c.execute("UPDATE campaigns SET status=?, error=?, updated_at=? WHERE id=?", (status, error, db.now(), cid))


def norm_company(raw, rank):
    hq = _g(raw, "locations.headquarters")
    if isinstance(hq, dict):
        hq = ", ".join(str(v) for v in hq.values() if v and isinstance(v, str))
    domain = _g(raw, "basic_info.primary_domain")
    url = _g(raw, "basic_info.professional_network_url") or _g(raw, "basic_info.website") or (
        f"https://{domain}" if domain else None)
    return {
        "crustdata_id": raw.get("crustdata_company_id"),
        "rank": rank,
        "name": _g(raw, "basic_info.name"),
        "domain": domain,
        "website": _g(raw, "basic_info.website") or (f"https://{domain}" if domain else None),
        "source_url": url,
        "year_founded": _g(raw, "basic_info.year_founded"),
        "industry": _first(_g(raw, "taxonomy.professional_network_industry")) or _first(_g(raw, "taxonomy.professional_network_industries")),
        "description": _g(raw, "basic_info.description"),
        "employee_count_range": _g(raw, "basic_info.employee_count_range"),
        "updated_at": _g(raw, "metadata.updated_at"),
        "country": _first(_g(raw, "locations.country")),
        "hq": hq if isinstance(hq, str) else None,
        "headcount": _g(raw, "headcount.total"),
        "growth_percent": _g(raw, "headcount.growth_percent"),
        "total_funding": _g(raw, "funding.total_investment_usd"),
        "last_round_type": _g(raw, "funding.last_round_type"),
        "last_round_amount": _g(raw, "funding.last_round_amount_usd"),
        "last_fundraise_date": _g(raw, "funding.last_fundraise_date"),
    }


def norm_person(raw, company_ids=()):
    cur = _g(raw, "experience.employment_details.current") or {}
    if isinstance(cur, list):  # people can hold several current roles; prefer the one at a target company
        cur = next((x for x in cur if isinstance(x, dict) and x.get("crustdata_company_id") in company_ids),
                   _first(cur) or {})
    past = _g(raw, "experience.employment_details.past") or []
    if isinstance(past, dict):
        past = [past]
    loc = _g(raw, "basic_profile.location")
    if isinstance(loc, dict):
        loc = loc.get("full_location") or ", ".join(v for v in (loc.get("city"), loc.get("country")) if v)
    return {
        "crustdata_id": raw.get("crustdata_person_id"),
        "name": _g(raw, "basic_profile.name"),
        "headline": _g(raw, "basic_profile.headline"),
        "location": loc or None,
        "profile_url": _g(raw, "social_handles.professional_network_identifier.profile_url"),
        "title": cur.get("title"),
        "company_name": cur.get("name"),
        "company_id": cur.get("crustdata_company_id"),
        "seniority": cur.get("seniority_level"),
        "start_date": str(cur["start_date"])[:10] if cur.get("start_date") else None,
        "updated_at": _g(raw, "metadata.updated_at"),
        "past_roles": [f'{p.get("title")} at {p.get("name")}' for p in past
                       if isinstance(p, dict) and p.get("title") and p.get("name")],
    }


def run(cid, prompt, offering, sender, max_companies):
    try:
        set_status(cid, "running")
        for s in STEPS:
            log(cid, s, "pending")

        # 1. Interpret
        log(cid, STEPS[0], "running")
        icp = icp_mod.parse(prompt, offering)
        with db.conn() as c:
            c.execute("UPDATE campaigns SET icp_json=? WHERE id=?", (json.dumps(icp), cid))
        log(cid, STEPS[0], "done", f'{len(icp["titles"])} target roles; query "{icp["company_query"]}"')

        # 2. Discover companies
        log(cid, STEPS[1], "running", "Querying Crustdata Company Search…")
        # Progressive relaxation: all filters -> without funding round -> ranked query only.
        attempts = [(icp_mod.company_filters(icp), "")]
        if icp.get("round_types"):
            attempts.append((icp_mod.company_filters(icp, with_rounds=False), " (no matches with funding-round filter; relaxed it)"))
        if attempts[-1][0]:
            attempts.append((None, " (no matches with hard filters; using ranked search only)"))
        raws, cached, note = [], False, ""
        for filters, why in attempts:
            try:
                res, cached = crustdata.search_companies(icp["company_query"], filters, limit=max_companies)
            except crustdata.CrustdataError as e:
                # Only a filter-related 400 justifies dropping filters; auth/permission/field errors must surface.
                msg = e.message.lower()
                if e.status == 400 and filters and ("condition" in msg or "filter" in msg):
                    note = f" (filter rejected by API: {e.message[:120]})"
                    continue
                raise
            raws = res.get("companies") or []
            if raws:
                note = note or why
                break
        companies = {}
        fetched = db.now()
        with db.conn() as c:
            for i, raw in enumerate(raws, 1):
                co = norm_company(raw, i)
                if not co["crustdata_id"] or not co["name"]:
                    continue
                cur = c.execute(
                    "INSERT INTO companies (campaign_id,crustdata_id,rank,data_json,raw_json,source,fetched_at)"
                    " VALUES (?,?,?,?,?,?,?)",
                    (cid, co["crustdata_id"], i, json.dumps(co), json.dumps(raw),
                     "Crustdata Company Search (cached)" if cached else "Crustdata Company Search", fetched))
                co["db_id"] = cur.lastrowid
                companies[co["crustdata_id"]] = co
        if not companies:
            log(cid, STEPS[1], "error", "No companies matched. Try broadening the request." + note)
            for s in STEPS[2:]:
                log(cid, s, "skipped")
            set_status(cid, "done", "No matching companies found.")
            return
        log(cid, STEPS[1], "done", f"{len(companies)} companies found{' (from cache)' if cached else ''}{note}")

        # 3. Find decision-makers
        log(cid, STEPS[2], "running", "Querying Crustdata Person Search…")
        ids = list(companies.keys())
        limit = min(len(ids) * MAX_PER_COMPANY * 2, 60)
        pres, pcached = crustdata.search_people(icp_mod.people_filters(icp, ids, by_title=True), limit=limit)
        profiles = pres.get("profiles") or []
        relaxed = False
        if not profiles:
            relaxed = True
            pres, pcached = crustdata.search_people(icp_mod.people_filters(icp, ids, by_title=False), limit=limit)
            profiles = pres.get("profiles") or []
        log(cid, STEPS[2], "done", f"{len(profiles)} profiles returned"
            + (" (no exact title matches; relaxed to seniority filter)" if relaxed else ""))

        # 4. Normalize
        log(cid, STEPS[3], "running")
        per_company, people, skipped = {}, [], 0
        for raw in profiles:
            p = norm_person(raw, companies.keys())
            co = companies.get(p["company_id"])
            if not co or not p["name"]:
                skipped += 1
                continue
            if per_company.get(co["crustdata_id"], 0) >= MAX_PER_COMPANY:
                continue
            per_company[co["crustdata_id"]] = per_company.get(co["crustdata_id"], 0) + 1
            people.append((p, co, raw))
        log(cid, STEPS[3], "done", f"{len(people)} prospects across {len(per_company)} companies"
            + (f"; {skipped} incomplete records dropped" if skipped else ""))

        # 5 + 6. Score, explain, draft
        log(cid, STEPS[4], "running")
        rows = []
        for p, co, raw in people:
            total, tier, breakdown = scoring.score(p, co, icp, len(companies))
            exp = scoring.explain(p, co, icp)
            rows.append((p, co, raw, total, tier, breakdown, exp))
        log(cid, STEPS[4], "done", f"{sum(1 for r in rows if r[4] == 'Hot')} hot, "
            f"{sum(1 for r in rows if r[4] == 'Warm')} warm, {sum(1 for r in rows if r[4] == 'Cold')} cold")

        log(cid, STEPS[5], "running")
        src = "Crustdata Person Search (cached)" if pcached else "Crustdata Person Search"
        with db.conn() as c:
            for p, co, raw, total, tier, breakdown, exp in rows:
                subj, body, hooks = scoring.draft(p, co, icp, sender)
                exp["draft_hooks"] = hooks
                p["tier"] = tier
                c.execute(
                    "INSERT INTO prospects (campaign_id,company_id,data_json,raw_json,score,breakdown_json,"
                    "explanation_json,draft_subject,draft_body,source,fetched_at,updated_at)"
                    " VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                    (cid, co["db_id"], json.dumps(p), json.dumps(raw), total, json.dumps(breakdown),
                     json.dumps(exp), subj, body, src, db.now(), db.now()))
        log(cid, STEPS[5], "done", f"{len(rows)} drafts ready for review. Nothing is sent automatically.")
        set_status(cid, "done")
    except crustdata.CrustdataError as e:
        _fail(cid, str(e))
    except Exception as e:  # keep partial results, surface the error
        traceback.print_exc()
        _fail(cid, f"{type(e).__name__}: {e}")


def _fail(cid, msg):
    with db.conn() as c:
        c.execute("UPDATE steps SET status='error', detail=? WHERE campaign_id=? AND status='running'", (msg, cid))
        c.execute("UPDATE steps SET status='skipped' WHERE campaign_id=? AND status='pending'", (cid,))
    set_status(cid, "error", msg)


def start(prompt, offering="", sender="", max_companies=10):
    with db.conn() as c:
        cur = c.execute("INSERT INTO campaigns (prompt,status,created_at,updated_at) VALUES (?,?,?,?)",
                        (prompt, "queued", db.now(), db.now()))
        cid = cur.lastrowid
    threading.Thread(target=run, args=(cid, prompt, offering, sender, max_companies), daemon=True).start()
    return cid
