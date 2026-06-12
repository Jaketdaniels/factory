import { env, SELF } from "cloudflare:test";
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
			body: JSON.stringify({ email: "buyer@example.com", plan: "fixed_monthly" }),
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as { url: string };
		expect(body.url).toMatch(/^http:\/\/localhost:8787\/billing\/success\?session_id=free_/);
		expect(stripeCalled).toBe(false);

		const sessionId = new URL(body.url).searchParams.get("session_id") ?? "";
		const ready = await SELF.fetch(`https://example.com/billing/success?session_id=${sessionId}`);
		expect(await ready.text()).toContain("Reveal my API key");

		const revealed = await SELF.fetch(claimRequest(sessionId));
		expect(revealed.status).toBe(200);
		expect(await revealed.text()).toMatch(/fk_[A-Za-z0-9_-]{32}/);
		const key = await env.DB.prepare("SELECT COALESCE(tier, plan) AS plan FROM api_keys").first<{ plan: string }>();
		expect(key?.plan).toBe("standing");
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
			monthly_quota: 10000,
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
			new Request("https://example.com/v1/echo", {
				method: "POST",
				headers: { authorization: `Bearer ${rawKey}`, "content-type": "application/json" },
				body: JSON.stringify({ message: "hi" }),
			}),
		);
		expect(before.status).toBe(200);

		await deliverWebhook({
			id: "evt_del",
			type: "customer.subscription.deleted",
			data: { object: { id: "sub_gone" } },
		});

		const after = await SELF.fetch(
			new Request("https://example.com/v1/echo", {
				method: "POST",
				headers: { authorization: `Bearer ${rawKey}`, "content-type": "application/json" },
				body: JSON.stringify({ message: "hi" }),
			}),
		);
		expect(after.status).toBe(401);
	});
});
