import { env, SELF } from "cloudflare:test";
import { createApiKey } from "@factory/core";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { signedWebhookRequest } from "./helpers";

async function clearTables(): Promise<void> {
	for (const table of ["usage_events", "provisioned_keys", "analytics_events", "api_keys"]) {
		await env.DB.prepare(`DELETE FROM ${table}`).run();
	}
}

function completedSessionEvent(sessionId: string, subscriptionId = "sub_test_1"): Record<string, unknown> {
	return {
		id: `evt_${sessionId}`,
		type: "checkout.session.completed",
		data: {
			object: {
				id: sessionId,
				customer: "cus_test_1",
				subscription: subscriptionId,
				customer_details: { email: "buyer@example.com" },
			},
		},
	};
}

async function deliverWebhook(event: Record<string, unknown>): Promise<Response> {
	const { body, headers } = await signedWebhookRequest(event, env.STRIPE_WEBHOOK_SECRET);
	return SELF.fetch("https://example.com/webhooks/stripe", { method: "POST", headers, body });
}

function claimRequest(sessionId: string): Request {
	return new Request("https://example.com/billing/claim", {
		method: "POST",
		headers: { "content-type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({ session_id: sessionId }).toString(),
	});
}

describe("standing tier", () => {
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

	it("creates a two-line-item checkout (flat + meter) tagged with the plan", async () => {
		let body = "";
		server.use(
			http.post("https://api.stripe.com/v1/checkout/sessions", async ({ request }) => {
				body = new TextDecoder().decode(await request.arrayBuffer());
				return HttpResponse.json({ id: "cs_standing_1", url: "https://checkout.stripe.com/c/cs_standing_1" });
			}),
		);
		const res = await SELF.fetch("https://example.com/billing/checkout", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ email: "standing@example.com", plan: "standing" }),
		});
		expect(res.status).toBe(200);
		const params = new URLSearchParams(body);
		expect(params.get("line_items[0][price]")).toBe(env.STRIPE_STANDING_PRICE_ID);
		expect(params.get("line_items[0][quantity]")).toBe("1");
		expect(params.get("line_items[1][price]")).toBe(env.STRIPE_PRICE_ID);
		expect(params.get("line_items[1][quantity]")).toBeNull();
		expect(params.get("metadata[plan]")).toBe("standing");
		expect(params.get("custom_text[submit][message]")).toContain("$29/month");
	});

	it("provisions a standing key from the plan metadata on the webhook", async () => {
		const event = completedSessionEvent("cs_standing_2", "sub_standing_2") as {
			data: { object: Record<string, unknown> };
		};
		event.data.object.metadata = { plan: "standing" };
		expect((await deliverWebhook(event as Record<string, unknown>)).status).toBe(200);

		const reserved = await env.DB.prepare(
			"SELECT plan FROM provisioned_keys WHERE checkout_session_id = 'cs_standing_2'",
		).first<{ plan: string }>();
		expect(reserved?.plan).toBe("standing");

		const claim = await SELF.fetch(claimRequest("cs_standing_2"));
		expect(claim.status).toBe(200);
		const key = await env.DB.prepare(
			"SELECT COALESCE(tier, plan) AS plan FROM api_keys WHERE stripe_subscription_id = 'sub_standing_2'",
		).first<{
			plan: string;
		}>();
		expect(key?.plan).toBe("standing");
	});

	it("bills standing keys only beyond the monthly inclusion", async () => {
		let meterEvents = 0;
		server.use(
			http.post("https://api.stripe.com/v1/billing/meter_events", () => {
				meterEvents += 1;
				return HttpResponse.json({ identifier: `me_${meterEvents}` });
			}),
		);
		const { rawKey, id } = await createApiKey(env.DB, {
			plan: "standing",
			monthlyQuota: 1000000,
			email: "standing@example.com",
			stripeCustomerId: "cus_standing_1",
			stripeSubscriptionId: "sub_standing_1",
		});
		// Pre-seed this month's usage to one call under the inclusion.
		const included = env.STANDING_INCLUDED_CALLS;
		const seed = Array.from({ length: included - 1 }, () =>
			env.DB.prepare("INSERT INTO usage_events (id, key_id, route, qty) VALUES (?, ?, 'changes', 1)").bind(
				crypto.randomUUID(),
				id,
			),
		);
		for (let i = 0; i < seed.length; i += 50) {
			await env.DB.batch(seed.slice(i, i + 50));
		}

		// Call #included stays covered by the flat fee...
		expect(
			(
				await SELF.fetch(
					new Request("https://example.com/v1/changes?limit=1", { headers: { authorization: `Bearer ${rawKey}` } }),
				)
			).status,
		).toBe(200);
		await new Promise((resolve) => setTimeout(resolve, 30));
		expect(meterEvents).toBe(0);
		// ...and call #included+1 reports as overage.
		expect(
			(
				await SELF.fetch(
					new Request("https://example.com/v1/changes?limit=1", { headers: { authorization: `Bearer ${rawKey}` } }),
				)
			).status,
		).toBe(200);
		await new Promise((resolve) => setTimeout(resolve, 30));
		expect(meterEvents).toBe(1);
	});
});

describe("lifetime free allowance", () => {
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

	it("reports meter events only after the first FREE_CALL_ALLOWANCE calls", async () => {
		let meterEvents = 0;
		server.use(
			http.post("https://api.stripe.com/v1/billing/meter_events", () => {
				meterEvents += 1;
				return HttpResponse.json({ identifier: `me_${meterEvents}` });
			}),
		);
		const { rawKey } = await createApiKey(env.DB, {
			plan: "pro",
			monthlyQuota: 1000000,
			email: "meter@example.com",
			stripeCustomerId: "cus_meter_1",
			stripeSubscriptionId: "sub_meter_1",
		});
		const allowance = env.FREE_CALL_ALLOWANCE;
		expect(allowance).toBe(30);
		for (let i = 0; i < allowance + 2; i++) {
			const res = await SELF.fetch(
				new Request("https://example.com/v1/changes?limit=1", {
					headers: { authorization: `Bearer ${rawKey}` },
				}),
			);
			expect(res.status).toBe(200);
		}
		// waitUntil-delivered meter reports flush asynchronously.
		await new Promise((resolve) => setTimeout(resolve, 50));
		expect(meterEvents).toBe(2);
	});
});

describe("account deletion cancels billing", () => {
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

	it("calls Stripe to cancel the subscription tied to a deleted key", async () => {
		let cancelled = "";
		server.use(
			http.delete("https://api.stripe.com/v1/subscriptions/sub_del_1", () => {
				cancelled = "sub_del_1";
				return HttpResponse.json({ id: "sub_del_1", status: "canceled" });
			}),
		);
		await createApiKey(env.DB, {
			plan: "pro",
			monthlyQuota: 1000000,
			email: "payer@example.com",
			stripeSubscriptionId: "sub_del_1",
		});
		const res = await SELF.fetch("https://example.com/account/delete", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ email: "payer@example.com" }),
		});
		expect(res.status).toBe(200);
		expect(cancelled).toBe("sub_del_1");
		expect((await env.DB.prepare("SELECT id FROM api_keys").all()).results).toHaveLength(0);
	});
});

describe("checkout", () => {
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

	it("creates a Stripe checkout session and returns its url", async () => {
		let checkoutBody = "";
		server.use(
			http.post("https://api.stripe.com/v1/checkout/sessions", async ({ request }) => {
				checkoutBody = new TextDecoder().decode(await request.arrayBuffer());
				return HttpResponse.json({ id: "cs_1", url: "https://checkout.stripe.com/c/cs_1" });
			}),
		);

		const res = await SELF.fetch("https://example.com/billing/checkout", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ email: "buyer@example.com" }),
		});
		expect(res.status).toBe(200);
		await expect(res.json()).resolves.toEqual({ url: "https://checkout.stripe.com/c/cs_1" });
		const params = new URLSearchParams(checkoutBody);
		expect(params.get("custom_text[submit][message]")).toContain("Your first 30 API calls are free");
		expect(params.get("custom_text[submit][message]")).toContain("US$0.10 per API call after that");
		expect(params.get("custom_text[submit][message]")).toContain("Cancel anytime.");
		expect(checkoutBody).not.toContain("US%242");
	});

	it("rejects invalid emails", async () => {
		const res = await SELF.fetch("https://example.com/billing/checkout", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ email: "not-an-email" }),
		});
		expect(res.status).toBe(400);
	});
});

describe("stripe webhook + key claim", () => {
	beforeEach(clearTables);

	it("rejects unsigned and badly signed events", async () => {
		const unsigned = await SELF.fetch("https://example.com/webhooks/stripe", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(completedSessionEvent("cs_x")),
		});
		expect(unsigned.status).toBe(400);

		const badlySigned = await SELF.fetch("https://example.com/webhooks/stripe", {
			method: "POST",
			headers: { "content-type": "application/json", "stripe-signature": "t=1,v1=deadbeef" },
			body: JSON.stringify(completedSessionEvent("cs_x")),
		});
		expect(badlySigned.status).toBe(400);
	});

	it("reserves idempotently: webhook replays leave one reservation and zero stored keys", async () => {
		expect((await deliverWebhook(completedSessionEvent("cs_once"))).status).toBe(200);
		expect((await deliverWebhook(completedSessionEvent("cs_once"))).status).toBe(200);

		const reservations = await env.DB.prepare("SELECT checkout_session_id FROM provisioned_keys").all();
		expect(reservations.results).toHaveLength(1);
		// Lazy-claim design: no API key exists (and none is stored) until claim.
		const keys = await env.DB.prepare("SELECT id FROM api_keys").all();
		expect(keys.results).toHaveLength(0);
	});

	it("walks the full claim flow: pending -> ready -> revealed -> claimed-before", async () => {
		const pending = await SELF.fetch("https://example.com/billing/success?session_id=cs_missing");
		expect(pending.headers.get("cache-control")).toBe("no-store");
		expect(await pending.text()).toContain("confirming your payment");

		await deliverWebhook(completedSessionEvent("cs_flow"));

		const ready = await SELF.fetch("https://example.com/billing/success?session_id=cs_flow");
		const readyHtml = await ready.text();
		expect(readyHtml).toContain("Reveal my API key");
		expect(readyHtml).not.toContain("fk_");

		const revealed = await SELF.fetch(claimRequest("cs_flow"));
		expect(revealed.headers.get("cache-control")).toBe("no-store");
		expect(revealed.headers.get("referrer-policy")).toBe("no-referrer");
		const revealedHtml = await revealed.text();
		expect(revealedHtml).toMatch(/fk_[A-Za-z0-9_-]{32}/);
		expect(revealedHtml).toContain("only once");

		const again = await SELF.fetch(claimRequest("cs_flow"));
		expect(await again.text()).toContain("already been shown");
		const successAgain = await SELF.fetch("https://example.com/billing/success?session_id=cs_flow");
		expect(await successAgain.text()).toContain("already been shown");

		const keys = await env.DB.prepare("SELECT plan, monthly_quota, stripe_subscription_id FROM api_keys").all();
		expect(keys.results).toHaveLength(1);
		expect(keys.results[0]).toMatchObject({
			plan: "pro",
			monthly_quota: 1000000,
			stripe_subscription_id: "sub_test_1",
		});
	});

	it("concurrent claims reveal the key to at most one caller", async () => {
		await deliverWebhook(completedSessionEvent("cs_race"));

		const [a, b] = await Promise.all([SELF.fetch(claimRequest("cs_race")), SELF.fetch(claimRequest("cs_race"))]);
		const bodies = [await a.text(), await b.text()];
		const reveals = bodies.filter((html) => /fk_[A-Za-z0-9_-]{32}/.test(html));
		expect(reveals).toHaveLength(1);

		const keys = await env.DB.prepare("SELECT id FROM api_keys").all();
		expect(keys.results).toHaveLength(1);
	});

	it("a subscription deleted BEFORE the claim tombstones the reservation: no key is ever issued", async () => {
		await deliverWebhook(completedSessionEvent("cs_tomb", "sub_dead"));
		await deliverWebhook({
			id: "evt_del_early",
			type: "customer.subscription.deleted",
			data: { object: { id: "sub_dead" } },
		});

		const claim = await SELF.fetch(claimRequest("cs_tomb"));
		expect(await claim.text()).toContain("no longer active");
		const keys = await env.DB.prepare("SELECT id FROM api_keys").all();
		expect(keys.results).toHaveLength(0);
	});

	it("a subscription deleted AFTER the claim revokes API access", async () => {
		await deliverWebhook(completedSessionEvent("cs_revoke", "sub_gone"));
		const revealed = await SELF.fetch(claimRequest("cs_revoke"));
		const match = (await revealed.text()).match(/fk_[A-Za-z0-9_-]{32}/);
		expect(match).not.toBeNull();
		const rawKey = match?.[0] ?? "";

		const before = await SELF.fetch(
			new Request("https://example.com/v1/changes", {
				headers: { authorization: `Bearer ${rawKey}` },
			}),
		);
		expect(before.status).toBe(200);

		await deliverWebhook({
			id: "evt_del",
			type: "customer.subscription.deleted",
			data: { object: { id: "sub_gone" } },
		});

		const after = await SELF.fetch(
			new Request("https://example.com/v1/changes", {
				headers: { authorization: `Bearer ${rawKey}` },
			}),
		);
		expect(after.status).toBe(401);
	});
});
