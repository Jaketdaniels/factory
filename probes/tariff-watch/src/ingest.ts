import { z } from "zod";
import { fetchTradeDocuments, type TradeDocument } from "./federal-register";
import { classifyTradeDocument, parseAgencies, storedTradeActionRowSchema, TRADE_ACTION_COLUMNS } from "./trade-action";

export interface IngestResult {
	fetched: number;
	/** Rows written: newly inserted plus corrected/reclassified. */
	inserted: number;
	snapshotDate: string;
	snapshotEntryCount: number;
}

const LOOKBACK_DAYS = 3;
const SNAPSHOT_WINDOW_DAYS = 7;
const BATCH_SIZE = 40;

export function isoDate(date: Date): string {
	return date.toISOString().slice(0, 10);
}

function daysBefore(date: Date, days: number): string {
	return isoDate(new Date(date.getTime() - days * 86_400_000));
}

type StoredDoc = z.infer<typeof storedTradeActionRowSchema>;

/**
 * Upsert: source corrections and reclassifications (after classifier changes)
 * propagate to stored rows. The WHERE guard keeps unchanged re-runs at zero
 * `meta.changes`, so ingest stays observably idempotent. `publication_date`
 * is identity for ordering/snapshots and is never rewritten.
 */
const UPSERT_DOCUMENT_SQL = `INSERT INTO tariff_documents (document_number, title, doc_type, abstract, publication_date, url, agencies, source_query, program, legal_status, effective_on, comments_close_on, hearing_on, source_type, source_id, confidence)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(document_number) DO UPDATE SET
	title = excluded.title,
	doc_type = excluded.doc_type,
	abstract = excluded.abstract,
	url = excluded.url,
	agencies = excluded.agencies,
	program = excluded.program,
	legal_status = excluded.legal_status,
	effective_on = excluded.effective_on,
	comments_close_on = excluded.comments_close_on,
	hearing_on = excluded.hearing_on,
	source_type = excluded.source_type,
	source_id = excluded.source_id,
	confidence = excluded.confidence
WHERE tariff_documents.title IS NOT excluded.title
	OR tariff_documents.doc_type IS NOT excluded.doc_type
	OR tariff_documents.abstract IS NOT excluded.abstract
	OR tariff_documents.url IS NOT excluded.url
	OR tariff_documents.agencies IS NOT excluded.agencies
	OR tariff_documents.program IS NOT excluded.program
	OR tariff_documents.legal_status IS NOT excluded.legal_status
	OR tariff_documents.effective_on IS NOT excluded.effective_on
	OR tariff_documents.comments_close_on IS NOT excluded.comments_close_on
	OR tariff_documents.hearing_on IS NOT excluded.hearing_on
	OR tariff_documents.source_type IS NOT excluded.source_type
	OR tariff_documents.source_id IS NOT excluded.source_id
	OR tariff_documents.confidence IS NOT excluded.confidence`;

async function upsertDocuments(db: D1Database, docs: TradeDocument[]): Promise<number> {
	let written = 0;
	for (let i = 0; i < docs.length; i += BATCH_SIZE) {
		const chunk = docs.slice(i, i + BATCH_SIZE);
		const statements = chunk.map((doc) => {
			const metadata = classifyTradeDocument(doc);
			return db
				.prepare(UPSERT_DOCUMENT_SQL)
				.bind(
					doc.documentNumber,
					doc.title,
					doc.docType,
					doc.abstract,
					doc.publicationDate,
					doc.url,
					JSON.stringify(doc.agencies),
					doc.sourceQuery,
					metadata.program,
					metadata.legalStatus,
					metadata.effectiveOn,
					metadata.commentsCloseOn,
					metadata.hearingOn,
					metadata.sourceType,
					metadata.sourceId,
					metadata.confidence,
				);
		});
		const results = await db.batch(statements);
		for (const result of results) {
			written += result.meta.changes;
		}
	}
	return written;
}

function truncate(text: string, max = 280): string {
	return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

function renderSnapshotMarkdown(snapshotDate: string, sinceDate: string, docs: StoredDoc[], generatedAt: Date): string {
	const lines: string[] = [
		`# US Tariff & Trade-Action Changelog — ${snapshotDate}`,
		"",
		`Facts-only digest of trade-relevant US federal publications: everything from USTR, CBP, the International Trade Administration, the International Trade Commission, the Bureau of Industry and Security, and the Foreign-Trade Zones Board, plus presidential tariff documents. Window: ${sinceDate} to ${snapshotDate}. Entries: ${docs.length}.`,
		"",
		`Last checked: ${generatedAt.toISOString().slice(0, 16).replace("T", " ")} UTC (sources are polled four times daily).`,
		"",
		"Source: Federal Register (US government work, public domain). Every entry links to the primary document. This snapshot is immutable once its date has passed; fetch /snapshot/latest.md for the newest.",
		"",
	];
	let currentDate = "";
	for (const doc of docs) {
		if (doc.publication_date !== currentDate) {
			currentDate = doc.publication_date;
			lines.push(`## ${currentDate}`, "");
		}
		const agencies = parseAgencies(doc.agencies);
		const agencyText = agencies.length > 0 ? ` — ${agencies.join(", ")}` : "";
		lines.push(`- **[${doc.doc_type}]** ${doc.title}${agencyText}. [${doc.document_number}](${doc.url})`);
		lines.push(`  - Program: ${doc.program}; status: ${doc.legal_status}; confidence: ${doc.confidence}.`);
		if (doc.effective_on !== null) {
			lines.push(`  - Effective: ${doc.effective_on}`);
		}
		if (doc.comments_close_on !== null) {
			lines.push(`  - Comment deadline: ${doc.comments_close_on}`);
		}
		if (doc.hearing_on !== null) {
			lines.push(`  - Hearing: ${doc.hearing_on}`);
		}
		if (doc.abstract !== null && doc.abstract.length > 0) {
			lines.push(`  - ${truncate(doc.abstract)}`);
		}
	}
	if (docs.length === 0) {
		lines.push("_No trade-relevant documents published in this window._");
	}
	lines.push("");
	return lines.join("\n");
}

export interface IngestOptions {
	/**
	 * Override the fetch window start (YYYY-MM-DD). Used by the admin backfill
	 * to re-pull and reclassify historical rows after classifier changes.
	 */
	sinceDate?: string | undefined;
}

/**
 * Daily job: pull trade documents from the Federal Register (3-day look-back
 * so late postings and missed runs self-heal), upsert them idempotently,
 * and regenerate today's snapshot over a 7-day window.
 */
export async function runIngest(env: Env, now: Date, options: IngestOptions = {}): Promise<IngestResult> {
	const snapshotDate = isoDate(now);
	const fetchSince = options.sinceDate ?? daysBefore(now, LOOKBACK_DAYS);
	const docs = await fetchTradeDocuments(fetchSince);
	const inserted = await upsertDocuments(env.DB, docs);

	const windowStart = daysBefore(now, SNAPSHOT_WINDOW_DAYS);
	const { results } = await env.DB.prepare(
		`SELECT ${TRADE_ACTION_COLUMNS} FROM tariff_documents WHERE publication_date >= ? ORDER BY publication_date DESC, document_number DESC`,
	)
		.bind(windowStart)
		.all();
	const windowDocs = z.array(storedTradeActionRowSchema).parse(results);
	const markdown = renderSnapshotMarkdown(snapshotDate, windowStart, windowDocs, now);
	await env.DB.prepare(
		"INSERT INTO snapshots (snapshot_date, markdown, entry_count) VALUES (?, ?, ?) ON CONFLICT(snapshot_date) DO UPDATE SET markdown = excluded.markdown, entry_count = excluded.entry_count",
	)
		.bind(snapshotDate, markdown, windowDocs.length)
		.run();

	return { fetched: docs.length, inserted, snapshotDate, snapshotEntryCount: windowDocs.length };
}
