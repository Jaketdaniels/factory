-- Factory baseline schema: API keys, metering, billing provisioning, analytics.
CREATE TABLE api_keys (
	id TEXT PRIMARY KEY,
	key_hash TEXT NOT NULL UNIQUE,
	key_hint TEXT NOT NULL,
	plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
	monthly_quota INTEGER NOT NULL DEFAULT 100,
	status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
	email TEXT,
	stripe_customer_id TEXT,
	stripe_subscription_id TEXT,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE usage_events (
	id TEXT PRIMARY KEY,
	key_id TEXT NOT NULL REFERENCES api_keys(id),
	route TEXT NOT NULL,
	qty INTEGER NOT NULL DEFAULT 1,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_usage_events_key_month ON usage_events (key_id, created_at);

-- One row per Stripe Checkout Session. The webhook only RESERVES the session
-- (idempotent single insert); the API key is created lazily at claim time and
-- rendered straight from memory — no raw key is ever stored at rest.
CREATE TABLE provisioned_keys (
	checkout_session_id TEXT PRIMARY KEY,
	email TEXT,
	stripe_customer_id TEXT,
	stripe_subscription_id TEXT,
	key_id TEXT REFERENCES api_keys(id),
	claimed_at TEXT,
	-- Tombstone: set when customer.subscription.deleted arrives (possibly
	-- BEFORE the claim, since Stripe does not guarantee event ordering).
	revoked_at TEXT,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_provisioned_keys_subscription ON provisioned_keys (stripe_subscription_id);

CREATE TABLE analytics_events (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	props TEXT NOT NULL DEFAULT '{}',
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_analytics_events_name_time ON analytics_events (name, created_at);
