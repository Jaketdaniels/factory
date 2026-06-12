import { env, SELF } from "cloudflare:test";
import { createApiKey } from "@factory/core";
import { beforeEach, describe, expect, it } from "vitest";
import { insertFeedItem } from "../src/feed-item";
import { toChangeEvent } from "../src/openfda";
import { sampleRecord } from "./fixtures";

async function clearTables(): Promise<void> {
	for (const table of ["usage_events", "provisioned_keys", "analytics_events", "api_keys", "feed_items"]) {
		await env.DB.prepare(`DELETE FROM ${table}`).run();
	}
}

async function seedRecall(recallNumber: string): Promise<void> {
	const event = toChangeEvent(
		sampleRecord(recallNumber),
		"food",
		new Date("2026-06-11T00:00:00Z"),
		"https://recalls.netm8.com",
	);
	await insertFeedItem(env.DB, {
		...event,
		provenance: { ...event.provenance, snapshot_hash: "ab".repeat(32) },
	});
}

function changesRequest(key?: string, query = "?category=fda_recall_food"): Request {
	const headers: Record<string, string> = {};
	if (key !== undefined) {
		headers.authorization = `Bearer ${key}`;
	}
	return new Request(`https://example.com/v1/changes${query}`, { headers });
}

describe("public routes", () => {
	it("serves the landing page with recent recalls, llms.txt, and RSS", async () => {
		await clearTables();
		await seedRecall("F-0001-2026");
		const res = await SELF.fetch("https://example.com/");
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/html");
		const html = await res.text();
		expect(html).toContain("structured change event");
		expect(html).toContain("F-0001-2026");
		expect(html).toContain('data-brand="netm8-feed"');
		expect(html).toContain("Tier 3 - brand overlay: netm8-feed");
		expect(html).toContain("color-scheme: dark;");
		expect(html).toContain("--badge-alert: var(--brand-badge-alert);");
		expect(html).not.toContain("--bg:");
		expect(html).not.toContain("var(--bg)");
		expect(html).toContain('role="tablist" aria-label="Pricing plans"');
		expect(html).toContain("Pay as you go");
		expect(html).toContain("Fixed rate - monthly");
		expect(html).toContain("Fixed rate - annual");
		expect(html).toContain("Launch access is free while Stripe billing is verified.");

		const llms = await SELF.fetch("https://example.com/llms.txt");
		expect(llms.status).toBe(200);
		expect(await llms.text()).toContain("feed-item-v1.schema.json");

		const rss = await SELF.fetch("https://example.com/feed.xml");
		expect(rss.status).toBe(200);
		expect(rss.headers.get("content-type")).toContain("application/rss+xml");
		expect(await rss.text()).toContain("food-F-0001-2026-effective");
	});

	it("reports health", async () => {
		const res = await SELF.fetch("https://example.com/healthz");
		expect(res.status).toBe(200);
		await expect(res.json()).resolves.toEqual({ ok: true });
	});

	it("returns structured 404s", async () => {
		const res = await SELF.fetch("https://example.com/nope");
		expect(res.status).toBe(404);
		const body = (await res.json()) as { error: { code: string } };
		expect(body.error.code).toBe("not_found");
	});
});

describe("metered API", () => {
	beforeEach(clearTables);

	it("rejects requests without a key", async () => {
		const res = await SELF.fetch(changesRequest());
		expect(res.status).toBe(401);
	});

	it("rejects unknown keys", async () => {
		const res = await SELF.fetch(changesRequest("fk_unknown"));
		expect(res.status).toBe(401);
	});

	it("returns contract-shaped change events for a valid key", async () => {
		await seedRecall("F-0002-2026");
		const { rawKey } = await createApiKey(env.DB, { plan: "free", monthlyQuota: 10 });
		const res = await SELF.fetch(changesRequest(rawKey));
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			changes: { id: string; provenance: { snapshot_hash: string } }[];
			count: number;
		};
		expect(body.count).toBe(1);
		expect(body.changes[0]?.id).toBe("food-F-0002-2026-effective");
		expect(body.changes[0]?.provenance.snapshot_hash).toMatch(/^[0-9a-f]{64}$/);

		const other = await SELF.fetch(changesRequest(rawKey, "?category=fda_recall_drug"));
		expect(((await other.json()) as { count: number }).count).toBe(0);
	});

	it("validates the query without billing the rejected request", async () => {
		const { rawKey } = await createApiKey(env.DB, { plan: "free", monthlyQuota: 10 });
		const res = await SELF.fetch(changesRequest(rawKey, "?category=not_a_category"));
		expect(res.status).toBe(400);
		// Validator runs before metered(): malformed requests never consume quota.
		const usage = await env.DB.prepare("SELECT id FROM usage_events").all();
		expect(usage.results).toHaveLength(0);
	});

	it("enforces the monthly quota with 429", async () => {
		const { rawKey } = await createApiKey(env.DB, { plan: "free", monthlyQuota: 2 });
		expect((await SELF.fetch(changesRequest(rawKey))).status).toBe(200);
		expect((await SELF.fetch(changesRequest(rawKey))).status).toBe(200);
		const blocked = await SELF.fetch(changesRequest(rawKey));
		expect(blocked.status).toBe(429);
		const body = (await blocked.json()) as { error: { code: string } };
		expect(body.error.code).toBe("quota_exceeded");
	});
});
