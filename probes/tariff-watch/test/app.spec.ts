import { env, SELF } from "cloudflare:test";
import { createApiKey } from "@factory/core";
import { beforeEach, describe, expect, it } from "vitest";

async function clearTables(): Promise<void> {
	for (const table of [
		"usage_events",
		"provisioned_keys",
		"analytics_events",
		"api_keys",
		"tariff_documents",
		"snapshots",
	]) {
		await env.DB.prepare(`DELETE FROM ${table}`).run();
	}
}

async function seedDocument(documentNumber: string, publicationDate: string, title = "Test action"): Promise<void> {
	await env.DB.prepare(
		"INSERT INTO tariff_documents (document_number, title, doc_type, abstract, publication_date, url, agencies, source_query) VALUES (?, ?, 'Notice', 'Test abstract', ?, 'https://www.federalregister.gov/d/x', '[\"International Trade Commission\"]', 'trade-agencies')",
	)
		.bind(documentNumber, title, publicationDate)
		.run();
}

function changesRequest(key: string, query = ""): Request {
	return new Request(`https://example.com/v1/changes${query}`, {
		headers: { authorization: `Bearer ${key}` },
	});
}

describe("public surfaces", () => {
	beforeEach(clearTables);

	it("serves the landing page with recent documents", async () => {
		await seedDocument("2026-11111", "2026-06-08", "Steel Derivatives: Section 232 Inclusion");
		const res = await SELF.fetch("https://example.com/");
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toContain("tariff-watch");
		expect(html).toContain("Steel Derivatives: Section 232 Inclusion");
	});

	it("shows the empty state before first ingest", async () => {
		const res = await SELF.fetch("https://example.com/");
		expect(await res.text()).toContain("No documents ingested yet");
	});

	it("serves llms.txt as markdown", async () => {
		const res = await SELF.fetch("https://example.com/llms.txt");
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/markdown");
		expect(await res.text()).toContain("/snapshot/latest.md");
	});

	it("404s snapshots before the first run, then serves latest and dated snapshots", async () => {
		expect((await SELF.fetch("https://example.com/snapshot/latest.md")).status).toBe(404);

		await env.DB.prepare("INSERT INTO snapshots (snapshot_date, markdown, entry_count) VALUES (?, ?, ?)")
			.bind("2026-06-08", "# Changelog 2026-06-08\n", 3)
			.run();
		await env.DB.prepare("INSERT INTO snapshots (snapshot_date, markdown, entry_count) VALUES (?, ?, ?)")
			.bind("2026-06-09", "# Changelog 2026-06-09\n", 5)
			.run();

		const latest = await SELF.fetch("https://example.com/snapshot/latest.md");
		expect(latest.status).toBe(200);
		expect(latest.headers.get("content-type")).toContain("text/markdown");
		expect(latest.headers.get("x-snapshot-date")).toBe("2026-06-09");
		expect(await latest.text()).toContain("2026-06-09");

		const dated = await SELF.fetch("https://example.com/snapshot/2026-06-08.md");
		expect(dated.status).toBe(200);
		expect(await dated.text()).toContain("2026-06-08");

		expect((await SELF.fetch("https://example.com/snapshot/2026-01-01.md")).status).toBe(404);
		expect((await SELF.fetch("https://example.com/snapshot/not-a-date.md")).status).toBe(400);
	});

	it("reports health", async () => {
		const res = await SELF.fetch("https://example.com/healthz");
		await expect(res.json()).resolves.toEqual({ ok: true });
	});
});

describe("free keys + changes API", () => {
	beforeEach(clearTables);

	it("issues a free key once and serves changes with it", async () => {
		await seedDocument("2026-22222", "2026-06-08");
		const keyRes = await SELF.fetch("https://example.com/v1/keys", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ email: "dev@example.com" }),
		});
		expect(keyRes.status).toBe(201);
		const created = (await keyRes.json()) as { key: string; monthly_quota: number };
		expect(created.key).toMatch(/^fk_/);
		expect(created.monthly_quota).toBe(250);

		const changes = await SELF.fetch(changesRequest(created.key, "?since=2026-06-01"));
		expect(changes.status).toBe(200);
		const body = (await changes.json()) as { count: number; results: { document_number: string }[] };
		expect(body.count).toBe(1);
		expect(body.results[0]?.document_number).toBe("2026-22222");
	});

	it("rejects unauthenticated and unknown-key requests", async () => {
		expect((await SELF.fetch("https://example.com/v1/changes")).status).toBe(401);
		expect((await SELF.fetch(changesRequest("fk_unknown"))).status).toBe(401);
	});

	it("filters by since and respects limit", async () => {
		await seedDocument("2026-00001", "2026-06-01");
		await seedDocument("2026-00002", "2026-06-05");
		await seedDocument("2026-00003", "2026-06-09");
		const { rawKey } = await createApiKey(env.DB, { plan: "free", monthlyQuota: 100 });

		const since = await SELF.fetch(changesRequest(rawKey, "?since=2026-06-05"));
		const sinceBody = (await since.json()) as { count: number };
		expect(sinceBody.count).toBe(2);

		const limited = await SELF.fetch(changesRequest(rawKey, "?since=2026-06-01&limit=1"));
		const limitedBody = (await limited.json()) as { count: number; results: { document_number: string }[] };
		expect(limitedBody.count).toBe(1);
		expect(limitedBody.results[0]?.document_number).toBe("2026-00003");
	});

	it("rejects malformed queries without billing them", async () => {
		const { rawKey } = await createApiKey(env.DB, { plan: "free", monthlyQuota: 10 });
		const bad = await SELF.fetch(changesRequest(rawKey, "?since=June-1st"));
		expect(bad.status).toBe(400);
		const usage = await env.DB.prepare("SELECT id FROM usage_events").all();
		expect(usage.results).toHaveLength(0);
	});

	it("enforces the monthly quota", async () => {
		const { rawKey } = await createApiKey(env.DB, { plan: "free", monthlyQuota: 1 });
		expect((await SELF.fetch(changesRequest(rawKey))).status).toBe(200);
		expect((await SELF.fetch(changesRequest(rawKey))).status).toBe(429);
	});
});

describe("admin ingest auth", () => {
	it("rejects a missing or wrong token without running ingest", async () => {
		const missing = await SELF.fetch("https://example.com/admin/ingest", { method: "POST" });
		expect(missing.status).toBe(403);
		const wrong = await SELF.fetch("https://example.com/admin/ingest", {
			method: "POST",
			headers: { "x-admin-token": "wrong-token-1234567890" },
		});
		expect(wrong.status).toBe(403);
	});
});
