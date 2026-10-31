"""Thin Crustdata client: auth, retry/backoff, and a SQLite response cache to save credits."""
import hashlib
import json
import os
import time

import requests
from dotenv import load_dotenv

import db

BASE_URL = "https://api.crustdata.com"
API_VERSION = "2025-11-01"


KIND = {400: "invalid request (schema/filter)", 401: "authentication failed (check API key)",
        403: "permission denied or insufficient credits", 429: "rate limited"}


class CrustdataError(Exception):
    def __init__(self, status, message):
        self.status = status
        self.kind = KIND.get(status, "server error" if status >= 500 else "network error" if status == 0 else "error")
        self.message = message
        super().__init__(f"Crustdata {status} ({self.kind}): {message}")


def _error_message(r):
    """Company API nests {error:{message}}, 401s use top-level message, Person API may use reason."""
    try:
        d = r.json()
    except ValueError:
        return r.text[:500]
    err = d.get("error") if isinstance(d, dict) else None
    if isinstance(err, dict):
        return err.get("message") or err.get("reason") or str(err)[:500]
    if isinstance(d, dict):
        return d.get("message") or d.get("reason") or d.get("description") or err or str(d)[:500]
    return str(d)[:500]


# Every field below is listed as enabled for our key by GET /account/endpoints (verified 2026-10-31).
# basic_info.industries is filter-only; industry is returned via taxonomy.professional_network_industries.
COMPANY_FIELDS = [
    "crustdata_company_id",
    "basic_info.name",
    "basic_info.primary_domain",
    "basic_info.website",
    "basic_info.professional_network_url",
    "basic_info.year_founded",
    "basic_info.description",
    "basic_info.employee_count_range",
    "taxonomy.professional_network_industry",
    "taxonomy.professional_network_industries",
    "locations.country",
    "locations.headquarters",
    "headcount.total",
    "headcount.growth_percent",
    "funding.total_investment_usd",
    "funding.last_round_type",
    "funding.last_round_amount_usd",
    "funding.last_fundraise_date",
    "metadata.updated_at",
]

PERSON_FIELDS = [
    "crustdata_person_id",
    "basic_profile.name",
    "basic_profile.headline",
    "basic_profile.location",
    "social_handles.professional_network_identifier.profile_url",
    "experience.employment_details.current.title",
    "experience.employment_details.current.name",
    "experience.employment_details.current.crustdata_company_id",
    "experience.employment_details.current.company_website",
    "experience.employment_details.current.seniority_level",
    "experience.employment_details.current.start_date",
    "experience.employment_details.past.title",
    "experience.employment_details.past.name",
    "metadata.updated_at",
]


def _post(path, body, use_cache=True):
    key = hashlib.sha256((path + json.dumps(body, sort_keys=True)).encode()).hexdigest()
    if use_cache:
        cached = db.cache_get(key)
        if cached is not None:
            return cached, True

    token = os.getenv("CRUSTDATA_API_KEY", "").strip()
    if not token:  # pick up a key added to .env after startup
        load_dotenv(os.path.join(os.path.dirname(__file__), ".env"), override=True)
        token = os.getenv("CRUSTDATA_API_KEY", "").strip()
    if not token:
        raise CrustdataError(401, "CRUSTDATA_API_KEY is not set in backend/.env")
    headers = {
        "Authorization": f"Bearer {token}",
        "x-api-version": API_VERSION,
        "content-type": "application/json",
    }
    delay = 2
    for attempt in range(5):
        try:
            r = requests.post(BASE_URL + path, json=body, headers=headers, timeout=60)
        except requests.RequestException as e:
            if attempt == 4:
                raise CrustdataError(0, f"network error: {e}")
            time.sleep(delay)
            delay *= 2
            continue
        if r.status_code == 429 or r.status_code >= 500:
            if attempt == 4:
                raise CrustdataError(r.status_code, _error_message(r))
            time.sleep(float(r.headers.get("retry-after", delay)))
            delay *= 2
            continue
        if not r.ok:
            raise CrustdataError(r.status_code, _error_message(r))
        data = r.json()
        db.cache_put(key, path, data)
        return data, False
    raise CrustdataError(0, "retries exhausted")


def search_companies(query=None, filters=None, limit=10, fields=COMPANY_FIELDS):
    body = {"fields": fields, "limit": limit}
    if query:
        body["search"] = {"query": query, "mode": "hybrid"}
    if filters:
        body["filters"] = filters
    return _post("/company/search", body)


def search_people(filters, limit=30, fields=PERSON_FIELDS):
    body = {"filters": filters, "fields": fields, "limit": limit}
    return _post("/person/search", body)
