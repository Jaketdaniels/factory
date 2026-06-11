import { env, SELF } from "cloudflare:test";
import { createApiKey, verifyStripeSignature } from "@factory/core";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PublicTradeAction } from "../src/trade-action";
import { evaluateWatchlists } from "../src/watchlists";

async function clearTables(): Promise<void> {
	for (const table of ["alert_events", "watchlists", "usage_events", "api_keys"]) {
		await env.DB.prepare(`DELETE FROM ${table}`).run();
	}
}

function action(documentNumber: string, program: string, agencies: string[]): PublicTradeAction {
	return {
		document_number: documentNumber,
		title: `Doc ${documentNumber}`,
		type: "Notice",
		abstract: null,
		publication_date: "2026-06-11",
		url: `https://www.federalregister.gov/d/${documentNumber}`,
		agencies,
		program,
		legal_status: "final",
		effective_on: null,
		comments_close_on: null,
		hearing_on: null,
		confidence: "medium",
		source: {
			id: documentNumber,
			type: "federal_register",
			url: `https://www.federalregister.gov/d/${documentNumber}`,
		},
	};
}

describe("watchlist CRUD", () => {
	beforeEach(clearTables);

	it("is keyed, never billed, capped, and returns the webhook secret once", async () => {
		expect((await SELF.fetch("https://example.com/v1/watchlists")).status).toBe(401);

		const { rawKey, id } = await createApiKey(env.DB, { plan: "pro", monthlyQuota: 1000000 });
		const headers = { authorization: `Bearer ${rawKey}`, "content-type": "application/json" };

		const created = await SELF.fetch("https://example.com/v1/watchlists", {
			method: "POST",
			headers,
			body: JSON.stringify({ kind: "program", value: "Section_232", webhook_url: "https://hooks.example/wh" }),
		});
		expect(created.status).toBe(201);
		const body = (await created.json()) as { id: string; value: string; webhook_secret: string | null };
		expect(body.value).toBe("section_232");
		expect(body.webhook_secret).toMatch(/^whsec_tw_/);

		const dup = await SELF.fetch("https://example.com/v1/watchlists", {
			method: "POST",
			headers,
			body: JSON.stringify({ kind: "program", value: "section_232" }),
		});
		expect(dup.status).toBe(409);

		const listed = await SELF.fetch("https://example.com/v1/watchlists", { headers });
		const list = (await listed.json()) as { watchlists: { id: string; webhook_secret?: string }[] };
		expect(list.watchlists).toHaveLength(1);
		expect(list.watchlists[0]?.webhook_secret).toBeUndefined();

		// CRUD is never billed.
		const usage = await env.DB.prepare("SELECT id FROM usage_events WHERE key_id = ?").bind(id).all();
		expect(usage.results).toHaveLength(0);

		const del = await SELF.fetch(`https://example.com/v1/watchlists/${body.id}`, { method: "DELETE", headers });
		expect(del.status).toBe(200);
		expect(
			((await (await SELF.fetch("https://example.com/v1/watchlists", { headers })).json()) as { watchlists: unknown[] })
				.watchlists,
		).toHaveLength(0);
	});
});

describe("watchlist evaluation", () => {
	const server = setupServer();

	beforeAll(() => {
		server.listen({ onUnhandledRequest: "error" });
	});
	afterEach(() => {
		server.resetHandlers();
	});
	afterAll(() => {
		server.close();
	});
	beforeEach(clearTables);

	it("alerts matching watchlists once, with a verifiable webhook signature", async () => {
		let webhookBody = "";
		let webhookSignature = "";
		server.use(
			http.post("https://hooks.example/wh", async ({ request }) => {
				webhookBody = new TextDecoder().decode(await request.arrayBuffer());
				webhookSignature = request.headers.get("tariff-watch-signature") ?? "";
				return HttpResponse.json({ ok: true });
			}),
		);

		const { rawKey } = await createApiKey(env.DB, {
			plan: "standing",
			monthlyQuota: 1000000,
			email: "watcher@example.com",
		});
		const headers = { authorization: `Bearer ${rawKey}`, "content-type": "application/json" };
		const created = await SELF.fetch("https://example.com/v1/watchlists", {
			method: "POST",
			headers,
			body: JSON.stringify({ kind: "program", value: "section_232", webhook_url: "https://hooks.example/wh" }),
		});
		const { webhook_secret } = (await created.json()) as { webhook_secret: string };

		const sent: string[] = [];
		const sink = {
			sendEmail: async (to: string, subject: string): Promise<void> => {
				sent.push(`${to}:${subject}`);
			},
		};
		const nowMs = 1781200000000;
		const matching = action("2026-50001", "section_232", ["U.S. Customs and Border Protection"]);
		const other = action("2026-50002", "trade_remedies", ["International Trade Commission"]);

		const first = await evaluateWatchlists(env.DB, [matching, other], sink, nowMs);
		expect(first).toEqual({ emails: 1, webhooks: 1 });
		expect(sent).toHaveLength(1);
		expect(sent[0]).toContain("watcher@example.com");
		expect(webhookBody).toContain("2026-50001");
		await expect(verifyStripeSignature(webhookBody, webhookSignature, webhook_secret, { nowMs })).resolves.toBe(true);

		// Idempotent: the same documents never alert twice.
		const second = await evaluateWatchlists(env.DB, [matching, other], sink, nowMs);
		expect(second).toEqual({ emails: 0, webhooks: 0 });

		// Agency watch matches via the agencies array.
		await SELF.fetch("https://example.com/v1/watchlists", {
			method: "POST",
			headers,
			body: JSON.stringify({ kind: "agency", value: "International Trade Commission" }),
		});
		const third = await evaluateWatchlists(env.DB, [other], sink, nowMs);
		expect(third.emails).toBe(1);
	});
});
