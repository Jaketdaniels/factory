-- Tariff-watch domain tables: normalized facts derived from public-domain
-- Federal Register data (17 U.S.C. §105). We store our OWN derived fields +
-- the source URL — never third-party article text.
CREATE TABLE tariff_documents (
	document_number TEXT PRIMARY KEY,
	title TEXT NOT NULL,
	doc_type TEXT NOT NULL,
	abstract TEXT,
	publication_date TEXT NOT NULL,
	url TEXT NOT NULL,
	agencies TEXT NOT NULL DEFAULT '[]',
	source_query TEXT NOT NULL,
	fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_tariff_documents_pubdate ON tariff_documents (publication_date);

-- Immutable dated digests (insert-only by convention; same-day re-ingests
-- replace that day's snapshot, past days are never rewritten).
CREATE TABLE snapshots (
	snapshot_date TEXT PRIMARY KEY,
	markdown TEXT NOT NULL,
	entry_count INTEGER NOT NULL,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
