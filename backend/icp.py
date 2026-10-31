"""Deterministic natural-language -> ICP parser. No LLM: regex + keyword tables, fully inspectable."""
import re

# Persona keyword -> canonical title fragments sent to Crustdata fuzzy title match "(.)"
PERSONAS = {
    r"\bctos?\b|chief technology": ["CTO", "Chief Technology Officer"],
    r"\bceos?\b|chief executive": ["CEO", "Chief Executive Officer"],
    r"\bfounders?\b|co-?founders?": ["Founder", "Co-Founder"],
    r"\bcmos?\b|chief marketing": ["CMO", "Chief Marketing Officer"],
    r"\bcros?\b|chief revenue": ["CRO", "Chief Revenue Officer"],
    r"\bcfos?\b|chief financial": ["CFO", "Chief Financial Officer"],
    r"\bcoos?\b|chief operating": ["COO", "Chief Operating Officer"],
    r"\bcisos?\b|chief information security": ["CISO", "Chief Information Security Officer"],
    r"\bcpos?\b|chief product": ["Chief Product Officer"],
    r"\bcios?\b|chief information officer": ["CIO", "Chief Information Officer"],
    r"engineering (leaders?|heads?|managers?|directors?)|vps? (of )?engineering|heads? of engineering": [
        "VP Engineering", "Head of Engineering", "Director of Engineering"],
    r"sales (leaders?|heads?|directors?)|vps? (of )?sales|heads? of sales": [
        "VP Sales", "Head of Sales", "Director of Sales"],
    r"marketing (leaders?|heads?|directors?)|vps? (of )?marketing|heads? of marketing": [
        "VP Marketing", "Head of Marketing", "Director of Marketing"],
    r"growth (leaders?|heads?)|heads? of growth|vps? (of )?growth": ["Head of Growth", "VP Growth"],
    r"product (leaders?|heads?)|vps? (of )?product|heads? of product": ["VP Product", "Head of Product"],
    r"data (leaders?|heads?)|heads? of data|vps? (of )?data": ["Head of Data", "VP Data"],
    r"security (leaders?|heads?)|heads? of security": ["Head of Security", "Director of Security"],
    r"\bhr\b|people (leaders?|ops)|heads? of people|talent": ["Head of People", "VP People", "Head of Talent"],
    r"revops|revenue operations": ["Head of Revenue Operations", "RevOps"],
    r"devops|platform (leaders?|teams?)|infrastructure (leaders?|heads?)": [
        "Head of Platform", "Head of Infrastructure", "VP Infrastructure"],
}

DEFAULT_TITLES = ["CEO", "Founder", "CTO"]

SENIORITY_FOR_TITLE = [
    (r"chief|\bc[etmfroi]o\b|ciso|founder", ["CXO", "Owner / Partner"]),
    (r"\bvp\b|vice president", ["Vice President"]),
    (r"head|director", ["Director", "Vice President"]),
]

COUNTRIES = {
    r"\b(us|usa|u\.s\.a?\.?|united states|america|american)\b": ("USA", "United States"),
}
# Non-USA geographies stay in the ranked-search query text (Crustdata ranks on them) rather than
# a hard filter whose exact value format we haven't verified.

SIZE_BUCKETS = [
    (r"\bearly[- ]stage|\bstartups?\b|small (companies|teams)", (None, 200)),
    (r"mid[- ]?market|mid[- ]?size", (200, 2000)),
    (r"\benterprises?\b|large (companies|enterprises)", (1000, None)),
]

FUNDING = r"\b(pre-?seed|seed|series [a-f]|recently (raised|funded)|vc[- ]backed|venture[- ]backed|funded)\b"

STRIP = [
    r"^\s*(find|get|show|list|discover|identify|give me|i need|i want|looking for)\b( me)?",
    r"\b(decision[- ]makers?|prospects?|leads?|contacts?|people|buyers?)\b",
    r"\b(to sell|to pitch|for outreach)\b.*$",
]


def _num(s):
    s = s.lower().replace(",", "")
    mult = 1000 if s.endswith("k") else 1
    return int(float(s.rstrip("k")) * mult)


def parse(prompt: str, offering: str = "") -> dict:
    text = prompt.strip()
    low = text.lower()
    notes = []

    titles = []
    for pat, t in PERSONAS.items():
        if re.search(pat, low):
            titles += [x for x in t if x not in titles]
    if not titles:
        titles = list(DEFAULT_TITLES)
        notes.append("No target role found in request; defaulted to CEO / Founder / CTO.")

    seniority = []
    for t in titles:
        for pat, levels in SENIORITY_FOR_TITLE:
            if re.search(pat, t.lower()):
                seniority += [s for s in levels if s not in seniority]

    country = None
    for pat, (filter_val, label) in COUNTRIES.items():
        if re.search(pat, low):
            country = {"filter": filter_val, "label": label}

    hc_min = hc_max = None
    m = re.search(r"(\d[\d,]*k?)\s*(?:-|to|–)\s*(\d[\d,]*k?)\s*(?:employees|people|staff|headcount|person)", low)
    if m:
        hc_min, hc_max = _num(m.group(1)), _num(m.group(2))
    else:
        m = re.search(r"(?:under|fewer than|less than|<|below|up to)\s*(\d[\d,]*k?)\s*(?:employees|people|staff)", low)
        if m:
            hc_max = _num(m.group(1))
        m = re.search(r"(?:over|more than|>|above|at least)\s*(\d[\d,]*k?)\s*(?:employees|people|staff)", low)
        if m:
            hc_min = _num(m.group(1))
    if hc_min is None and hc_max is None:
        for pat, (lo, hi) in SIZE_BUCKETS:
            if re.search(pat, low):
                hc_min, hc_max = lo, hi
                notes.append(f"Interpreted size keyword as headcount {lo or 0}–{hi or 'any'}.")
                break

    fm = re.search(FUNDING, low)
    funding_signal = fm.group(1) if fm else None

    # Company query for Crustdata hybrid ranking: drop persona/role words and size phrases.
    q = low
    for pat in STRIP + list(PERSONAS.keys()):
        q = re.sub(pat, " ", q)
    if country:
        for pat in COUNTRIES:
            q = re.sub(pat, " ", q)
    q = re.sub(r"(\d[\d,]*k?)\s*(?:-|to|–)?\s*(\d[\d,]*k?)?\s*(employees|people|staff|headcount)", " ", q)
    q = re.sub(r"\b(at|in|from|with|and|who|that|whose|of|the|a|an|for|based)\s*(?=\s|$)", " ", q)
    q = re.sub(r"[^\w\s&/+.-]", " ", q)
    q = re.sub(r"\s+", " ", q).strip(" .")
    company_query = q or text

    return {
        "company_query": company_query,
        "titles": titles,
        "seniority": seniority,
        "country": country,
        "headcount_min": hc_min,
        "headcount_max": hc_max,
        "funding_signal": funding_signal,
        "offering": offering.strip(),
        "notes": notes,
    }


def company_filters(icp):
    conds = []
    if icp.get("country"):
        conds.append({"field": "locations.country", "type": "=", "value": icp["country"]["filter"]})
    if icp.get("headcount_min") is not None:
        conds.append({"field": "headcount.total", "type": ">", "value": icp["headcount_min"] - 1})
    if icp.get("headcount_max") is not None:
        conds.append({"field": "headcount.total", "type": "<", "value": icp["headcount_max"] + 1})
    if not conds:
        return None
    return conds[0] if len(conds) == 1 else {"op": "and", "conditions": conds}


def people_filters(icp, company_ids, by_title=True):
    conds = [{"field": "experience.employment_details.current.company_id", "type": "in", "value": company_ids}]
    if by_title:
        conds.append({"op": "or", "conditions": [
            {"field": "experience.employment_details.current.title", "type": "(.)", "value": t}
            for t in icp["titles"]
        ]})
    else:
        levels = icp.get("seniority") or ["CXO", "Vice President", "Director", "Owner / Partner"]
        conds.append({"field": "experience.employment_details.current.seniority_level", "type": "in",
                      "value": levels})
    return {"op": "and", "conditions": conds}
