-- FeedItemV1 storage: one row per change event, matching the published netm8
-- contract (https://netm8.com/standards/feed-item-v1.schema.json). Hot query
-- keys are columns; the full validated record lives in item (JSON).
CREATE TABLE feed_items (
	id TEXT PRIMARY KEY,
	source_id TEXT,
	category TEXT NOT NULL,
	state TEXT NOT NULL CHECK (
		state IN ('new', 'updated', 'scheduled', 'effective', 'superseded', 'withdrawn', 'corrected', 'archived')
	),
	change_type TEXT NOT NULL,
	title TEXT NOT NULL,
	published_at TEXT NOT NULL,
	effective_at TEXT,
	detected_at TEXT NOT NULL,
	snapshot_hash TEXT,
	item TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_feed_items_category_published ON feed_items (category, published_at DESC);
CREATE INDEX idx_feed_items_state ON feed_items (state);
CREATE INDEX idx_feed_items_source ON feed_items (source_id);
