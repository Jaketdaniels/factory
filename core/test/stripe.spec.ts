import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { ApiError } from "../src/errors";
import { createCheckoutSession, reportMeterEvent, verifyStripeSignature } from "../src/stripe";
import { signStripePayload } from "./helpers";

const SECRET = "whsec_test_secret";

describe("verifyStripeSignature", () => {
	const body = JSON.stringify({ id: "evt_1", type: "checkout.session.completed" });

	it("accepts a correctly signed payload within tolerance", async () => {
		const t = Math.floor(Date.now() / 1000);
		const header = await signStripePayload(body, SECRET, t);
		await expect(verifyStripeSignature(body, header, SECRET)).resolves.toBe(true);
	});

	it("rejects a tampered body", async () => {
		const t = Math.floor(Date.now() / 1000);
		const header = await signStripePayload(body, SECRET, t);
		await expect(verifyStripeSignature(`${body} `, header, SECRET)).resolves.toBe(false);
	});

	it("rejects a stale timestamp outside tolerance", async () => {
		const t = Math.floor(Date.now() / 1000) - 600;
		const header = await signStripePayload(body, SECRET, t);
		await expect(verifyStripeSignature(body, header, SECRET)).resolves.toBe(false);
	});

	it("rejects missing or malformed headers", async () => {
		await expect(verifyStripeSignature(body, undefined, SECRET)).resolves.toBe(false);
		await expect(verifyStripeSignature(body, "", SECRET)).resolves.toBe(false);
		await expect(verifyStripeSignature(body, "t=abc,v1=zz", SECRET)).resolves.toBe(false);
		await expect(verifyStripeSignature(body, "v1=deadbeef", SECRET)).resolves.toBe(false);
	});

	it("accepts when any v1 candidate matches (key rotation)", async () => {
		const t = Math.floor(Date.now() / 1000);
		const valid = await signStripePayload(body, SECRET, t);
		const v1 = valid.split("v1=")[1];
		const header = `t=${t},v1=${"ab".repeat(32)},v1=${v1}`;
		await expect(verifyStripeSignature(body, header, SECRET)).resolves.toBe(true);
	});
});

describe("stripe REST calls", () => {
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

	it("creates a subscription checkout session without payment_method_types", async () => {
		let capturedBody = "";
		server.use(
			http.post("https://api.stripe.com/v1/checkout/sessions", async ({ request }) => {
				capturedBody = new TextDecoder().decode(await request.arrayBuffer());
				return HttpResponse.json({ id: "cs_test_1", url: "https://checkout.stripe.com/c/cs_test_1" });
			}),
		);

		const session = await createCheckoutSession({
			secretKey: "rk_test_dummy",
			priceId: "price_123",
			successUrl: "https://example.com/billing/success?session_id={CHECKOUT_SESSION_ID}",
			cancelUrl: "https://example.com/",
			customerEmail: "a@b.co",
		});
		expect(session.id).toBe("cs_test_1");
		expect(session.url).toContain("checkout.stripe.com");
		const params = new URLSearchParams(capturedBody);
		expect(params.get("mode")).toBe("subscription");
		expect(params.get("line_items[0][price]")).toBe("price_123");
		expect(params.get("customer_email")).toBe("a@b.co");
		expect(capturedBody).not.toContain("payment_method_types");
	});

	it("reports billing meter events", async () => {
		let capturedBody = "";
		server.use(
			http.post("https://api.stripe.com/v1/billing/meter_events", async ({ request }) => {
				capturedBody = new TextDecoder().decode(await request.arrayBuffer());
				return HttpResponse.json({ identifier: "me_1" });
			}),
		);

		await reportMeterEvent({
			secretKey: "rk_test_dummy",
			eventName: "api_request",
			stripeCustomerId: "cus_123",
			value: 1,
		});
		const params = new URLSearchParams(capturedBody);
		expect(params.get("event_name")).toBe("api_request");
		expect(params.get("payload[stripe_customer_id]")).toBe("cus_123");
		expect(params.get("payload[value]")).toBe("1");
	});

	it("surfaces Stripe errors as ApiError without leaking the key", async () => {
		server.use(
			http.post("https://api.stripe.com/v1/checkout/sessions", () =>
				HttpResponse.json({ error: { message: "No such price: price_nope" } }, { status: 400 }),
			),
		);

		const err: unknown = await createCheckoutSession({
			secretKey: "rk_test_dummy",
			priceId: "price_nope",
			successUrl: "https://example.com/s",
			cancelUrl: "https://example.com/c",
		}).then(
			() => null,
			(e: unknown) => e,
		);
		expect(err).toBeInstanceOf(ApiError);
		const apiErr = err as ApiError;
		expect(apiErr.status).toBe(502);
		expect(apiErr.code).toBe("stripe_error");
		// Generic client-facing message: no Stripe detail, no key material.
		expect(apiErr.message).toBe("Payment provider rejected the request. Please try again later.");
		expect(apiErr.message).not.toContain("price_nope");
		expect(apiErr.message).not.toContain("rk_test_dummy");
	});
});
