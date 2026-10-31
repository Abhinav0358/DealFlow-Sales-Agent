"""Milestone 0 smoke test: one tiny company search + one tiny person search (~1 credit)."""
import json

from dotenv import load_dotenv

load_dotenv()
import crustdata  # noqa: E402

companies, cached = crustdata.search_companies(
    query="B2B SaaS companies selling developer tools",
    filters={"field": "locations.country", "type": "=", "value": "USA"},
    limit=3,
)
print("COMPANIES (cached=%s)" % cached)
print(json.dumps(companies, indent=2)[:3000])

ids = [c["crustdata_company_id"] for c in companies.get("companies", [])]
people, cached = crustdata.search_people(
    filters={
        "op": "and",
        "conditions": [
            {"field": "experience.employment_details.current.company_id", "type": "in", "value": ids},
            {"field": "experience.employment_details.current.seniority_level", "type": "in",
             "value": ["CXO", "Vice President", "Director"]},
        ],
    },
    limit=3,
)
print("PEOPLE (cached=%s)" % cached)
print(json.dumps(people, indent=2)[:3000])
