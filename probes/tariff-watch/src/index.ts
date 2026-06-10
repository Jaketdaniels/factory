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
import { isoDate, runIngest } from "./ingest";
import { type LandingDoc, landingPage, successPage } from "./landing";

type AppEnv = {
	Bindings: Env;
	Variables: MeteredVariables;
};

const checkoutBodySchema = z.object({ email: z.string().email() });
const sessionIdSchema = z.object({ session_id: z.string().min(1) });
const freeKeyBodySchema = z.object({ email: z.string().email() });
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const changesQuerySchema = z.object({
	since: z.string().regex(DATE_PATTERN, "Use YYYY-MM-DD").optional(),
	limit: z.coerce.number().int().min(1).max(100).default(50),
});
const snapshotParamSchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}\.md$/, "Use YYYY-MM-DD.md") });

const storedDocRowSchema = z.object({
	document_number: z.string(),
	title: z.string(),
	doc_type: z.string(),
	abstract: z.string().nullable(),
	publication_date: z.string(),
	url: z.string(),
	agencies: z.string(),
});

const adminEnvSchema = z.object({ ADMIN_TOKEN: z.string().min(16).optional() });

/** Constant-time string comparison via hashed digests (lengths may differ). */
async function timingSafeEqualStrings(a: string, b: string): Promise<boolean> {
	const encoder = new TextEncoder();
	const [da, db] = await Promise.all([
		crypto.subtle.digest("SHA-256", encoder.encode(a)),
		crypto.subtle.digest("SHA-256", encoder.encode(b)),
	]);
	return crypto.subtle.timingSafeEqual(da, db);
}

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
		const [docsResult, snapshotRow] = await Promise.all([
			c.env.DB.prepare(
				"SELECT document_number, title, doc_type, abstract, publication_date, url, agencies FROM tariff_documents ORDER BY publication_date DESC, document_number DESC LIMIT 12",
			).all(),
			c.env.DB.prepare("SELECT snapshot_date FROM snapshots ORDER BY snapshot_date DESC LIMIT 1").first(),
		]);
		const docs: LandingDoc[] = z
			.array(storedDocRowSchema)
			.parse(docsResult.results)
			.map((d) => ({
				title: d.title,
				docType: d.doc_type,
				publicationDate: d.publication_date,
				url: d.url,
				agencies: z.array(z.string()).catch([]).parse(JSON.parse(d.agencies)),
			}));
		const latestSnapshot = z.object({ snapshot_date: z.string() }).nullable().parse(snapshotRow);
		return c.html(landingPage(docs, latestSnapshot?.snapshot_date ?? null, c.env.FREE_MONTHLY_QUOTA));
	})

	.get("/healthz", (c) => c.json({ ok: true }))

	// Agent-facing index: what this service is and how to consume it.
	.get("/llms.txt", (c) => {
		c.header("content-type", "text/markdown; charset=utf-8");
		return c.body(`# tariff-watch

> Daily facts-only changelog of US tariff, customs, and trade-action changes,
> derived from the Federal Register (public domain): USTR, CBP, International
> Trade Administration, International Trade Commission, Bureau of Industry and
> Security, Foreign-Trade Zones Board, and presidential tariff documents.

## Free Markdown snapshots (no key required)

- [Latest snapshot](/snapshot/latest.md): the last 7 days of trade actions, token-efficient Markdown, regenerated daily.
- /snapshot/YYYY-MM-DD.md: immutable dated snapshots for point-in-time grounding.

## JSON API (free key)

- POST /v1/keys with {"email": "..."} returns an API key (shown once).
- GET /v1/changes?since=YYYY-MM-DD&limit=50 with "Authorization: Bearer <key>" returns structured documents: number, title, type, abstract, publication date, agencies, primary-source URL.

Every fact links to its primary federalregister.gov document.
`);
	})

	.get("/snapshot/latest.md", async (c) => {
		const row = await c.env.DB.prepare(
			"SELECT snapshot_date, markdown FROM snapshots ORDER BY snapshot_date DESC LIMIT 1",
		).first();
		if (row === null) {
			return c.json(errorBody("no_snapshot", "No snapshot generated yet. Check back after the next daily run."), 404);
		}
		const snapshot = z.object({ snapshot_date: z.string(), markdown: z.string() }).parse(row);
		c.header("content-type", "text/markdown; charset=utf-8");
		c.header("x-snapshot-date", snapshot.snapshot_date);
		return c.body(snapshot.markdown);
	})

	.get("/snapshot/:date", zValidator("param", snapshotParamSchema), async (c) => {
		const date = c.req.valid("param").date.replace(/\.md$/, "");
		const row = await c.env.DB.prepare("SELECT markdown FROM snapshots WHERE snapshot_date = ?").bind(date).first();
		if (row === null) {
			return c.json(errorBody("no_snapshot", `No snapshot exists for ${date}.`), 404);
		}
		c.header("content-type", "text/markdown; charset=utf-8");
		c.header("x-snapshot-date", date);
		return c.body(z.object({ markdown: z.string() }).parse(row).markdown);
	})

	// Self-serve free key (quota via FREE_MONTHLY_QUOTA). Returned exactly once.
	.post("/v1/keys", zValidator("json", freeKeyBodySchema), async (c) => {
		const { email } = c.req.valid("json");
		const created = await createApiKey(c.env.DB, {
			plan: "free",
			monthlyQuota: c.env.FREE_MONTHLY_QUOTA,
			email,
		});
		c.executionCtx.waitUntil(track(c.env.DB, "free_key_created"));
		return c.json({ key: created.rawKey, plan: "free", monthly_quota: c.env.FREE_MONTHLY_QUOTA }, 201);
	})

	// Structured changes feed. Validator runs BEFORE metered() so malformed
	// (4xx) requests are never billed.
	.get("/v1/changes", zValidator("query", changesQuerySchema), metered<AppEnv>("changes"), async (c) => {
		const { since, limit } = c.req.valid("query");
		const sinceDate = since ?? isoDate(new Date(Date.now() - 7 * 86_400_000));
		const { results } = await c.env.DB.prepare(
			"SELECT document_number, title, doc_type, abstract, publication_date, url, agencies FROM tariff_documents WHERE publication_date >= ? ORDER BY publication_date DESC, document_number DESC LIMIT ?",
		)
			.bind(sinceDate, limit)
			.all();
		const docs = z.array(storedDocRowSchema).parse(results);
		return c.json({
			since: sinceDate,
			count: docs.length,
			results: docs.map((d) => ({
				document_number: d.document_number,
				title: d.title,
				type: d.doc_type,
				abstract: d.abstract,
				publication_date: d.publication_date,
				url: d.url,
				agencies: z.array(z.string()).catch([]).parse(JSON.parse(d.agencies)),
			})),
			usage: { remaining: c.get("usage").remaining },
		});
	})

	// Operational trigger for ingest (cron does this daily). Requires ADMIN_TOKEN.
	.post("/admin/ingest", async (c) => {
		const adminEnv = adminEnvSchema.parse(c.env);
		const provided = c.req.header("x-admin-token");
		if (adminEnv.ADMIN_TOKEN === undefined) {
			return c.json(errorBody("not_configured", "ADMIN_TOKEN is not configured."), 503);
		}
		if (provided === undefined || !(await timingSafeEqualStrings(provided, adminEnv.ADMIN_TOKEN))) {
			return c.json(errorBody("forbidden", "Invalid admin token."), 403);
		}
		const result = await runIngest(c.env, new Date());
		c.executionCtx.waitUntil(track(c.env.DB, "ingest_run", { trigger: "admin", ...result }));
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

export type AppType = typeof app;

export default {
	fetch: app.fetch,
	// Daily ingest: pull new Federal Register trade documents, regenerate the snapshot.
	async scheduled(controller, env, ctx): Promise<void> {
		const result = await runIngest(env, new Date(controller.scheduledTime));
		ctx.waitUntil(track(env.DB, "ingest_run", { trigger: "cron", cron: controller.cron, ...result }));
	},
} satisfies ExportedHandler<Env>;
