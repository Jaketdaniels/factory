import {
	type CheckoutSessionCompleted,
	checkoutSessionCompletedSchema,
	createApiKey,
	createCheckoutSession,
	errorBody,
	getStripeSecrets,
	getWebhookSecret,
	type MeteredVariables,
	metered,
	onApiError,
	revokeKeysForSubscription,
	stripeEventSchema,
	subscriptionDeletedSchema,
	track,
	verifyStripeSignature,
} from "@factory/core";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { listFeedItems } from "./feed-item";
import { landingPage, successPage } from "./landing";
import { runRecallIngest } from "./recall-ingest";

type AppEnv = {
	Bindings: Env;
	Variables: MeteredVariables;
};

const changesQuerySchema = z.object({
	category: z.enum(["fda_recall_food", "fda_recall_drug", "fda_recall_device"]).optional(),
	limit: z.coerce.number().int().min(1).max(100).default(50),
});
const adminEnvSchema = z.object({ ADMIN_TOKEN: z.string().min(16).optional() });
const checkoutBodySchema = z.object({ email: z.string().email() });
const sessionIdSchema = z.object({ session_id: z.string().min(1) });

/**
 * Idempotently reserve a completed Checkout Session (single insert — fully
 * retry/race-safe). The API key itself is created lazily at claim time so no
 * raw key is ever persisted.
 */
async function reserveSession(env: Env, session: CheckoutSessionCompleted): Promise<void> {
	await env.DB.prepare(
		"INSERT INTO provisioned_keys (checkout_session_id, email, stripe_customer_id, stripe_subscription_id) VALUES (?, ?, ?, ?) ON CONFLICT(checkout_session_id) DO NOTHING",
	)
		.bind(session.id, session.customer_details?.email ?? null, session.customer ?? null, session.subscription ?? null)
		.run();
}

const provisionedRowSchema = z.object({
	email: z.string().nullable(),
	stripe_customer_id: z.string().nullable(),
	stripe_subscription_id: z.string().nullable(),
	claimed_at: z.string().nullable(),
	revoked_at: z.string().nullable(),
});

/** The key reveal carries a secret: never cache, never leak the URL via referrer. */
function setSensitiveHeaders(c: { header: (name: string, value: string) => void }): void {
	c.header("cache-control", "no-store");
	c.header("referrer-policy", "no-referrer");
}

const app = new Hono<AppEnv>()
	.onError(onApiError)
	.notFound((c) => c.json(errorBody("not_found", "No such route."), 404))

	.get("/", async (c) => {
		c.executionCtx.waitUntil(track(c.env.DB, "pageview", { path: "/" }));
		const items = await listFeedItems(c.env.DB, { limit: 15 });
		c.header("cache-control", "public, max-age=600");
		return c.html(landingPage(items));
	})

	.get("/llms.txt", (c) => {
		c.header("content-type", "text/markdown; charset=utf-8");
		c.header("cache-control", "public, max-age=3600");
		return c.body(`# recalls.netm8 — FDA recall changelog

Structured change events for FDA food, drug, and device recalls (openFDA
enforcement reports; US federal work, public domain). Records follow the
netm8 FeedItemV1 contract: https://netm8.com/standards/feed-item-v1.schema.json

Free: this index, the landing changelog, /feed.xml (RSS).
Keyed: GET /v1/changes?category=fda_recall_food|fda_recall_drug|fda_recall_device&limit=50
(Authorization: Bearer <key>; keys at https://recalls.netm8.com/#checkout).

Not medical or legal advice. Verify against the cited source before
compliance use.
`);
	})

	.get("/feed.xml", async (c) => {
		const items = await listFeedItems(c.env.DB, { limit: 30 });
		const entries = items
			.map(
				(item) => `<item>
<title>${escapeXml(item.summary.title)}</title>
<link>${escapeXml(item.provenance.primary_source_url)}</link>
<guid isPermaLink="false">${escapeXml(item.delivery.rss_guid ?? item.id)}</guid>
<pubDate>${new Date(item.dates.published_at).toUTCString()}</pubDate>
<description>${escapeXml(item.summary.short_summary ?? item.summary.abstract ?? "")}</description>
</item>`,
			)
			.join("\n");
		c.header("content-type", "application/rss+xml; charset=utf-8");
		c.header("cache-control", "public, max-age=3600");
		return c.body(`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>FDA recall changelog — recalls.netm8</title>
<link>${c.env.APP_BASE_URL}</link>
<description>FDA food, drug, and device recalls as structured change events.</description>
${entries}
</channel></rss>`);
	})

	.get("/healthz", (c) => c.json({ ok: true }))

	// The product surface: validated change events from the contract store.
	// Validator runs BEFORE metered() so malformed (4xx) requests are never billed.
	.get("/v1/changes", zValidator("query", changesQuerySchema), metered<AppEnv>("changes"), async (c) => {
		const { category, limit } = c.req.valid("query");
		const items = await listFeedItems(c.env.DB, { category, limit });
		return c.json({ changes: items, count: items.length });
	})

	// Operational trigger for ingest (the cron does this 4x daily).
	.post("/admin/ingest", async (c) => {
		const adminEnv = adminEnvSchema.parse(c.env);
		if (adminEnv.ADMIN_TOKEN === undefined) {
			return c.json(errorBody("missing_configuration", "ADMIN_TOKEN is not configured."), 503);
		}
		const supplied = c.req.header("x-admin-token");
		if (supplied === undefined || supplied !== adminEnv.ADMIN_TOKEN) {
			return c.json(errorBody("forbidden", "Invalid admin token."), 403);
		}
		const result = await runRecallIngest(c.env, new Date());
		return c.json(result);
	})

	.post("/billing/checkout", zValidator("json", checkoutBodySchema), async (c) => {
		const { email } = c.req.valid("json");
		const secrets = getStripeSecrets(c.env);
		const session = await createCheckoutSession({
			secretKey: secrets.STRIPE_SECRET_KEY,
			priceId: c.env.STRIPE_PRICE_ID,
			successUrl: `${c.env.APP_BASE_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
			cancelUrl: `${c.env.APP_BASE_URL}/`,
			customerEmail: email,
		});
		c.executionCtx.waitUntil(track(c.env.DB, "checkout_started"));
		return c.json({ url: session.url });
	})

	// Read-only: shows pending / reveal-button / already-claimed. The actual
	// reveal is a POST so prefetchers and link scanners can never burn the key.
	.get("/billing/success", zValidator("query", sessionIdSchema), async (c) => {
		setSensitiveHeaders(c);
		const { session_id } = c.req.valid("query");
		const row = await c.env.DB.prepare(
			"SELECT email, stripe_customer_id, stripe_subscription_id, claimed_at, revoked_at FROM provisioned_keys WHERE checkout_session_id = ?",
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

	.post("/billing/claim", zValidator("form", sessionIdSchema), async (c) => {
		setSensitiveHeaders(c);
		const { session_id } = c.req.valid("form");
		// Atomic claim: exactly one concurrent request wins the conditional UPDATE.
		const claim = await c.env.DB.prepare(
			"UPDATE provisioned_keys SET claimed_at = datetime('now') WHERE checkout_session_id = ? AND claimed_at IS NULL AND revoked_at IS NULL",
		)
			.bind(session_id)
			.run();
		if (claim.meta.changes === 0) {
			const row = await c.env.DB.prepare(
				"SELECT email, stripe_customer_id, stripe_subscription_id, claimed_at, revoked_at FROM provisioned_keys WHERE checkout_session_id = ?",
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
			"SELECT email, stripe_customer_id, stripe_subscription_id, claimed_at, revoked_at FROM provisioned_keys WHERE checkout_session_id = ?",
		)
			.bind(session_id)
			.first();
		const provisioned = provisionedRowSchema.parse(row);
		try {
			const created = await createApiKey(c.env.DB, {
				plan: "pro",
				monthlyQuota: c.env.PRO_MONTHLY_QUOTA,
				email: provisioned.email ?? undefined,
				stripeCustomerId: provisioned.stripe_customer_id ?? undefined,
				stripeSubscriptionId: provisioned.stripe_subscription_id ?? undefined,
			});
			await c.env.DB.prepare("UPDATE provisioned_keys SET key_id = ? WHERE checkout_session_id = ?")
				.bind(created.id, session_id)
				.run();
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

function escapeXml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&apos;");
}

export type AppType = typeof app;

export default {
	fetch: app.fetch,
	async scheduled(controller, env, ctx): Promise<void> {
		ctx.waitUntil(track(env.DB, "cron_tick", { cron: controller.cron }));
		await runRecallIngest(env, new Date());
	},
} satisfies ExportedHandler<Env>;
