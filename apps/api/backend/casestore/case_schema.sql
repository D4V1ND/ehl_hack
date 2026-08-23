PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS cases (
    case_id TEXT PRIMARY KEY,
    part_id TEXT NOT NULL,
    incident_json TEXT NOT NULL,
    part_json TEXT NOT NULL,
    profile_json TEXT NOT NULL,
    supplier_records_json TEXT NOT NULL,
    opened_at TEXT NOT NULL,
    stage TEXT NOT NULL,
    run_revision INTEGER NOT NULL DEFAULT 0,
    runner_kind TEXT NOT NULL DEFAULT 'deterministic',
    runner_id TEXT,
    runner_url TEXT,
    runner_error TEXT
);

CREATE TABLE IF NOT EXISTS candidates (
    case_id TEXT NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
    supplier_ref TEXT NOT NULL,
    position INTEGER NOT NULL,
    candidate_json TEXT NOT NULL,
    PRIMARY KEY (case_id, supplier_ref)
);

CREATE TABLE IF NOT EXISTS outreach_tasks (
    task_id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
    supplier_ref TEXT NOT NULL,
    round INTEGER NOT NULL,
    status TEXT NOT NULL,
    task_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS claims (
    case_id TEXT NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
    task_id TEXT NOT NULL,
    supplier_ref TEXT NOT NULL,
    round INTEGER NOT NULL,
    received_at TEXT,
    claim_json TEXT NOT NULL,
    PRIMARY KEY (case_id, task_id, round)
);

CREATE TABLE IF NOT EXISTS decisions (
    case_id TEXT PRIMARY KEY REFERENCES cases(case_id) ON DELETE CASCADE,
    revision INTEGER NOT NULL,
    status TEXT NOT NULL,
    decision_json TEXT NOT NULL,
    approved_at TEXT,
    approved_by TEXT
);

CREATE TABLE IF NOT EXISTS events (
    case_id TEXT NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
    seq INTEGER NOT NULL,
    ts TEXT NOT NULL,
    event_json TEXT NOT NULL,
    PRIMARY KEY (case_id, seq)
);

CREATE INDEX IF NOT EXISTS idx_cases_opened_at ON cases(opened_at DESC, case_id ASC);
CREATE INDEX IF NOT EXISTS idx_events_case_seq ON events(case_id, seq);
