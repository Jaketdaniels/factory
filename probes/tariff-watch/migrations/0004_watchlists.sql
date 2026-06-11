-- Watchlists: per-key subscriptions to programs or agencies, alerted on new
-- documents by email and optional HMAC-signed webhook. alert_events is the
-- idempotence ledger (one alert per watchlist x document x channel, ever).
CREATE TABLE watchlists (
	id TEXT PRIMARY KEY,
	key_id TEXT NOT NULL REFERENCES api_keys(id),
	kind TEXT NOT NULL CHECK (kind IN ('program', 'agency')),
	value TEXT NOT NULL,
	webhook_url TEXT,
	webhook_secret TEXT,
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	UNIQUE (key_id, kind, value)
);
CREATE INDEX idx_watchlists_key ON watchlists (key_id);
CREATE INDEX idx_watchlists_kind_value ON watchlists (kind, value);

CREATE TABLE alert_events (
	id TEXT PRIMARY KEY,
	watchlist_id TEXT NOT NULL REFERENCES watchlists(id),
	document_number TEXT NOT NULL,
	channel TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	UNIQUE (watchlist_id, document_number, channel)
);

-- Plan chosen at checkout ('payg' usage-only, 'standing' $29/mo with included
-- calls + alerting). Existing reservations default to payg.
ALTER TABLE provisioned_keys ADD COLUMN plan TEXT NOT NULL DEFAULT 'payg';
