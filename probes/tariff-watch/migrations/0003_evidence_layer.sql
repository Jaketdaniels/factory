-- Evidence-layer fields: source-first trade-action metadata, legal status,
-- effective/deadline dates, and stable source identifiers for agent outputs.
ALTER TABLE tariff_documents ADD COLUMN program TEXT NOT NULL DEFAULT 'trade_action';
ALTER TABLE tariff_documents ADD COLUMN legal_status TEXT NOT NULL DEFAULT 'final';
ALTER TABLE tariff_documents ADD COLUMN effective_on TEXT;
ALTER TABLE tariff_documents ADD COLUMN comments_close_on TEXT;
ALTER TABLE tariff_documents ADD COLUMN hearing_on TEXT;
ALTER TABLE tariff_documents ADD COLUMN source_type TEXT NOT NULL DEFAULT 'federal_register';
ALTER TABLE tariff_documents ADD COLUMN source_id TEXT;
ALTER TABLE tariff_documents ADD COLUMN confidence TEXT NOT NULL DEFAULT 'medium';

CREATE INDEX idx_tariff_documents_program ON tariff_documents (program);
CREATE INDEX idx_tariff_documents_status ON tariff_documents (legal_status);
CREATE INDEX idx_tariff_documents_effective ON tariff_documents (effective_on);
CREATE INDEX idx_tariff_documents_comments_close ON tariff_documents (comments_close_on);
CREATE INDEX idx_tariff_documents_hearing ON tariff_documents (hearing_on);
