import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import netm8Spec from "../../../sites/netm8/schemas/feed-item-v1.schema.json";
import { recordChangeEvent } from "../src/ingest";

const encoder = new TextEncoder();

function eventInput(id: string, body: string) {
	return {
		rawBody: encoder.encode(body).buffer as ArrayBuffer,
		contentType: "application/json",
		item: {
			id,
			source: {
				name: "Federal Register",
				type: "government",
				jurisdiction: "US",
				authority: "Example Agency",
				source_url: "https://www.federalregister.gov/d/2026-00002",
				source_id: "2026-00002",
			},
			classification: { category: "example_category", topics: [], tags: [] },
			status: {
				state: "new" as const,
				change_type: "created",
				is_new: true,
				is_updated: false,
				is_withdrawn: false,
				is_corrected: false,
			},
			dates: {
				published_at: "2026-06-11T00:00:00Z",
				effective_at: null,
				updated_at: null,
				retrieved_at: "2026-06-11T02:07:00Z",
				detected_at: "2026-06-11T02:07:05Z",
				expires_at: null,
			},
			summary: { title: "Raw provenance drill", abstract: null, short_summary: null, long_summary: null },
			provenance: {
				primary_source_url: "https://www.federalregister.gov/d/2026-00002",
				snapshot_url: null,
				retrieval_method: "official_api",
				parser_version: "1.0.0",
			},
			delivery: {
				canonical_url: "https://example.com/d/2026-00002",
				rss_guid: null,
				calendar_uid: null,
				webhook_event: null,
			},
		},
	};
}

describe("raw snapshot provenance", () => {
	beforeEach(async () => {
		await env.DB.prepare("DELETE FROM feed_items").run();
	});

	it("archives raw bytes content-addressed and stamps the event", async () => {
		const { item, inserted } = await recordChangeEvent(env, eventInput("evt-r2-1", '{"doc":1}'));
		expect(inserted).toBe(true);
		expect(item.provenance.snapshot_hash).toMatch(/^[0-9a-f]{64}$/);
		expect(item.raw?.raw_snapshot_ref).toBe(`r2://${item.provenance.snapshot_hash}`);

		const stored = await env.RAW.get(item.provenance.snapshot_hash as string);
		expect(stored).not.toBeNull();
		expect(await stored?.text()).toBe('{"doc":1}');

		// Identical raw bytes are stored once; a distinct event still records.
		const second = await recordChangeEvent(env, eventInput("evt-r2-2", '{"doc":1}'));
		expect(second.inserted).toBe(true);
		expect(second.item.provenance.snapshot_hash).toBe(item.provenance.snapshot_hash);

		const row = await env.DB.prepare("SELECT snapshot_hash FROM feed_items WHERE id = 'evt-r2-1'").first<{
			snapshot_hash: string;
		}>();
		expect(row?.snapshot_hash).toBe(item.provenance.snapshot_hash);
	});

	it("emits records that satisfy the published netm8 contract", async () => {
		const { item } = await recordChangeEvent(env, eventInput("evt-spec-1", '{"doc":2}'));
		const emitted = item as unknown as Record<string, unknown>;
		// Every field the published JSON Schema requires is present, and every
		// emitted top-level block is one the spec declares.
		for (const field of netm8Spec.required) {
			expect(emitted[field], `missing required field ${field}`).toBeDefined();
		}
		for (const key of Object.keys(emitted)) {
			expect(Object.keys(netm8Spec.properties), `undeclared field ${key}`).toContain(key);
		}
	});
});
