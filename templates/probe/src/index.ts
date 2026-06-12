import {
	billingModeSchema,
	type CheckoutPlan,
	type CheckoutSessionCompleted,
	checkoutPlanFromMetadata,
	checkoutPlanSchema,
	checkoutSessionCompletedSchema,
	createApiKey,
	createCheckoutSession,
	createCreditGrant,
	errorBody,
	getStripeSecrets,
	getWebhookSecret,
	type MeteredVariables,
	metered,
	onApiError,
	provisioningForCheckoutPlan,
	revokeKeysForSubscription,
	stripeEventSchema,
	subscriptionDeletedSchema,
	track,
	verifyStripeSignature,
} from "@factory/core";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { landingPage, successPage } from "./landing";

type AppEnv = {
	Bindings: Env;
	Variables: MeteredVariables;
};

const echoBodySchema = z.object({ message: z.string().min(1).max(1000) });
const checkoutBodySchema = z.object({ email: z.string().email(), plan: checkoutPlanSchema.default("payg") });
const sessionIdSchema = z.object({ session_id: z.string().min(1) });
const billingModeEnvSchema = z.object({ BILLING_MODE: billingModeSchema.default("paid") });

function parseUrlEncodedBody(rawBody: ArrayBuffer): Record<string, string> {
	return Object.fromEntries(new URLSearchParams(new TextDecoder().decode(rawBody)).entries());
}

/**
 * Idempotently reserve a completed Checkout Session (single insert — fully
 * retry/race-safe). The API key itself is created lazily at claim time so no
 * raw key is ever persisted.
 */
async function reserveSession(env: Env, session: CheckoutSessionCompleted): Promise<void> {
	const provisioning = provisioningForCheckoutPlan(checkoutPlanFromMetadata(session.metadata?.plan));
	await env.DB.prepare(
		"INSERT INTO provisioned_keys (checkout_session_id, email, stripe_customer_id, stripe_subscription_id, plan, billing_interval) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(checkout_session_id) DO NOTHING",
	)
		.bind(
			session.id,
			session.customer_details?.email ?? null,
			session.customer ?? null,
			session.subscription ?? null,
			provisioning.reservationPlan,
			provisioning.billingInterval,
		)
		.run();
}

async function reserveFreeLaunchSession(env: Env, email: string, plan: CheckoutPlan): Promise<string> {
	const sessionId = `free_${crypto.randomUUID()}`;
	const provisioning = provisioningForCheckoutPlan(plan);
	await env.DB.prepare(
		"INSERT INTO provisioned_keys (checkout_session_id, email, stripe_customer_id, stripe_subscription_id, plan, billing_interval) VALUES (?, ?, NULL, NULL, ?, ?)",
	)
		.bind(sessionId, email, provisioning.reservationPlan, provisioning.billingInterval)
		.run();
	return sessionId;
}

function successUrl(env: Env, sessionId: string): string {
	const url = new URL("/billing/success", env.APP_BASE_URL);
	url.searchParams.set("session_id", sessionId);
	return url.toString();
}

function checkoutInputForPlan(env: Env, email: string, plan: CheckoutPlan, secretKey: string) {
	const base = {
		secretKey,
		successUrl: `${env.APP_BASE_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
		cancelUrl: `${env.APP_BASE_URL}/`,
		customerEmail: email,
	};
	switch (plan) {
		case "fixed_monthly":
			return {
				...base,
				priceId: env.STRIPE_FIXED_MONTHLY_PRICE_ID,
				extraLineItems: [{ priceId: env.STRIPE_FIXED_MONTHLY_METERED_PRICE_ID, metered: true }],
				metadata: { plan },
				submitNote: `Fixed rate - monthly: ${env.FIXED_MONTHLY_INCLUDED_CALLS} API calls included every month. Overage is US$0.10 per API call. Cancel anytime.`,
			};
		case "fixed_annual":
			return {
				...base,
				priceId: env.STRIPE_FIXED_ANNUAL_PRICE_ID,
				extraLineItems: [{ priceId: env.STRIPE_FIXED_ANNUAL_METERED_PRICE_ID, metered: true }],
				metadata: { plan },
				submitNote: `Fixed rate - annual: ${env.FIXED_ANNUAL_INCLUDED_CALLS} API calls included for the year at a better effective rate. Overage is US$0.10 per API call.`,
			};
		case "payg":
			return {
				...base,
				priceId: env.STRIPE_PRICE_ID,
				meteredPrice: true,
				metadata: { plan },
				submitNote: `Pay as you go: your first ${env.FREE_CALL_ALLOWANCE} API calls are free as signup credit. US$0.10 per API call after that. Cancel anytime.`,
			};
	}
}

const provisionedRowSchema = z.object({
	email: z.string().nullable(),
	stripe_customer_id: z.string().nullable(),
	stripe_subscription_id: z.string().nullable(),
	claimed_at: z.string().nullable(),
	revoked_at: z.string().nullable(),
	plan: z.enum(["payg", "standing"]),
	billing_interval: z.enum(["usage", "monthly", "annual"]),
});

/** The key reveal carries a secret: never cache, never leak the URL via referrer. */
function setSensitiveHeaders(c: { header: (name: string, value: string) => void }): void {
	c.header("cache-control", "no-store");
	c.header("referrer-policy", "no-referrer");
}

const app = new Hono<AppEnv>()
	.onError(onApiError)
	.notFound((c) => c.json(errorBody("not_found", "No such route."), 404))

	.get("/", (c) => {
		c.executionCtx.waitUntil(track(c.env.DB, "pageview", { path: "/" }));
		return c.html(landingPage());
	})

	.get("/healthz", (c) => c.json({ ok: true }))

	// Example metered endpoint — replace with the probe's real API surface.
	// Validator runs BEFORE metered() so malformed (4xx) requests are never billed.
	.post("/v1/echo", zValidator("json", echoBodySchema), metered<AppEnv>("echo"), (c) => {
		const { message } = c.req.valid("json");
		const usage = c.get("usage");
		return c.json({ echo: message, plan: c.get("apiKey").plan, remaining: usage.remaining });
	})

	.post("/billing/checkout", zValidator("json", checkoutBodySchema), async (c) => {
		const { email, plan } = c.req.valid("json");
		const billing = billingModeEnvSchema.parse(c.env);
		if (billing.BILLING_MODE === "free_launch") {
			const sessionId = await reserveFreeLaunchSession(c.env, email, plan);
			c.executionCtx.waitUntil(track(c.env.DB, "checkout_started", { plan, billing_mode: "free_launch" }));
			return c.json({ url: successUrl(c.env, sessionId) });
		}
		const secrets = getStripeSecrets(c.env);
		const session = await createCheckoutSession(checkoutInputForPlan(c.env, email, plan, secrets.STRIPE_SECRET_KEY));
		c.executionCtx.waitUntil(track(c.env.DB, "checkout_started", { plan, billing_mode: "paid" }));
		return c.json({ url: session.url });
	})

	// Read-only: shows pending / reveal-button / already-claimed. The actual
	// reveal is a POST so prefetchers and link scanners can never burn the key.
	.get("/billing/success", zValidator("query", sessionIdSchema), async (c) => {
		setSensitiveHeaders(c);
		const { session_id } = c.req.valid("query");
		const row = await c.env.DB.prepare(
			"SELECT email, stripe_customer_id, stripe_subscription_id, claimed_at, revoked_at, plan, billing_interval FROM provisioned_keys WHERE checkout_session_id = ?",
		)
			.bind(session_id)
			.first();
		if (row === null) {
			return c.html(successPage({ kind: "pending" }));
		}
		const provisioned = provisionedRowSchema.parse(row);
		if (provisioned.revoked_at !== null) {
			return c.html(successPage({ kind: "revoked" }));
		}
		if (provisioned.claimed_at !== null) {
			return c.html(successPage({ kind: "claimed-before" }));
		}
		return c.html(successPage({ kind: "ready", sessionId: session_id }));
	})

	.post("/billing/claim", async (c) => {
		setSensitiveHeaders(c);
		const parsed = sessionIdSchema.safeParse(parseUrlEncodedBody(await c.req.arrayBuffer()));
		if (!parsed.success) {
			return c.json(parsed, 400);
		}
		const { session_id } = parsed.data;
		// Atomic claim: exactly one concurrent request wins the conditional UPDATE.
		const claim = await c.env.DB.prepare(
			"UPDATE provisioned_keys SET claimed_at = datetime('now') WHERE checkout_session_id = ? AND claimed_at IS NULL AND revoked_at IS NULL",
		)
			.bind(session_id)
			.run();
		if (claim.meta.changes === 0) {
			const row = await c.env.DB.prepare(
				"SELECT email, stripe_customer_id, stripe_subscription_id, claimed_at, revoked_at, plan, billing_interval FROM provisioned_keys WHERE checkout_session_id = ?",
			)
				.bind(session_id)
				.first();
			if (row === null) {
				return c.html(successPage({ kind: "pending" }));
			}
			const lost = provisionedRowSchema.parse(row);
			return c.html(successPage({ kind: lost.revoked_at !== null ? "revoked" : "claimed-before" }));
		}
		const row = await c.env.DB.prepare(
			"SELECT email, stripe_customer_id, stripe_subscription_id, claimed_at, revoked_at, plan, billing_interval FROM provisioned_keys WHERE checkout_session_id = ?",
		)
			.bind(session_id)
			.first();
		const provisioned = provisionedRowSchema.parse(row);
		try {
			const created = await createApiKey(c.env.DB, {
				plan: provisioned.plan === "standing" ? "standing" : "pro",
				monthlyQuota: c.env.PRO_MONTHLY_QUOTA,
				email: provisioned.email ?? undefined,
				stripeCustomerId: provisioned.stripe_customer_id ?? undefined,
				stripeSubscriptionId: provisioned.stripe_subscription_id ?? undefined,
			});
			await c.env.DB.prepare("UPDATE provisioned_keys SET key_id = ? WHERE checkout_session_id = ?")
				.bind(created.id, session_id)
				.run();
			if (
				billingModeEnvSchema.parse(c.env).BILLING_MODE === "paid" &&
				provisioned.plan === "payg" &&
				provisioned.stripe_customer_id !== null
			) {
				const secrets = getStripeSecrets(c.env);
				try {
					await createCreditGrant({
						secretKey: secrets.STRIPE_SECRET_KEY,
						customerId: provisioned.stripe_customer_id,
						amountCents: c.env.SIGNUP_CREDIT_CENTS,
						currency: "usd",
						name: `First ${c.env.FREE_CALL_ALLOWANCE} API calls free — ${c.env.APP_BASE_URL} signup credit`,
						idempotencyKey: `signup-credit-${session_id}`,
					});
				} catch (err) {
					console.error(JSON.stringify({ event: "signup_credit_failed", session: session_id, message: String(err) }));
				}
			}
			c.executionCtx.waitUntil(track(c.env.DB, "key_claimed"));
			// Rendered straight from memory — the raw key never touches storage.
			return c.html(successPage({ kind: "revealed", rawKey: created.rawKey }));
		} catch (err) {
			// Roll the claim back so the buyer can retry instead of being stranded.
			await c.env.DB.prepare(
				"UPDATE provisioned_keys SET claimed_at = NULL WHERE checkout_session_id = ? AND key_id IS NULL",
			)
				.bind(session_id)
				.run();
			throw err;
		}
	})

	.post("/webhooks/stripe", async (c) => {
		const rawBody = await c.req.text();
		const webhookSecret = getWebhookSecret(c.env);
		const valid = await verifyStripeSignature(rawBody, c.req.header("stripe-signature"), webhookSecret);
		if (!valid) {
			return c.json(errorBody("invalid_signature", "Webhook signature verification failed."), 400);
		}
		const event = stripeEventSchema.parse(JSON.parse(rawBody));
		if (event.type === "checkout.session.completed") {
			await reserveSession(c.env, checkoutSessionCompletedSchema.parse(event.data.object));
		} else if (event.type === "customer.subscription.deleted") {
			const subscription = subscriptionDeletedSchema.parse(event.data.object);
			await revokeKeysForSubscription(c.env.DB, subscription.id);
			// Tombstone unclaimed reservations too: Stripe events can arrive out of
			// order, so a deletion may precede the claim that would mint the key.
			await c.env.DB.prepare(
				"UPDATE provisioned_keys SET revoked_at = datetime('now') WHERE stripe_subscription_id = ?",
			)
				.bind(subscription.id)
				.run();
		}
		c.executionCtx.waitUntil(track(c.env.DB, "stripe_webhook", { type: event.type }));
		return c.json({ received: true });
	});

export type AppType = typeof app;

export default {
	fetch: app.fetch,
	// Probe-specific scheduled work (daily snapshots, digests, alerts).
	// Enable the cron trigger in wrangler.jsonc when implementing.
	async scheduled(controller, env, ctx): Promise<void> {
		ctx.waitUntil(track(env.DB, "cron_tick", { cron: controller.cron }));
	},
} satisfies ExportedHandler<Env>;
