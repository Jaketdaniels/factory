import { z } from "zod";
import type { FeedItemV1 } from "./feed-item";

/**
 * openFDA enforcement reports (food, drug, device): documented public-domain
 * JSON API (US federal work, 17 U.S.C. §105), stable recall_number ids,
 * weekly publication with trickling updates.
 * Docs: https://open.fda.gov/apis/food/enforcement/
 */

export const PRODUCT_TYPES = ["food", "drug", "device"] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

const enforcementRecordSchema = z.object({
	recall_number: z.string().min(1),
	event_id: z.string().optional(),
	status: z.string(),
	classification: z.string(),
	product_type: z.string().optional(),
	product_description: z.string(),
	reason_for_recall: z.string(),
	recalling_firm: z.string(),
	distribution_pattern: z.string().optional(),
	recall_initiation_date: z.string().optional(),
	center_classification_date: z.string().optional(),
	report_date: z.string(),
	voluntary_mandated: z.string().optional(),
	state: z.string().optional(),
	country: z.string().optional(),
});
export type EnforcementRecord = z.infer<typeof enforcementRecordSchema>;

const responseSchema = z.object({
	results: z.array(z.unknown()).default([]),
});

export interface FetchedEnforcement {
	productType: ProductType;
	records: EnforcementRecord[];
	/** The raw response bytes, archived per the provenance contract. */
	rawBody: ArrayBuffer;
}

function yyyymmdd(date: Date): string {
	return date.toISOString().slice(0, 10).replaceAll("-", "");
}

/** Fetch recent enforcement reports for one product type (report_date window). */
export async function fetchEnforcement(
	productType: ProductType,
	since: Date,
	until: Date,
): Promise<FetchedEnforcement> {
	const search = encodeURIComponent(`report_date:[${yyyymmdd(since)} TO ${yyyymmdd(until)}]`);
	const url = `https://api.fda.gov/${productType}/enforcement.json?search=${search}&sort=report_date:desc&limit=100`;
	const response = await fetch(url, { headers: { "user-agent": "netm8-recalls/1.0 (hello@netm8.com)" } });
	// openFDA 404s when the window has no records — an empty week, not an error.
	if (response.status === 404) {
		return { productType, records: [], rawBody: new ArrayBuffer(0) };
	}
	if (!response.ok) {
		throw new Error(`openFDA ${productType} responded ${response.status}`);
	}
	const rawBody = await response.arrayBuffer();
	const parsed = responseSchema.parse(JSON.parse(new TextDecoder().decode(rawBody)));
	const records: EnforcementRecord[] = [];
	for (const result of parsed.results) {
		const record = enforcementRecordSchema.safeParse(result);
		if (record.success) {
			records.push(record.data);
		}
	}
	return { productType, records, rawBody };
}

function isoFromCompact(value: string | undefined): string | null {
	if (value === undefined || !/^\d{8}$/.test(value)) {
		return null;
	}
	return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T00:00:00Z`;
}

/** Recall lifecycle → contract state; recall class → change severity. */
function stateFor(status: string): FeedItemV1["status"]["state"] {
	const normalized = status.toLowerCase();
	if (normalized.includes("terminated") || normalized.includes("completed")) {
		return "archived";
	}
	return "effective";
}

function severityFor(classification: string): "critical" | "major" | "minor" {
	if (classification.includes("I") && !classification.includes("II")) {
		return "critical";
	}
	return classification.includes("III") ? "minor" : "major";
}

/**
 * Map one enforcement record to the netm8 contract. The event id carries the
 * status, so a recall moving Ongoing -> Terminated records a second event
 * instead of silently mutating the first (delta detection by identity).
 */
export function toChangeEvent(
	record: EnforcementRecord,
	productType: ProductType,
	now: Date,
	baseUrl: string,
): Omit<FeedItemV1, "provenance" | "raw"> & { provenance: Omit<FeedItemV1["provenance"], "snapshot_hash"> } {
	const state = stateFor(record.status);
	const id = `${productType}-${record.recall_number}-${state}`;
	const sourceUrl = `https://api.fda.gov/${productType}/enforcement.json?search=${encodeURIComponent(
		`recall_number:"${record.recall_number}"`,
	)}`;
	const publishedAt = isoFromCompact(record.report_date) ?? now.toISOString();
	return {
		id,
		source: {
			name: "FDA Enforcement Reports (openFDA)",
			type: "regulator",
			jurisdiction: "US",
			authority: "U.S. Food and Drug Administration",
			publisher: "openFDA",
			source_url: sourceUrl,
			source_id: record.recall_number,
			license_note: "US federal work, public domain (17 U.S.C. §105); openFDA terms apply to the service.",
		},
		classification: {
			category: `fda_recall_${productType}`,
			subtype: record.classification,
			topics: [],
			tags: record.voluntary_mandated === undefined ? [] : [record.voluntary_mandated],
		},
		status: {
			state,
			change_type: state === "archived" ? "status_changed" : "created",
			is_new: state === "effective",
			is_updated: state === "archived",
			is_withdrawn: false,
			is_corrected: false,
		},
		dates: {
			published_at: publishedAt,
			effective_at: isoFromCompact(record.recall_initiation_date),
			updated_at: null,
			retrieved_at: now.toISOString(),
			detected_at: now.toISOString(),
			expires_at: null,
		},
		summary: {
			title: `${record.classification} ${productType} recall: ${record.product_description.slice(0, 120).trim()}`,
			abstract: record.reason_for_recall,
			short_summary: `${record.recalling_firm} — ${record.reason_for_recall.slice(0, 160)}`,
			long_summary: null,
		},
		change_tracking: {
			version: "1",
			previous_version: null,
			diff_summary: null,
			diff_fields: [],
			change_severity: severityFor(record.classification),
			change_notes: null,
		},
		provenance: {
			primary_source_url: sourceUrl,
			snapshot_url: null,
			retrieval_method: "official_api",
			parser_version: "1.0.0",
		},
		delivery: {
			canonical_url: `${baseUrl}/d/${id}`,
			rss_guid: id,
			calendar_uid: null,
			webhook_event: "fda_recall.recorded",
		},
	};
}
