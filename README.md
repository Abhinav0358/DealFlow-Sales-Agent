# DealFlow — Autonomous B2B BD desk

Natural-language ICP → Crustdata company + people discovery → deterministic, evidence-backed scoring → personalized drafts → human approval → CSV export. Nothing is ever sent automatically.

## Run
```bash
# backend (port 5000)
cd backend && python -m venv .venv && .venv/Scripts/pip install -r requirements.txt
cp .env.example .env   # set CRUSTDATA_API_KEY
.venv/Scripts/python app.py

# frontend (port 5173, proxies /api)
cd frontend && npm install && npm run dev
```

## How it works
`icp.py` rule-based request parser · `crustdata.py` API client (retry/backoff, SQLite response cache) · `pipeline.py` agent steps with live progress · `scoring.py` 100-pt deterministic score, facts vs. inferences, template drafts built only from verified fields.
