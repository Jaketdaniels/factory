import { z } from "zod";

/**
 * FeedItemV1 — the netm8 feed contract, mirrored as a runtime schema.
 * Canonical JSON Schema: https://netm8.com/standards/feed-item-v1.schema.json
 * Keep the two in lockstep; breaking changes become FeedItemV2.
 */

export const FEED_ITEM_STATES = [
	"new",
	"updated",
	"scheduled",
	"effective",
	"superseded",
	"withdrawn",
	"corrected",
	"archived",
] as const;

const isoDateTime = z.string().datetime();

export const feedItemV1Schema = z.object({
	id: z.string().min(1),
	source: z.object({
		name: z.string().min(1),
		type: z.string().min(1),
		jurisdiction: z.string().min(1),
		authority: z.string().min(1),
		publisher: z.string().optional(),
		source_url: z.string().url(),
		source_version_url: z.string().url().optional(),
		source_id: z.string().optional(),
		/** Reuse basis — required by the netm8 license gate for any source
		 * that is not US public domain. */
		license_note: z.string().optional(),
	}),
	classification: z.object({
		category: z.string().min(1),
		subtype: z.string().optional(),
		topics: z.array(z.string()).default([]),
		tags: z.array(z.string()).default([]),
	}),
	status: z.object({
		state: z.enum(FEED_ITEM_STATES),
		change_type: z.string().min(1),
		is_new: z.boolean().default(false),
		is_updated: z.boolean().default(false),
		is_withdrawn: z.boolean().default(false),
		is_corrected: z.boolean().default(false),
	}),
	dates: z.object({
		published_at: isoDateTime,
		effective_at: isoDateTime.nullable().default(null),
		updated_at: isoDateTime.nullable().default(null),
		retrieved_at: isoDateTime,
		detected_at: isoDateTime,
		expires_at: isoDateTime.nullable().default(null),
	}),
	summary: z.object({
		title: z.string().min(1),
		abstract: z.string().nullable().default(null),
		short_summary: z.string().nullable().default(null),
		long_summary: z.string().nullable().default(null),
	}),
	change_tracking: z
		.object({
			version: z.string().optional(),
			previous_version: z.string().nullable().default(null),
			diff_summary: z.string().nullable().default(null),
			diff_fields: z.array(z.string()).default([]),
			change_severity: z.enum(["info", "minor", "major", "critical"]).optional(),
			change_notes: z.string().nullable().default(null),
		})
		.optional(),
	provenance: z.object({
		primary_source_url: z.string().url(),
		snapshot_url: z.string().url().nullable().default(null),
		/** SHA-256 of the raw retrieved bytes; also the R2 key for them. */
		snapshot_hash: z.string().nullable().default(null),
		retrieval_method: z.string().min(1),
		parser_version: z.string().nullable().default(null),
		confidence: z.number().min(0).max(1).optional(),
	}),
	delivery: z.object({
		canonical_url: z.string().url(),
		rss_guid: z.string().nullable().default(null),
		calendar_uid: z.string().nullable().default(null),
		webhook_event: z.string().nullable().default(null),
	}),
	metrics: z
		.object({
			importance_score: z.number().optional(),
			recency_score: z.number().optional(),
			volatility_score: z.number().optional(),
			confidence_score: z.number().optional(),
		})
		.optional(),
	raw: z
		.object({
			content_type: z.string().nullable().default(null),
			raw_snapshot_ref: z.string().nullable().default(null),
		})
		.optional(),
});

export type FeedItemV1 = z.infer<typeof feedItemV1Schema>;

const feedItemRowSchema = z.object({ item: z.string() });

/** Persist a validated change event (id is the idempotence key). */
export async function insertFeedItem(db: D1Database, item: FeedItemV1): Promise<boolean> {
	const parsed = feedItemV1Schema.parse(item);
	const result = await db
		.prepare(
			"INSERT INTO feed_items (id, source_id, category, state, change_type, title, published_at, effective_at, detected_at, snapshot_hash, item) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING",
		)
		.bind(
			parsed.id,
			parsed.source.source_id ?? null,
			parsed.classification.category,
			parsed.status.state,
			parsed.status.change_type,
			parsed.summary.title,
			parsed.dates.published_at,
			parsed.dates.effective_at,
			parsed.dates.detected_at,
			parsed.provenance.snapshot_hash,
			JSON.stringify(parsed),
		)
		.run();
	return result.meta.changes > 0;
}

export async function listFeedItems(
	db: D1Database,
	options: { category?: string | undefined; limit?: number | undefined } = {},
): Promise<FeedItemV1[]> {
	const limit = options.limit ?? 50;
	const statement =
		options.category === undefined
			? db.prepare("SELECT item FROM feed_items ORDER BY published_at DESC, id DESC LIMIT ?").bind(limit)
			: db
					.prepare("SELECT item FROM feed_items WHERE category = ? ORDER BY published_at DESC, id DESC LIMIT ?")
					.bind(options.category, limit);
	const { results } = await statement.all();
	return z
		.array(feedItemRowSchema)
		.parse(results)
		.map((row) => feedItemV1Schema.parse(JSON.parse(row.item)));
}
