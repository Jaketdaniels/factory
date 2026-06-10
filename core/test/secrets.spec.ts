import { describe, expect, it } from "vitest";
import { ApiError } from "../src/errors";
import { getStripeSecrets, getWebhookSecret } from "../src/secrets";

describe("getStripeSecrets", () => {
	it("returns both secrets when present", () => {
		const env = { STRIPE_SECRET_KEY: "rk_test_x", STRIPE_WEBHOOK_SECRET: "whsec_x" };
		expect(getStripeSecrets(env)).toEqual(env);
	});

	it("throws missing_configuration when either secret is absent", () => {
		expect(() => getStripeSecrets({ STRIPE_WEBHOOK_SECRET: "whsec_x" })).toThrowError(ApiError);
		expect(() => getStripeSecrets({ STRIPE_SECRET_KEY: "rk_test_x" })).toThrowError(ApiError);
	});
});

describe("getWebhookSecret", () => {
	// Regression: webhook delivery must keep working before the checkout key
	// is provisioned — Stripe sends events as soon as the endpoint exists.
	it("needs only the webhook secret, not the checkout key", () => {
		expect(getWebhookSecret({ STRIPE_WEBHOOK_SECRET: "whsec_x" })).toBe("whsec_x");
	});

	it("throws missing_configuration when absent", () => {
		expect(() => getWebhookSecret({})).toThrowError(ApiError);
	});
});
