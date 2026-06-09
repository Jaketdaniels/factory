import { z } from "zod";
import { fetchTradeDocuments, type TradeDocument } from "./federal-register";

export interface IngestResult {
	fetched: number;
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

const storedDocSchema = z.object({
	document_number: z.string(),
	title: z.string(),
	doc_type: z.string(),
	abstract: z.string().nullable(),
	publication_date: z.string(),
	url: z.string(),
	agencies: z.string(),
});
type StoredDoc = z.infer<typeof storedDocSchema>;

async function insertDocuments(db: D1Database, docs: TradeDocument[]): Promise<number> {
	let inserted = 0;
	for (let i = 0; i < docs.length; i += BATCH_SIZE) {
		const chunk = docs.slice(i, i + BATCH_SIZE);
		const statements = chunk.map((doc) =>
			db
				.prepare(
					"INSERT INTO tariff_documents (document_number, title, doc_type, abstract, publication_date, url, agencies, source_query) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(document_number) DO NOTHING",
				)
				.bind(
					doc.documentNumber,
					doc.title,
					doc.docType,
					doc.abstract,
					doc.publicationDate,
					doc.url,
					JSON.stringify(doc.agencies),
					doc.sourceQuery,
				),
		);
		const results = await db.batch(statements);
		for (const result of results) {
			inserted += result.meta.changes;
		}
	}
	return inserted;
}

function truncate(text: string, max = 280): string {
	return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

function renderSnapshotMarkdown(snapshotDate: string, sinceDate: string, docs: StoredDoc[]): string {
	const lines: string[] = [
		`# US Tariff & Trade-Action Changelog — ${snapshotDate}`,
		"",
		`Facts-only digest of trade-relevant US federal publications: everything from USTR, CBP, the International Trade Administration, the International Trade Commission, the Bureau of Industry and Security, and the Foreign-Trade Zones Board, plus presidential tariff documents. Window: ${sinceDate} to ${snapshotDate}. Entries: ${docs.length}.`,
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
		const agencies = z.array(z.string()).catch([]).parse(JSON.parse(doc.agencies));
		const agencyText = agencies.length > 0 ? ` — ${agencies.join(", ")}` : "";
		lines.push(`- **[${doc.doc_type}]** ${doc.title}${agencyText}. [${doc.document_number}](${doc.url})`);
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

/**
 * Daily job: pull trade documents from the Federal Register (3-day look-back
 * so late postings and missed runs self-heal), insert new ones idempotently,
 * and regenerate today's snapshot over a 7-day window.
 */
export async function runIngest(env: Env, now: Date): Promise<IngestResult> {
	const snapshotDate = isoDate(now);
	const fetchSince = daysBefore(now, LOOKBACK_DAYS);
	const docs = await fetchTradeDocuments(fetchSince);
	const inserted = await insertDocuments(env.DB, docs);

	const windowStart = daysBefore(now, SNAPSHOT_WINDOW_DAYS);
	const { results } = await env.DB.prepare(
		"SELECT document_number, title, doc_type, abstract, publication_date, url, agencies FROM tariff_documents WHERE publication_date >= ? ORDER BY publication_date DESC, document_number DESC",
	)
		.bind(windowStart)
		.all();
	const windowDocs = z.array(storedDocSchema).parse(results);
	const markdown = renderSnapshotMarkdown(snapshotDate, windowStart, windowDocs);
	await env.DB.prepare(
		"INSERT INTO snapshots (snapshot_date, markdown, entry_count) VALUES (?, ?, ?) ON CONFLICT(snapshot_date) DO UPDATE SET markdown = excluded.markdown, entry_count = excluded.entry_count",
	)
		.bind(snapshotDate, markdown, windowDocs.length)
		.run();

	return { fetched: docs.length, inserted, snapshotDate, snapshotEntryCount: windowDocs.length };
}
