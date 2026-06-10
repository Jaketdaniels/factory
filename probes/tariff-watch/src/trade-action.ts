import { z } from "zod";
import type { TradeDocument } from "./federal-register";

export const legalStatusSchema = z.enum([
	"proposed",
	"final",
	"effective",
	"stayed",
	"enjoined",
	"expired",
	"replaced",
	"appealed",
]);
export type LegalStatus = z.infer<typeof legalStatusSchema>;

export const confidenceSchema = z.enum(["low", "medium", "high"]);
export type Confidence = z.infer<typeof confidenceSchema>;

export const storedTradeActionRowSchema = z.object({
	document_number: z.string(),
	title: z.string(),
	doc_type: z.string(),
	abstract: z.string().nullable(),
	publication_date: z.string(),
	url: z.string(),
	agencies: z.string(),
	program: z.string(),
	legal_status: legalStatusSchema,
	effective_on: z.string().nullable(),
	comments_close_on: z.string().nullable(),
	hearing_on: z.string().nullable(),
	source_type: z.string(),
	source_id: z.string().nullable(),
	confidence: confidenceSchema,
});
export type StoredTradeActionRow = z.infer<typeof storedTradeActionRowSchema>;

export interface TradeActionMetadata {
	program: string;
	legalStatus: LegalStatus;
	effectiveOn: string | null;
	commentsCloseOn: string | null;
	hearingOn: string | null;
	sourceType: "federal_register";
	sourceId: string;
	confidence: Confidence;
}

export interface PublicTradeAction {
	abstract: string | null;
	agencies: string[];
	confidence: Confidence;
	document_number: string;
	effective_on: string | null;
	comments_close_on: string | null;
	hearing_on: string | null;
	legal_status: LegalStatus;
	program: string;
	publication_date: string;
	source: {
		id: string;
		type: string;
		url: string;
	};
	title: string;
	type: string;
	url: string;
}

export const TRADE_ACTION_COLUMNS =
	"document_number, title, doc_type, abstract, publication_date, url, agencies, program, legal_status, effective_on, comments_close_on, hearing_on, source_type, source_id, confidence";

const agenciesSchema = z.array(z.string()).catch([]);

export function parseAgencies(raw: string): string[] {
	return agenciesSchema.parse(JSON.parse(raw));
}

export function toPublicTradeAction(row: StoredTradeActionRow): PublicTradeAction {
	const sourceId = row.source_id ?? row.document_number;
	return {
		document_number: row.document_number,
		title: row.title,
		type: row.doc_type,
		abstract: row.abstract,
		publication_date: row.publication_date,
		url: row.url,
		agencies: parseAgencies(row.agencies),
		program: row.program,
		legal_status: row.legal_status,
		effective_on: row.effective_on,
		comments_close_on: row.comments_close_on,
		hearing_on: row.hearing_on,
		confidence: row.confidence,
		source: {
			id: sourceId,
			type: row.source_type,
			url: row.url,
		},
	};
}

export async function listTradeActions(
	db: D1Database,
	options: { since: string; limit: number },
): Promise<PublicTradeAction[]> {
	const { results } = await db
		.prepare(
			`SELECT ${TRADE_ACTION_COLUMNS} FROM tariff_documents WHERE publication_date >= ? ORDER BY publication_date DESC, document_number DESC LIMIT ?`,
		)
		.bind(options.since, options.limit)
		.all();
	return z.array(storedTradeActionRowSchema).parse(results).map(toPublicTradeAction);
}

export async function getTradeAction(db: D1Database, documentNumber: string): Promise<PublicTradeAction | null> {
	const row = await db
		.prepare(`SELECT ${TRADE_ACTION_COLUMNS} FROM tariff_documents WHERE document_number = ?`)
		.bind(documentNumber)
		.first();
	if (row === null) {
		return null;
	}
	return toPublicTradeAction(storedTradeActionRowSchema.parse(row));
}

/**
 * Hand-pinned metadata for specific documents whose docket facts (hearing
 * dates, comment deadlines) are stated in the notice text but not exposed as
 * Federal Register API fields. Keyed by exact document number only — never
 * matched by text — so future documents in the same docket can never inherit
 * another notice's dates.
 */
const PINNED_TRADE_ACTIONS: Record<
	string,
	{
		program: string;
		legalStatus: LegalStatus;
		commentsCloseOn: string | null;
		hearingOn: string | null;
		confidence: Confidence;
	}
> = {
	// USTR Section 301 forced-labor investigations notice (June 2026).
	"2026-11296": {
		program: "section_301_forced_labor",
		legalStatus: "proposed",
		commentsCloseOn: "2026-07-06",
		hearingOn: "2026-07-07",
		confidence: "high",
	},
};

export const PINNED_DOCUMENT_NUMBERS = Object.keys(PINNED_TRADE_ACTIONS);

export function classifyTradeDocument(doc: TradeDocument): TradeActionMetadata {
	const normalizedText = [doc.title, doc.abstract ?? "", doc.docType, ...doc.agencies].join(" ").toLowerCase();
	const inferred: TradeActionMetadata = {
		program: inferProgram(normalizedText),
		legalStatus: inferLegalStatus(doc),
		// Dates come only from source-supplied fields: scraping dates out of
		// abstract text would fabricate facts on documents that mention them.
		effectiveOn: doc.effectiveOn ?? null,
		commentsCloseOn: doc.commentsCloseOn ?? null,
		hearingOn: null,
		sourceType: "federal_register",
		sourceId: doc.documentNumber,
		confidence: "medium",
	};
	const pinned = PINNED_TRADE_ACTIONS[doc.documentNumber];
	if (pinned === undefined) {
		return inferred;
	}
	return {
		...inferred,
		program: pinned.program,
		legalStatus: pinned.legalStatus,
		// A source-supplied date still wins; the pin only fills API gaps.
		commentsCloseOn: inferred.commentsCloseOn ?? pinned.commentsCloseOn,
		hearingOn: pinned.hearingOn,
		confidence: pinned.confidence,
	};
}

function inferProgram(normalizedText: string): string {
	if (normalizedText.includes("section 301") && normalizedText.includes("forced labor")) {
		return "section_301_forced_labor";
	}
	if (normalizedText.includes("section 301")) {
		return "section_301";
	}
	if (normalizedText.includes("section 232")) {
		return "section_232";
	}
	if (normalizedText.includes("antidumping") || normalizedText.includes("countervailing")) {
		return "trade_remedies";
	}
	if (normalizedText.includes("de minimis")) {
		return "de_minimis";
	}
	if (normalizedText.includes("foreign-trade zone")) {
		return "foreign_trade_zones";
	}
	return "trade_action";
}

/**
 * Status is inferred only from signals the source reliably carries: the
 * document type and the effective date. Court-driven statuses (stayed,
 * enjoined, appealed, expired) are never inferred from text — keyword matches
 * over abstracts mislabel routine notices (sunset reviews mention expiry,
 * AD/CVD notices request comments). Those statuses enter via pinned metadata
 * until a docket-level source exists.
 */
function inferLegalStatus(doc: TradeDocument): LegalStatus {
	if (doc.docType.toLowerCase().includes("proposed")) {
		return "proposed";
	}
	if (doc.effectiveOn !== undefined && doc.effectiveOn !== null && doc.effectiveOn <= doc.publicationDate) {
		return "effective";
	}
	return "final";
}
