import { ApiError } from "@factory/core";
import { z } from "zod";

/**
 * Federal Register API client. US government works are public domain
 * (17 U.S.C. §105); the API is free and unauthenticated.
 */
const FR_BASE = "https://www.federalregister.gov/api/v1/documents.json";

/** Trade-relevant agencies: everything they publish is in scope. */
export const TRADE_AGENCY_SLUGS = [
	"trade-representative-office-of-united-states",
	"u-s-customs-and-border-protection",
	"international-trade-administration",
	"international-trade-commission",
	"industry-and-security-bureau",
	"foreign-trade-zones-board",
] as const;

const frDocumentSchema = z.object({
	document_number: z.string(),
	title: z.string(),
	type: z.string(),
	abstract: z.string().nullish(),
	publication_date: z.string(),
	html_url: z.string(),
	agency_names: z.array(z.string()).nullish(),
});

const frResponseSchema = z.object({
	count: z.number(),
	next_page_url: z.string().nullish(),
	results: z.array(frDocumentSchema).optional(),
});

export interface TradeDocument {
	documentNumber: string;
	title: string;
	docType: string;
	abstract: string | null;
	publicationDate: string;
	url: string;
	agencies: string[];
	sourceQuery: string;
}

const FIELDS = ["document_number", "title", "type", "abstract", "publication_date", "html_url", "agency_names"];
const MAX_PAGES_PER_QUERY = 5;

function buildQueryUrl(
	sinceDate: string,
	query: { agencies?: readonly string[]; term?: string; type?: string },
): string {
	const params = new URLSearchParams();
	params.set("conditions[publication_date][gte]", sinceDate);
	params.set("order", "newest");
	params.set("per_page", "100");
	for (const field of FIELDS) {
		params.append("fields[]", field);
	}
	for (const slug of query.agencies ?? []) {
		params.append("conditions[agencies][]", slug);
	}
	if (query.term !== undefined) {
		params.set("conditions[term]", query.term);
	}
	if (query.type !== undefined) {
		params.append("conditions[type][]", query.type);
	}
	return `${FR_BASE}?${params.toString()}`;
}

async function fetchPaged(firstUrl: string, sourceQuery: string): Promise<TradeDocument[]> {
	const docs: TradeDocument[] = [];
	let url: string | null = firstUrl;
	for (let page = 0; page < MAX_PAGES_PER_QUERY && url !== null; page++) {
		const response = await fetch(url, { headers: { accept: "application/json" } });
		if (!response.ok) {
			throw new ApiError(502, "federal_register_error", `Federal Register API returned ${response.status}.`);
		}
		const parsed = frResponseSchema.parse(await response.json());
		for (const doc of parsed.results ?? []) {
			docs.push({
				documentNumber: doc.document_number,
				title: doc.title,
				docType: doc.type,
				abstract: doc.abstract ?? null,
				publicationDate: doc.publication_date,
				url: doc.html_url,
				agencies: doc.agency_names ?? [],
				sourceQuery,
			});
		}
		url = parsed.next_page_url ?? null;
	}
	return docs;
}

/**
 * Fetch trade-relevant documents published on/after `sinceDate` (YYYY-MM-DD):
 * everything from the trade agencies, plus presidential documents matching
 * "tariff" (proclamations/EOs originate from the Executive Office, not the
 * trade agencies). Deduplicated by document number.
 */
export async function fetchTradeDocuments(sinceDate: string): Promise<TradeDocument[]> {
	const [agencyDocs, presidentialDocs] = await Promise.all([
		fetchPaged(buildQueryUrl(sinceDate, { agencies: TRADE_AGENCY_SLUGS }), "trade-agencies"),
		fetchPaged(buildQueryUrl(sinceDate, { term: "tariff", type: "PRESDOCU" }), "presidential-tariff"),
	]);
	const byNumber = new Map<string, TradeDocument>();
	for (const doc of [...agencyDocs, ...presidentialDocs]) {
		if (!byNumber.has(doc.documentNumber)) {
			byNumber.set(doc.documentNumber, doc);
		}
	}
	return [...byNumber.values()];
}
