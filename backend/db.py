"""SQLite persistence (stdlib sqlite3, no ORM)."""
import json
import os
import sqlite3
from datetime import datetime, timezone

DB_PATH = os.path.join(os.path.dirname(__file__), "dealflow.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS api_cache (
  key TEXT PRIMARY KEY, path TEXT, response TEXT, fetched_at TEXT
);
CREATE TABLE IF NOT EXISTS campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT, prompt TEXT, icp_json TEXT,
  status TEXT, error TEXT, created_at TEXT, updated_at TEXT
);
CREATE TABLE IF NOT EXISTS steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT, campaign_id INTEGER, name TEXT,
  status TEXT, detail TEXT, ts TEXT
);
CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT, campaign_id INTEGER, crustdata_id INTEGER,
  rank INTEGER, data_json TEXT, raw_json TEXT, source TEXT, fetched_at TEXT
);
CREATE TABLE IF NOT EXISTS prospects (
  id INTEGER PRIMARY KEY AUTOINCREMENT, campaign_id INTEGER, company_id INTEGER,
  data_json TEXT, raw_json TEXT, score REAL, breakdown_json TEXT,
  explanation_json TEXT, draft_subject TEXT, draft_body TEXT,
  approval TEXT DEFAULT 'pending', source TEXT, fetched_at TEXT, updated_at TEXT
);
"""


def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def conn():
    c = sqlite3.connect(DB_PATH, timeout=30)
    c.row_factory = sqlite3.Row
    return c


def init():
    with conn() as c:
        c.executescript(SCHEMA)


def cache_get(key):
    with conn() as c:
        row = c.execute("SELECT response FROM api_cache WHERE key=?", (key,)).fetchone()
    return json.loads(row["response"]) if row else None


def cache_put(key, path, data):
    with conn() as c:
        c.execute(
            "INSERT OR REPLACE INTO api_cache VALUES (?,?,?,?)",
            (key, path, json.dumps(data), now()),
        )


init()
