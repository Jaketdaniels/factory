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

describe("fixed-rate tiers", () => {
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

	it("creates a free-launch reservation for the monthly fixed-rate plan", async () => {
		let stripeCalled = false;
		server.use(
			http.post("https://api.stripe.com/v1/checkout/sessions", () => {
				stripeCalled = true;
				return HttpResponse.json({ id: "cs_standing_1", url: "https://checkout.stripe.com/c/cs_standing_1" });
			}),
		);
		const res = await SELF.fetch("https://example.com/billing/checkout", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ email: "standing@example.com", plan: "fixed_monthly" }),
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as { url: string };
		expect(body.url).toMatch(/^https:\/\/tariff\.watch\/billing\/success\?session_id=free_/);
		expect(stripeCalled).toBe(false);
		const row = await env.DB.prepare(
			"SELECT plan, billing_interval FROM provisioned_keys WHERE checkout_session_id = ?",
		)
			.bind(new URL(body.url).searchParams.get("session_id"))
			.first<{ plan: string; billing_interval: string }>();
		expect(row).toEqual({ plan: "standing", billing_interval: "monthly" });
	});

	it("provisions an annual fixed-rate key from the selected free-launch plan", async () => {
		const checkout = await SELF.fetch("https://example.com/billing/checkout", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ email: "annual@example.com", plan: "fixed_annual" }),
		});
		const { url } = (await checkout.json()) as { url: string };
		const sessionId = new URL(url).searchParams.get("session_id") ?? "";
		expect((await SELF.fetch(claimRequest(sessionId))).status).toBe(200);
		const key = await env.DB.prepare(
			"SELECT COALESCE(tier, plan) AS plan FROM api_keys WHERE email = 'annual@example.com'",
		).first<{
			plan: string;
		}>();
		expect(key?.plan).toBe("standing");
	});

	it("provisions a standing key from legacy plan metadata on the webhook", async () => {
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

	it("reports every fixed-rate call to the meter — the inclusion lives in the price tiers", async () => {
		let meterEvents = 0;
		server.use(
			http.post("https://api.stripe.com/v1/billing/meter_events", () => {
				meterEvents += 1;
				return HttpResponse.json({ identifier: `me_${meterEvents}` });
			}),
		);
		const { rawKey } = await createApiKey(env.DB, {
			plan: "standing",
			monthlyQuota: 1000000,
			email: "standing@example.com",
			stripeCustomerId: "cus_standing_1",
			stripeSubscriptionId: "sub_standing_1",
		});
		for (let i = 0; i < 2; i++) {
			const res = await SELF.fetch(
				new Request("https://example.com/v1/changes?limit=1", { headers: { authorization: `Bearer ${rawKey}` } }),
			);
			expect(res.status).toBe(200);
		}
		await new Promise((resolve) => setTimeout(resolve, 30));
		// The first 500/month are free via the graduated tier, so the meter
		// must still see them — suppressing here would double-discount.
		expect(meterEvents).toBe(2);
	});
});

describe("pay-as-you-go metering", () => {
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

	it("reports every call to the meter — the free 30 are a signup credit, not suppressed events", async () => {
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
		for (let i = 0; i < 5; i++) {
			const res = await SELF.fetch(
				new Request("https://example.com/v1/changes?limit=1", {
					headers: { authorization: `Bearer ${rawKey}` },
				}),
			);
			expect(res.status).toBe(200);
		}
		// waitUntil-delivered meter reports flush asynchronously.
		await new Promise((resolve) => setTimeout(resolve, 50));
		expect(meterEvents).toBe(5);
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

	it("creates a free-launch reservation and returns its success url", async () => {
		let stripeCalled = false;
		server.use(
			http.post("https://api.stripe.com/v1/checkout/sessions", () => {
				stripeCalled = true;
				return HttpResponse.json({ id: "cs_1", url: "https://checkout.stripe.com/c/cs_1" });
			}),
		);

		const res = await SELF.fetch("https://example.com/billing/checkout", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ email: "buyer@example.com" }),
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as { url: string };
		expect(body.url).toMatch(/^https:\/\/tariff\.watch\/billing\/success\?session_id=free_/);
		expect(stripeCalled).toBe(false);
	});

	it("rejects invalid emails", async () => {
		const res = await SELF.fetch("https://example.com/billing/checkout", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ email: "not-an-email" }),
		});
		expect(res.status).toBe(400);
	});

	it("rejects unknown pricing plans", async () => {
		const res = await SELF.fetch("https://example.com/billing/checkout", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ email: "buyer@example.com", plan: "enterprise" }),
		});
		expect(res.status).toBe(400);
	});
});

describe("stripe webhook + key claim", () => {
	const server = setupServer();
	let grantBodies: string[] = [];
	let grantIdempotencyKeys: string[] = [];

	beforeAll(() => {
		server.listen({ onUnhandledRequest: "error" });
	});
	afterEach(() => {
		server.resetHandlers();
	});
	afterAll(() => {
		server.close();
	});
	beforeEach(async () => {
		await clearTables();
		grantBodies = [];
		grantIdempotencyKeys = [];
		// PAYG claims issue the US$3 signup credit grant.
		server.use(
			http.post("https://api.stripe.com/v1/billing/credit_grants", async ({ request }) => {
				grantBodies.push(new TextDecoder().decode(await request.arrayBuffer()));
				grantIdempotencyKeys.push(request.headers.get("idempotency-key") ?? "");
				return HttpResponse.json({ id: `credgr_${grantBodies.length}` });
			}),
			http.post("https://api.stripe.com/v1/billing/meter_events", () =>
				HttpResponse.json({ identifier: "me_key_claim_flow" }),
			),
		);
	});

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

		// Launch mode is free and must not create Stripe-side credit grants.
		// Paid mode keeps the credit-grant path ready for the later switch.
		expect(grantBodies).toHaveLength(0);
		expect(grantIdempotencyKeys).toHaveLength(0);

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

	it("a failed credit grant never blocks the key reveal", async () => {
		server.use(
			http.post("https://api.stripe.com/v1/billing/credit_grants", () =>
				HttpResponse.json({ error: { message: "insufficient permissions" } }, { status: 401 }),
			),
		);
		await deliverWebhook(completedSessionEvent("cs_nogrant"));
		const revealed = await SELF.fetch(claimRequest("cs_nogrant"));
		expect(revealed.status).toBe(200);
		expect(await revealed.text()).toMatch(/fk_[A-Za-z0-9_-]{32}/);
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
