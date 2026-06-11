import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { type FeedItemV1, feedItemV1Schema, insertFeedItem, listFeedItems } from "../src/feed-item";

function sampleItem(id: string): FeedItemV1 {
	return feedItemV1Schema.parse({
		id,
		source: {
			name: "Federal Register",
			type: "government",
			jurisdiction: "US",
			authority: "Example Agency",
			source_url: "https://www.federalregister.gov/d/2026-00001",
			source_id: "2026-00001",
		},
		classification: { category: "example_category" },
		status: { state: "new", change_type: "created", is_new: true },
		dates: {
			published_at: "2026-06-11T00:00:00Z",
			retrieved_at: "2026-06-11T02:07:00Z",
			detected_at: "2026-06-11T02:07:05Z",
		},
		summary: { title: "Example change event" },
		provenance: {
			primary_source_url: "https://www.federalregister.gov/d/2026-00001",
			retrieval_method: "official_api",
			snapshot_hash: "ab".repeat(32),
		},
		delivery: { canonical_url: "https://example.com/d/2026-00001" },
	});
}

describe("FeedItemV1 storage", () => {
	beforeEach(async () => {
		await env.DB.prepare("DELETE FROM feed_items").run();
	});

	it("validates, persists, and round-trips change events idempotently", async () => {
		expect(await insertFeedItem(env.DB, sampleItem("evt-1"))).toBe(true);
		// id is the idempotence key: re-detecting the same event writes nothing.
		expect(await insertFeedItem(env.DB, sampleItem("evt-1"))).toBe(false);

		const items = await listFeedItems(env.DB, { category: "example_category" });
		expect(items).toHaveLength(1);
		expect(items[0]?.summary.title).toBe("Example change event");
		expect(items[0]?.provenance.snapshot_hash).toBe("ab".repeat(32));
		expect(await listFeedItems(env.DB, { category: "other" })).toHaveLength(0);
	});

	it("rejects records that violate the contract", () => {
		const broken = { ...sampleItem("evt-2"), provenance: { retrieval_method: "official_api" } };
		expect(() => feedItemV1Schema.parse(broken)).toThrow();
	});
});
