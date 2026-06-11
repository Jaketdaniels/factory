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

async function seedEvidenceDocument(documentNumber: string, publicationDate: string, title: string): Promise<void> {
	await env.DB.prepare(
		"INSERT INTO tariff_documents (document_number, title, doc_type, abstract, publication_date, url, agencies, source_query, program, legal_status, effective_on, comments_close_on, hearing_on, source_type, source_id, confidence) VALUES (?, ?, 'Notice', 'Evidence abstract', ?, 'https://www.federalregister.gov/d/2026-11296', '[\"Office of the United States Trade Representative\"]', 'tracked-section-301-forced-labor', 'section_301_forced_labor', 'proposed', NULL, '2026-07-06', '2026-07-07', 'federal_register', ?, 'high')",
	)
		.bind(documentNumber, title, publicationDate, documentNumber)
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
		expect(html).toContain("tariff.watch");
		expect(html).toContain("Steel Derivatives: Section 232 Inclusion");
	});

	it("renders the deadline strip, both pricing doors, and real API URLs", async () => {
		// Far-future dates keep the deadline assertions stable over time.
		await env.DB.prepare(
			"INSERT INTO tariff_documents (document_number, title, doc_type, abstract, publication_date, url, agencies, source_query, program, legal_status, effective_on, comments_close_on, source_type, source_id, confidence) VALUES ('2099-00001', 'Future Modification of Duty Rates', 'Rule', NULL, '2099-01-02', 'https://www.federalregister.gov/d/2099-00001', '[]', 'trade-agencies', 'section_232', 'final', '2099-03-01', '2099-02-01', 'federal_register', '2099-00001', 'medium')",
		).run();
		const html = await (await SELF.fetch("https://example.com/")).text();
		expect(html).toContain("Upcoming deadlines");
		expect(html).toContain("2099-03-01");
		expect(html).toContain("Comments due");
		expect(html).toContain('id="pro"');
		expect(html).toContain("/billing/checkout");
		expect(html).toContain('Your first <span class="datum">30</span> API calls are free');
		expect(html).toContain("US$0.10 per API call");
		expect(html).toContain("cancel anytime");
		expect(html).not.toContain("US$2");
		expect(html).toContain("mcpServers");
		expect(html).toContain("claude mcp add");
		expect(html).not.toContain("freekey");
		// Deletion lives on its own page, linked from the footer.
		expect(html).not.toContain('id="delete"');
		expect(html).toContain('href="/account/delete"');
		// Real domain in the examples, never a placeholder.
		expect(html).toContain("https://tariff.watch/snapshot/latest.md");
		expect(html).not.toContain("this-domain");
	});

	it("shows the last-checked timestamp once an ingest has run", async () => {
		await env.DB.prepare(
			"INSERT INTO analytics_events (id, name, props, created_at) VALUES ('evt-fresh', 'ingest_run', '{}', '2026-06-11 08:07:00')",
		).run();
		const html = await (await SELF.fetch("https://example.com/")).text();
		expect(html).toContain("Last checked");
		expect(html).toContain("2026-06-11 08:07 UTC");
	});

	it("shows the empty state before first ingest", async () => {
		const res = await SELF.fetch("https://example.com/");
		expect(await res.text()).toContain("No documents ingested yet");
	});

	it("serves llms.txt as markdown", async () => {
		const res = await SELF.fetch("https://example.com/llms.txt");
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/markdown");
		const body = await res.text();
		expect(body).toContain("/snapshot/latest.md");
		expect(body).toMatch(/first\s+30 API calls are free/);
		expect(body).not.toContain("each month are free");
		expect(body).toContain("US$0.10");
		expect(body).not.toContain("US$2");
	});

	it("serves source-first RSS and calendar feeds", async () => {
		await seedEvidenceDocument(
			"2026-11296",
			"2026-06-05",
			"Section 301 Investigations of Forced Labor Import Prohibitions",
		);

		const rss = await SELF.fetch("https://example.com/feed.xml");
		expect(rss.status).toBe(200);
		expect(rss.headers.get("content-type")).toContain("application/rss+xml");
		expect(rss.headers.get("cache-control")).toBe("public, max-age=3600");
		const rssBody = await rss.text();
		expect(rssBody).toContain("<rss");
		expect(rssBody).toContain("Section 301 Investigations of Forced Labor Import Prohibitions");
		expect(rssBody).toContain("section_301_forced_labor");
		expect(rssBody).toContain("proposed");

		const calendar = await SELF.fetch("https://example.com/calendar.ics");
		expect(calendar.status).toBe(200);
		expect(calendar.headers.get("content-type")).toContain("text/calendar");
		expect(calendar.headers.get("cache-control")).toBe("public, max-age=3600");
		const calendarBody = await calendar.text();
		expect(calendarBody).toContain("BEGIN:VCALENDAR");
		expect(calendarBody).toContain("UID:2026-11296-comment_due-20260706@tariff.watch");
		expect(calendarBody).toContain("DTSTART;VALUE=DATE:20260706");
		expect(calendarBody).toContain(
			"SUMMARY:Comment deadline: Section 301 Investigations of Forced Labor Import Prohibitions",
		);
		expect(calendarBody).toContain("UID:2026-11296-hearing-20260707@tariff.watch");
	});

	it("exposes a minimal MCP tool surface for agents", async () => {
		await seedEvidenceDocument(
			"2026-11296",
			"2026-06-05",
			"Section 301 Investigations of Forced Labor Import Prohibitions",
		);

		const initialize = await SELF.fetch("https://example.com/mcp", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }),
		});
		expect(initialize.status).toBe(200);
		expect(initialize.headers.get("mcp-session-id")).toBeTruthy();
		const initialized = (await initialize.json()) as {
			result: { protocolVersion: string; capabilities: { tools: Record<string, never> } };
		};
		expect(initialized.result.protocolVersion).toBe("2025-06-18");
		expect(initialized.result.capabilities.tools).toEqual({});

		const listed = await SELF.fetch("https://example.com/mcp", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }),
		});
		const listBody = (await listed.json()) as { result: { tools: { name: string }[] } };
		expect(listBody.result.tools.map((tool) => tool.name)).toEqual([
			"tariffs_list_changes",
			"tariffs_effective_dates",
			"tariffs_get_source",
		]);

		// tools/call is metered: no key means a JSON-RPC auth error over 401.
		const denied = await SELF.fetch("https://example.com/mcp", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: 3,
				method: "tools/call",
				params: { name: "tariffs_effective_dates", arguments: { since: "2026-06-01" } },
			}),
		});
		expect(denied.status).toBe(401);
		expect(((await denied.json()) as { error: { code: number } }).error.code).toBe(-32001);

		const { rawKey } = await createApiKey(env.DB, { plan: "pro", monthlyQuota: 1000000 });
		const called = await SELF.fetch("https://example.com/mcp", {
			method: "POST",
			headers: { "content-type": "application/json", authorization: `Bearer ${rawKey}` },
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: 3,
				method: "tools/call",
				params: { name: "tariffs_effective_dates", arguments: { since: "2026-06-01" } },
			}),
		});
		const callBody = (await called.json()) as {
			result: { content: { text: string; type: "text" }[]; structuredContent: { dates: { date: string }[] } };
		};
		expect(callBody.result.structuredContent.dates).toContainEqual(expect.objectContaining({ date: "2026-07-06" }));
		expect(callBody.result.content[0]?.text).toContain("2026-07-06");
		// The call was metered like an API request.
		const usage = await env.DB.prepare("SELECT route FROM usage_events").all();
		expect(usage.results).toEqual([expect.objectContaining({ route: "mcp" })]);
	});

	it("answers malformed MCP traffic with JSON-RPC errors, never HTTP 500", async () => {
		const { rawKey } = await createApiKey(env.DB, { plan: "pro", monthlyQuota: 1000000 });
		const mcpPost = (body: string) =>
			SELF.fetch("https://example.com/mcp", {
				method: "POST",
				headers: { "content-type": "application/json", authorization: `Bearer ${rawKey}` },
				body,
			});
		type RpcError = { error: { code: number } };

		const invalidJson = await mcpPost("{not json");
		expect(invalidJson.status).toBe(200);
		expect(((await invalidJson.json()) as RpcError).error.code).toBe(-32700);

		const invalidRequest = await mcpPost(JSON.stringify({ hello: "world" }));
		expect(invalidRequest.status).toBe(200);
		expect(((await invalidRequest.json()) as RpcError).error.code).toBe(-32600);

		const badArgs = await mcpPost(
			JSON.stringify({
				jsonrpc: "2.0",
				id: 4,
				method: "tools/call",
				params: { name: "tariffs_list_changes", arguments: { since: "not-a-date" } },
			}),
		);
		expect(badArgs.status).toBe(200);
		expect(((await badArgs.json()) as RpcError).error.code).toBe(-32602);

		const unknownTool = await mcpPost(
			JSON.stringify({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "nope" } }),
		);
		expect(((await unknownTool.json()) as RpcError).error.code).toBe(-32602);

		const unknownMethod = await mcpPost(JSON.stringify({ jsonrpc: "2.0", id: 6, method: "resources/list" }));
		expect(((await unknownMethod.json()) as RpcError).error.code).toBe(-32601);

		// Clicking the landing-page mention must not look like a broken site.
		const get = await SELF.fetch("https://example.com/mcp");
		expect(get.status).toBe(405);
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

		// The dated archive is metered: no key means 401, never content.
		expect((await SELF.fetch("https://example.com/snapshot/2026-06-08.md")).status).toBe(401);
		const { rawKey } = await createApiKey(env.DB, { plan: "pro", monthlyQuota: 1000000 });
		const dated = await SELF.fetch(
			new Request("https://example.com/snapshot/2026-06-08.md", {
				headers: { authorization: `Bearer ${rawKey}` },
			}),
		);
		expect(dated.status).toBe(200);
		expect(await dated.text()).toContain("2026-06-08");

		expect(
			(
				await SELF.fetch(
					new Request("https://example.com/snapshot/2026-01-01.md", {
						headers: { authorization: `Bearer ${rawKey}` },
					}),
				)
			).status,
		).toBe(404);
		expect((await SELF.fetch("https://example.com/snapshot/not-a-date.md")).status).toBe(400);
	});

	it("reports health", async () => {
		const res = await SELF.fetch("https://example.com/healthz");
		await expect(res.json()).resolves.toEqual({ ok: true });
	});
});

describe("keys + changes API", () => {
	beforeEach(clearTables);

	it("serves changes to an authorized key; card-less provisioning is gone", async () => {
		await seedDocument("2026-22222", "2026-06-08");
		// Keys are provisioned only through Stripe Checkout now.
		const removed = await SELF.fetch("https://example.com/v1/keys", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ email: "dev@example.com" }),
		});
		expect(removed.status).toBe(404);

		const { rawKey } = await createApiKey(env.DB, { plan: "pro", monthlyQuota: 1000000, email: "dev@example.com" });
		const changes = await SELF.fetch(changesRequest(rawKey, "?since=2026-06-01"));
		expect(changes.status).toBe(200);
		const body = (await changes.json()) as {
			count: number;
			results: {
				confidence: string;
				document_number: string;
				legal_status: string;
				program: string;
				source: { id: string; type: string; url: string };
			}[];
		};
		expect(body.count).toBe(1);
		expect(body.results[0]?.document_number).toBe("2026-22222");
		expect(body.results[0]).toMatchObject({
			legal_status: "final",
			program: "trade_action",
			source: { id: "2026-22222", type: "federal_register", url: "https://www.federalregister.gov/d/x" },
			confidence: "medium",
		});
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

describe("account deletion", () => {
	beforeEach(clearTables);

	function deleteRequest(body: unknown): Promise<Response> {
		return SELF.fetch("https://example.com/account/delete", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(body),
		});
	}

	it("deletes keys, usage, and reservations, and answers unknown emails identically", async () => {
		await seedDocument("2026-33333", "2026-06-08");
		const created = await createApiKey(env.DB, { plan: "pro", monthlyQuota: 1000000, email: "del@example.com" });
		await SELF.fetch(changesRequest(created.rawKey));
		await env.DB.prepare(
			"INSERT INTO provisioned_keys (checkout_session_id, email, key_id) VALUES ('cs_del', 'del@example.com', ?)",
		)
			.bind(created.id)
			.run();

		const res = await deleteRequest({ email: "del@example.com" });
		expect(res.status).toBe(200);
		const body = (await res.json()) as { deleted: boolean; message: string };
		expect(body.deleted).toBe(true);

		expect((await env.DB.prepare("SELECT id FROM api_keys").all()).results).toHaveLength(0);
		expect((await env.DB.prepare("SELECT id FROM usage_events").all()).results).toHaveLength(0);
		expect((await env.DB.prepare("SELECT checkout_session_id FROM provisioned_keys").all()).results).toHaveLength(0);
		// The deleted key no longer authenticates.
		expect((await SELF.fetch(changesRequest(created.rawKey))).status).toBe(401);

		// Unknown address: byte-identical response, no email enumeration.
		const unknown = await deleteRequest({ email: "never-seen@example.com" });
		expect(unknown.status).toBe(200);
		expect(await unknown.json()).toEqual(body);
	});

	it("serves the terms page, linked from the footer and llms.txt", async () => {
		const terms = await SELF.fetch("https://example.com/terms");
		expect(terms.status).toBe(200);
		const html = await terms.text();
		expect(html).toContain("Verify against the cited source before compliance use");
		expect(html).toContain("17 U.S.C. §105");
		expect(html).toContain("/account/delete");

		expect(await (await SELF.fetch("https://example.com/")).text()).toContain('href="/terms"');
		expect(await (await SELF.fetch("https://example.com/llms.txt")).text()).toContain("/terms");
	});

	it("serves the standalone deletion page", async () => {
		const res = await SELF.fetch("https://example.com/account/delete");
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toContain("Delete your key");
		expect(html).toContain('id="delete"');
	});

	it("rejects malformed bodies", async () => {
		expect((await deleteRequest({ email: "not-an-email" })).status).toBe(400);
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
