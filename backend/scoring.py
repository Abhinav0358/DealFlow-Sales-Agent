"""Deterministic qualification scoring, explanations and outreach drafts.

Every point awarded cites the exact Crustdata field it came from. Facts are only ever copied from
records; inferences are labelled as such and name the fact they are based on.
"""
import re
from datetime import date, datetime

TIERS = [(70, "Hot"), (50, "Warm"), (0, "Cold")]
SENIORITY_PTS = {"cxo": 20, "owner / partner": 20, "vice president": 16, "director": 12,
                 "experienced manager": 6, "strategic": 6}


def _date(s):
    if not s:
        return None
    try:
        return datetime.fromisoformat(str(s)[:10]).date()
    except ValueError:
        return None


def _months_since(d):
    if not d:
        return None
    t = date.today()
    return (t.year - d.year) * 12 + (t.month - d.month)


def _growth_12m(company):
    g = company.get("growth_percent") or {}
    if isinstance(g, dict):
        for k in ("12m", "twelve_months", "yoy", "12_months"):
            if g.get(k) is not None:
                return g[k]
    return None


def score(person, company, icp, n_companies):
    items = []

    def add(name, pts, max_pts, reason, field=None):
        items.append({"criterion": name, "points": round(pts, 1), "max": max_pts,
                      "reason": reason, "field": field})

    title = (person.get("title") or "").lower()
    matched = next((t for t in icp["titles"] if all(w in title for w in t.lower().split())), None)
    if matched:
        add("Role match", 30, 30, f'Current title "{person["title"]}" matches target role "{matched}".',
            "experience.employment_details.current.title")
    elif person.get("title"):
        add("Role match", 10, 30, f'Title "{person["title"]}" is a related leadership role, not an exact target match.',
            "experience.employment_details.current.title")
    else:
        add("Role match", 0, 30, "Current title not available.", None)

    sen = (person.get("seniority") or "").lower()
    if sen:
        add("Seniority", SENIORITY_PTS.get(sen, 0), 20, f'Seniority level is "{person["seniority"]}".',
            "experience.employment_details.current.seniority_level")
    else:
        add("Seniority", 0, 20, "Seniority level not available.", None)

    rank = company.get("rank")
    if rank is not None and n_companies:
        pts = 20 * (1 - (rank - 1) / max(n_companies, 1))
        add("ICP relevance", pts, 20,
            f'Ranked #{rank} of {n_companies} by Crustdata hybrid search for "{icp["company_query"]}".',
            "company/search rank")
    else:
        add("ICP relevance", 10, 20, "Matched ICP filters (no ranking available).", None)

    hc = company.get("headcount")
    lo, hi = icp.get("headcount_min"), icp.get("headcount_max")
    if hc is None:
        add("Company size fit", 0, 15, "Headcount not available.", None)
    elif lo is None and hi is None:
        add("Company size fit", 15, 15, f"No size constraint in request; headcount is {hc:,}.", "headcount.total")
    elif (lo is None or hc >= lo) and (hi is None or hc <= hi):
        add("Company size fit", 15, 15, f"Headcount {hc:,} is within target range.", "headcount.total")
    else:
        add("Company size fit", 0, 15, f"Headcount {hc:,} is outside target range.", "headcount.total")

    g = _growth_12m(company)
    if g is None:
        add("Hiring momentum", 0, 10, "12-month headcount growth not available.", None)
    else:
        pts = 10 if g >= 20 else 6 if g >= 5 else 3 if g > 0 else 0
        add("Hiring momentum", pts, 10, f"Headcount changed {g:+.1f}% over 12 months.",
            "headcount.growth_percent")

    m = _months_since(_date(company.get("last_fundraise_date")))
    if m is None:
        add("Funding recency", 0, 5, "No fundraise date available.", None)
    else:
        pts = 5 if m <= 24 else 2 if m <= 48 else 0
        add("Funding recency", pts, 5, f"Last fundraise {m} months ago.", "funding.last_fundraise_date")

    total = round(sum(i["points"] for i in items))
    tier = next(t for cut, t in TIERS if total >= cut)
    return total, tier, items


def explain(person, company, icp):
    facts = []

    def fact(label, value, field, source):
        if value not in (None, "", []):
            facts.append({"label": label, "value": value, "field": field, "source": source})

    p_src, c_src = person.get("profile_url"), company.get("source_url")
    fact("Name", person.get("name"), "basic_profile.name", p_src)
    fact("Current title", person.get("title"), "experience.employment_details.current.title", p_src)
    fact("Seniority", person.get("seniority"), "experience.employment_details.current.seniority_level", p_src)
    fact("In role since", person.get("start_date"), "experience.employment_details.current.start_date", p_src)
    fact("Location", person.get("location"), "basic_profile.location", p_src)
    if person.get("past_roles"):
        fact("Previous roles", "; ".join(person["past_roles"][:3]), "experience.employment_details.past", p_src)
    fact("Company", company.get("name"), "basic_info.name", c_src)
    fact("Industry", company.get("industry"), "taxonomy.professional_network_industry", c_src)
    fact("Headcount", f'{company["headcount"]:,}' if company.get("headcount") is not None else None,
         "headcount.total", c_src)
    g = _growth_12m(company)
    fact("12-mo headcount growth", f"{g:+.1f}%" if g is not None else None, "headcount.growth_percent", c_src)
    fact("HQ", company.get("hq") or company.get("country"), "locations.headquarters", c_src)
    if company.get("total_funding"):
        fact("Total funding", f'${company["total_funding"]:,.0f}', "funding.total_investment_usd", c_src)
    fact("Last round", company.get("last_round_type"), "funding.last_round_type", c_src)
    fact("Last fundraise", company.get("last_fundraise_date"), "funding.last_fundraise_date", c_src)

    inferences = []
    tenure = _months_since(_date(person.get("start_date")))
    if tenure is not None and tenure <= 12:
        inferences.append({"text": f"New in role (~{tenure} months): new leaders often re-evaluate tooling and vendors.",
                           "based_on": "In role since"})
    if g is not None and g >= 10:
        inferences.append({"text": "Team is growing quickly, which suggests budget and scaling pains.",
                           "based_on": "12-mo headcount growth"})
    m = _months_since(_date(company.get("last_fundraise_date")))
    if m is not None and m <= 18:
        inferences.append({"text": "Recent fundraise suggests capacity to invest in new initiatives.",
                           "based_on": "Last fundraise"})
    if (person.get("seniority") or "").lower() in ("cxo", "owner / partner", "vice president"):
        inferences.append({"text": "Likely has budget authority or strong influence on purchasing.",
                           "based_on": "Seniority"})

    summary = f'{person.get("name") or "This contact"} is {person.get("title") or "a leader"} at {company.get("name")}'
    if company.get("headcount") is not None:
        summary += f' ({company["headcount"]:,} employees'
        summary += f', {company["industry"]})' if company.get("industry") else ")"
    summary += "."
    return {"summary": summary, "facts": facts, "inferences": inferences}


def draft(person, company, icp, sender=""):
    first = (person.get("name") or "").split(" ")[0] or "there"
    cname = company.get("name") or "your company"
    offering = icp.get("offering") or "what we're building"
    hooks_used = []

    tenure = _months_since(_date(person.get("start_date")))
    g = _growth_12m(company)
    m = _months_since(_date(company.get("last_fundraise_date")))
    if m is not None and m <= 18 and company.get("last_round_type"):
        rnd = re.sub(r"_", " ", str(company["last_round_type"])).title()
        hook = f"Congrats on {cname}'s {rnd} round."
        hooks_used.append("Last round")
    elif tenure is not None and tenure <= 12 and person.get("title"):
        hook = f"Congrats on stepping into the {person['title']} role at {cname}."
        hooks_used.append("In role since")
    elif g is not None and g >= 10:
        hook = f"I noticed {cname} has grown its team about {g:.0f}% over the past year."
        hooks_used.append("12-mo headcount growth")
    elif company.get("industry"):
        hook = f"I've been following teams in {company['industry']}, and {cname} stood out."
        hooks_used.append("Industry")
    else:
        hook = f"I came across {cname} while researching teams like yours."

    role_line = (f"As {person['title']}, you're likely the right person to weigh in on {offering}."
                 if person.get("title") else f"I thought {offering} could be relevant to {cname}.")
    body = (f"Hi {first},\n\n{hook} {role_line}\n\n"
            f"Would you be open to a 15-minute conversation next week to see if it's a fit?\n\n"
            f"Best,\n{sender or '[Your name]'}")
    subject = f"{cname} + {offering[:40]}" if icp.get("offering") else f"Quick question for {cname}"
    return subject, body, hooks_used
