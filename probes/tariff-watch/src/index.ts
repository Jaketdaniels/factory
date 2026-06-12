import {
	type ApiKeyRecord,
	billingModeSchema,
	type CheckoutPlan,
	type CheckoutSessionCompleted,
	cancelSubscription,
	checkoutPlanFromMetadata,
	checkoutPlanSchema,
	checkoutSessionCompletedSchema,
	checkQuota,
	createApiKey,
	createCheckoutSession,
	createCreditGrant,
	errorBody,
	findApiKey,
	getStripeSecrets,
	getWebhookSecret,
	type MeteredVariables,
	metered,
	onApiError,
	provisioningForCheckoutPlan,
	recordUsage,
	reportMeterEvent,
	revokeKeysForSubscription,
	stripeEventSchema,
	subscriptionDeletedSchema,
	track,
	verifyStripeSignature,
} from "@factory/core";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import serverCard from "../server.json";
import { sendKeyCreatedEmail } from "./email";
import { renderCalendar, renderRssFeed } from "./feeds";
import { isoDate, runIngest } from "./ingest";
import { deletePage, documentPage, facetPage, type LandingDoc, landingPage, successPage, termsPage } from "./landing";
import { handleMcpJsonRpc } from "./mcp";
import {
	agencySlug,
	getTradeAction,
	listDocumentNumbers,
	listFacets,
	listTradeActions,
	listTradeActionsByProgram,
	parseAgencies,
	storedTradeActionRowSchema,
	TRADE_ACTION_COLUMNS,
} from "./trade-action";
import {
	createWatchlist,
	deleteWatchlist,
	listWatchlists,
	MAX_WATCHLISTS_PER_KEY,
	watchlistKindSchema,
} from "./watchlists";

type AppEnv = {
	Bindings: Env;
	Variables: MeteredVariables;
};

const checkoutBodySchema = z.object({
	email: z.string().email(),
	plan: checkoutPlanSchema.default("payg"),
});
const watchlistBodySchema = z.object({
	kind: watchlistKindSchema,
	value: z.string().min(1).max(200),
	webhook_url: z.string().url().startsWith("https://").optional(),
});
const sessionIdSchema = z.object({ session_id: z.string().min(1) });
const deleteBodySchema = z.object({ email: z.string().email() });
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const changesQuerySchema = z.object({
	since: z.string().regex(DATE_PATTERN, "Use YYYY-MM-DD").optional(),
	limit: z.coerce.number().int().min(1).max(100).default(50),
});
const snapshotParamSchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}\.md$/, "Use YYYY-MM-DD.md") });

const adminEnvSchema = z.object({ ADMIN_TOKEN: z.string().min(16).optional() });
const adminIngestBodySchema = z.object({ since: z.string().regex(DATE_PATTERN, "Use YYYY-MM-DD").optional() });
const billingModeEnvSchema = z.object({ BILLING_MODE: billingModeSchema.default("paid") });

function parseUrlEncodedBody(rawBody: ArrayBuffer): Record<string, string> {
	return Object.fromEntries(new URLSearchParams(new TextDecoder().decode(rawBody)).entries());
}

interface MeterDenied {
	status: 401 | 429;
	rpcCode: number;
	message: string;
}

const meterEnvSchema = z.object({
	STRIPE_SECRET_KEY: z.string().min(1).optional(),
	STRIPE_METER_EVENT_NAME: z.string().min(1).optional(),
});

function successUrl(env: Env, sessionId: string): string {
	const url = new URL("/billing/success", env.APP_BASE_URL);
	url.searchParams.set("session_id", sessionId);
	return url.toString();
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
				submitNote: `Fixed rate - monthly: $29/month covering ${env.FIXED_MONTHLY_INCLUDED_CALLS} API calls and watchlist alerts. Overage is US$0.10 per API call. Cancel anytime.`,
			};
		case "fixed_annual":
			return {
				...base,
				priceId: env.STRIPE_FIXED_ANNUAL_PRICE_ID,
				extraLineItems: [{ priceId: env.STRIPE_FIXED_ANNUAL_METERED_PRICE_ID, metered: true }],
				metadata: { plan },
				submitNote: `Fixed rate - annual: $290/year covering ${env.FIXED_ANNUAL_INCLUDED_CALLS} API calls and watchlist alerts. Overage is US$0.10 per API call.`,
			};
		case "payg":
			return {
				...base,
				priceId: env.STRIPE_PRICE_ID,
				meteredPrice: true,
				metadata: { plan },
				submitNote: `Pay as you go: your first ${env.FREE_CALL_ALLOWANCE} API calls are free as signup credit. US$0.10 per API call after that, billed monthly for actual usage. Cancel anytime.`,
			};
	}
}

/**
 * Bearer auth + metering for routes the metered() middleware can't wrap
 * (the MCP endpoint decides per JSON-RPC method, not per route). Mirrors
 * core's metered(): 401 unknown key, 429 over quota, records usage, and
 * fire-and-forget mirrors to Stripe Billing Meters. Returns null when allowed.
 */
async function meterBearerRequest(
	c: { req: { header: (name: string) => string | undefined }; env: Env; executionCtx: ExecutionContext },
	route: string,
): Promise<MeterDenied | null> {
	const rawKey = c.req.header("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
	if (rawKey === undefined) {
		return {
			status: 401,
			rpcCode: -32001,
			message: "Provide an API key: Authorization: Bearer <key>. Get one at https://tariff.watch/#plans",
		};
	}
	const record = await findApiKey(c.env.DB, rawKey);
	if (record === null || record.status !== "active") {
		return { status: 401, rpcCode: -32001, message: "Unknown or revoked API key." };
	}
	const quota = await checkQuota(c.env.DB, record.id, record.monthly_quota);
	if (!quota.allowed) {
		return {
			status: 429,
			rpcCode: -32002,
			message: `Monthly quota of ${record.monthly_quota} requests exhausted.`,
		};
	}
	await recordUsage(c.env.DB, record.id, route);
	const meterEnv = meterEnvSchema.parse(c.env);
	// Mirror of core metered(): every billed call reports — allowances live
	// in Stripe (signup credit grant / fixed-rate graduated tier), not here.
	if (
		(record.plan === "pro" || record.plan === "standing") &&
		record.stripe_customer_id !== null &&
		meterEnv.STRIPE_SECRET_KEY !== undefined &&
		meterEnv.STRIPE_METER_EVENT_NAME !== undefined
	) {
		c.executionCtx.waitUntil(
			reportMeterEvent({
				secretKey: meterEnv.STRIPE_SECRET_KEY,
				eventName: meterEnv.STRIPE_METER_EVENT_NAME,
				stripeCustomerId: record.stripe_customer_id,
				value: 1,
			}).catch((err: unknown) => {
				console.error(JSON.stringify({ event: "meter_report_failed", message: String(err) }));
			}),
		);
	}
	return null;
}

/** Auth without metering: watchlist management is keyed but never billed. */
async function authenticateBearer(c: {
	req: { header: (name: string) => string | undefined };
	env: Env;
}): Promise<{ record: ApiKeyRecord } | MeterDenied> {
	const rawKey = c.req.header("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
	if (rawKey === undefined) {
		return {
			status: 401,
			rpcCode: -32001,
			message: "Provide an API key: Authorization: Bearer <key>. Get one at https://tariff.watch/#plans",
		};
	}
	const record = await findApiKey(c.env.DB, rawKey);
	if (record === null || record.status !== "active") {
		return { status: 401, rpcCode: -32001, message: "Unknown or revoked API key." };
	}
	return { record };
}

/**
 * Free-surface abuse brake on the GA Workers rate-limit binding
 * (https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).
 * Keyed by client IP: anonymous surfaces have no stabler handle, and the
 * generous per-colo threshold (120/min) makes IP keying an abuse brake
 * rather than the accounting system the docs warn against. Binding-optional
 * so local/test runtimes without the simulator pass through.
 */
async function allowFreeSurface(c: {
	req: { header: (name: string) => string | undefined };
	env: Env;
}): Promise<boolean> {
	const limiter = (c.env as { FREE_RL?: RateLimit }).FREE_RL;
	if (limiter === undefined) {
		return true;
	}
	const key = c.req.header("cf-connecting-ip") ?? "anonymous";
	try {
		const { success } = await limiter.limit({ key });
		return success;
	} catch {
		return true;
	}
}

function rateLimited(c: { header: (name: string, value: string) => void }): void {
	c.header("retry-after", "30");
}

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

const provisionedRowSchema = z.object({
	email: z.string().nullable(),
	stripe_customer_id: z.string().nullable(),
	stripe_subscription_id: z.string().nullable(),
	claimed_at: z.string().nullable(),
	revoked_at: z.string().nullable(),
	plan: z.enum(["payg", "standing"]).catch("payg"),
	billing_interval: z.enum(["usage", "monthly", "annual"]).catch("usage"),
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
		if (!(await allowFreeSurface(c))) {
			rateLimited(c);
			return c.json(errorBody("rate_limited", "Too many requests from this address. Try again shortly."), 429);
		}
		const ref = c.req.query("ref");
		c.executionCtx.waitUntil(track(c.env.DB, "pageview", ref === undefined ? { path: "/" } : { path: "/", ref }));
		const today = isoDate(new Date());
		const [docsResult, snapshotRow, lastIngestRow, upcomingResult] = await Promise.all([
			c.env.DB.prepare(
				`SELECT ${TRADE_ACTION_COLUMNS} FROM tariff_documents ORDER BY publication_date DESC, document_number DESC LIMIT 10`,
			).all(),
			c.env.DB.prepare("SELECT snapshot_date FROM snapshots ORDER BY snapshot_date DESC LIMIT 1").first(),
			c.env.DB.prepare(
				"SELECT created_at FROM analytics_events WHERE name = 'ingest_run' ORDER BY created_at DESC LIMIT 1",
			).first(),
			c.env.DB.prepare(
				`SELECT date, kind, title, url FROM (
					SELECT effective_on AS date, 'effective' AS kind, title, url FROM tariff_documents WHERE effective_on >= ?1
					UNION ALL SELECT comments_close_on, 'comment_due', title, url FROM tariff_documents WHERE comments_close_on >= ?1
					UNION ALL SELECT hearing_on, 'hearing', title, url FROM tariff_documents WHERE hearing_on >= ?1
				) ORDER BY date ASC LIMIT 5`,
			)
				.bind(today)
				.all(),
		]);
		const docs: LandingDoc[] = z
			.array(storedTradeActionRowSchema)
			.parse(docsResult.results)
			.map((d) => ({
				title: d.title,
				docType: d.doc_type,
				publicationDate: d.publication_date,
				url: d.url,
				agencies: parseAgencies(d.agencies),
				program: d.program,
				legalStatus: d.legal_status,
				effectiveOn: d.effective_on,
				commentsCloseOn: d.comments_close_on,
				hearingOn: d.hearing_on,
			}));
		const latestSnapshot = z.object({ snapshot_date: z.string() }).nullable().parse(snapshotRow);
		const lastChecked = z.object({ created_at: z.string() }).nullable().parse(lastIngestRow);
		const upcoming = z
			.array(z.object({ date: z.string(), kind: z.string(), title: z.string(), url: z.string() }))
			.parse(upcomingResult.results);
		return c.html(
			landingPage({
				docs,
				latestSnapshotDate: latestSnapshot?.snapshot_date ?? null,
				freeQuota: c.env.FREE_CALL_ALLOWANCE,
				baseUrl: c.env.APP_BASE_URL,
				upcoming,
				lastCheckedAt: lastChecked?.created_at ?? null,
				fixedMonthlyCalls: c.env.FIXED_MONTHLY_INCLUDED_CALLS,
				fixedAnnualCalls: c.env.FIXED_ANNUAL_INCLUDED_CALLS,
			}),
		);
	})

	.get("/healthz", (c) => c.json({ ok: true }))

	// Agent-facing index: what this service is and how to consume it.
	.get("/llms.txt", async (c) => {
		if (!(await allowFreeSurface(c))) {
			rateLimited(c);
			return c.json(errorBody("rate_limited", "Too many requests from this address. Try again shortly."), 429);
		}
		c.header("content-type", "text/markdown; charset=utf-8");
		return c.body(`# tariff-watch

> Daily facts-only changelog of US tariff, customs, and trade-action changes,
> derived from the Federal Register (public domain): USTR, CBP, International
> Trade Administration, International Trade Commission, Bureau of Industry and
> Security, Foreign-Trade Zones Board, and presidential tariff documents.

## Free surfaces (no key)

- [Latest snapshot](/snapshot/latest.md): the last 7 days of trade actions, token-efficient Markdown, regenerated daily.
- [RSS feed](/feed.xml): the most recent source-linked changes.
- [Calendar feed](/calendar.ics): effective dates, comment deadlines, and hearings.
- Browse pages: /program/<slug>, /agency/<slug>, and per-document records at /d/<document-number>; full index at /sitemap.xml.

## Keyed surfaces (Authorization: Bearer <key>)

Get a key: choose a plan at /#plans. Launch access is free while Stripe billing
is verified. After launch, pay as you go means the first 30 API calls are free
via signup credit, then every call is US$0.10, billed monthly for actual usage;
cancel anytime. The key is shown once and never emailed.

- GET /v1/changes?since=YYYY-MM-DD&limit=50 returns structured documents: number, title, type, abstract, publication date, agencies, program, legal status, effective dates, confidence, and primary-source URL.
- GET /snapshot/YYYY-MM-DD.md: the immutable dated archive for point-in-time grounding ("what was known on this date").
- POST /mcp: tools/call meters per call; initialize and tools/list are open. Tools: tariffs_list_changes, tariffs_effective_dates, tariffs_get_source.
- Watchlists (keyed, never billed): GET/POST /v1/watchlists and DELETE /v1/watchlists/<id>. Body: {"kind":"program"|"agency","value":"...","webhook_url":"https://..."} — alerts arrive by email and HMAC-signed webhook when matching documents are recorded.
- Fixed rate - monthly includes ${c.env.FIXED_MONTHLY_INCLUDED_CALLS} calls/month. Fixed rate - annual includes ${c.env.FIXED_ANNUAL_INCLUDED_CALLS} calls/year. Use {"plan":"fixed_monthly"} or {"plan":"fixed_annual"}.
- Delete your key and its data anytime: POST /account/delete with {"email": "..."} or visit /account/delete.

Every fact links to its primary federalregister.gov document.
Terms (attribution, redistribution, licensing): /terms
`);
	})

	// Data changes at most daily (14:00 UTC cron); feed readers and calendar
	// clients poll on their own schedules, so let the edge absorb them.
	.get("/feed.xml", async (c) => {
		if (!(await allowFreeSurface(c))) {
			rateLimited(c);
			return c.json(errorBody("rate_limited", "Too many requests from this address. Try again shortly."), 429);
		}
		const actions = await listTradeActions(c.env.DB, { since: "1970-01-01", limit: 20 });
		c.header("content-type", "application/rss+xml; charset=utf-8");
		c.header("cache-control", "public, max-age=3600");
		return c.body(renderRssFeed(actions, c.env.APP_BASE_URL));
	})

	.get("/calendar.ics", async (c) => {
		if (!(await allowFreeSurface(c))) {
			rateLimited(c);
			return c.json(errorBody("rate_limited", "Too many requests from this address. Try again shortly."), 429);
		}
		const actions = await listTradeActions(c.env.DB, { since: "1970-01-01", limit: 100 });
		c.header("content-type", "text/calendar; charset=utf-8");
		c.header("cache-control", "public, max-age=3600");
		return c.body(renderCalendar(actions, new Date()));
	})

	.post("/mcp", async (c) => {
		c.header("mcp-session-id", "tariff-watch-stateless");
		let payload: unknown;
		try {
			payload = await c.req.json();
		} catch {
			return c.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Body must be JSON." } });
		}
		// Discovery (initialize/tools/list/ping) is open — the Context7
		// distribution pattern. Tool calls authenticate with the API key and
		// meter exactly like /v1 requests (the market gates MCP as a premium).
		const shape = z.object({ id: z.union([z.string(), z.number()]).nullish(), method: z.string() }).safeParse(payload);
		if (shape.success && shape.data.method === "tools/call") {
			const denied = await meterBearerRequest(c, "mcp");
			if (denied !== null) {
				return c.json(
					{ jsonrpc: "2.0", id: shape.data.id ?? null, error: { code: denied.rpcCode, message: denied.message } },
					denied.status,
				);
			}
		}
		const body = await handleMcpJsonRpc(c.env.DB, payload);
		if (body === null) {
			return c.body(null, 202);
		}
		return c.json(body);
	})

	// MCP is POST-only here (no SSE stream); a GET is someone clicking a link.
	.get("/mcp", (c) =>
		c.json(errorBody("method_not_allowed", "MCP speaks JSON-RPC over POST. See /llms.txt for the tool list."), 405),
	)

	.get("/snapshot/latest.md", async (c) => {
		if (!(await allowFreeSurface(c))) {
			rateLimited(c);
			return c.json(errorBody("rate_limited", "Too many requests from this address. Try again shortly."), 429);
		}
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

	// The dated archive is the point-in-time evidence product; it meters like
	// the API. The latest snapshot above stays free as the grounding surface.
	.get("/snapshot/:date", zValidator("param", snapshotParamSchema), metered<AppEnv>("snapshot"), async (c) => {
		const date = c.req.valid("param").date.replace(/\.md$/, "");
		const row = await c.env.DB.prepare("SELECT markdown FROM snapshots WHERE snapshot_date = ?").bind(date).first();
		if (row === null) {
			return c.json(errorBody("no_snapshot", `No snapshot exists for ${date}.`), 404);
		}
		c.header("content-type", "text/markdown; charset=utf-8");
		c.header("x-snapshot-date", date);
		return c.body(z.object({ markdown: z.string() }).parse(row).markdown);
	})

	// MCP server card for registries/clients; same doc the official registry
	// publish uses (server.json). Format per
	// https://github.com/modelcontextprotocol/registry docs (schema 2025-12-11).
	.get("/.well-known/mcp.json", (c) => {
		c.header("cache-control", "public, max-age=3600");
		return c.json(serverCard);
	})

	// Programmatic SEO: facts-only, dated, primary-linked pages generated
	// straight from D1 — the ingest cron is the content team.
	.get("/program/:slug", zValidator("param", z.object({ slug: z.string().regex(/^[a-z0-9_]+$/) })), async (c) => {
		if (!(await allowFreeSurface(c))) {
			rateLimited(c);
			return c.json(errorBody("rate_limited", "Too many requests from this address. Try again shortly."), 429);
		}
		const { slug } = c.req.valid("param");
		const actions = await listTradeActionsByProgram(c.env.DB, slug);
		if (actions.length === 0) {
			return c.json(errorBody("not_found", "No documents recorded for that program."), 404);
		}
		c.header("cache-control", "public, max-age=3600");
		return c.html(
			facetPage(
				`${slug.replaceAll("_", " ")} — US trade actions`,
				`Every ${slug.replaceAll("_", " ")} document tariff.watch has recorded from the Federal Register, newest first, with legal status and effective dates.`,
				actions,
			),
		);
	})

	.get("/agency/:slug", zValidator("param", z.object({ slug: z.string().regex(/^[a-z0-9-]+$/) })), async (c) => {
		if (!(await allowFreeSurface(c))) {
			rateLimited(c);
			return c.json(errorBody("rate_limited", "Too many requests from this address. Try again shortly."), 429);
		}
		const { slug } = c.req.valid("param");
		const facets = await listFacets(c.env.DB);
		const name = facets.agencies.find((candidate) => agencySlug(candidate) === slug);
		if (name === undefined) {
			return c.json(errorBody("not_found", "No documents recorded for that agency."), 404);
		}
		const recent = await listTradeActions(c.env.DB, { since: "1970-01-01", limit: 200 });
		const actions = recent.filter((a) => a.agencies.includes(name));
		c.header("cache-control", "public, max-age=3600");
		return c.html(
			facetPage(
				`${name} — trade actions`,
				`Documents published by ${name}, newest first, with legal status and effective dates from the Federal Register.`,
				actions,
			),
		);
	})

	.get("/d/:number", zValidator("param", z.object({ number: z.string().regex(/^\d{4}-\d{3,7}$/) })), async (c) => {
		if (!(await allowFreeSurface(c))) {
			rateLimited(c);
			return c.json(errorBody("rate_limited", "Too many requests from this address. Try again shortly."), 429);
		}
		const action = await getTradeAction(c.env.DB, c.req.valid("param").number);
		if (action === null) {
			return c.json(errorBody("not_found", "No such document recorded."), 404);
		}
		c.header("cache-control", "public, max-age=3600");
		return c.html(documentPage(action));
	})

	.get("/sitemap.xml", async (c) => {
		const [facets, numbers] = await Promise.all([listFacets(c.env.DB), listDocumentNumbers(c.env.DB)]);
		const base = c.env.APP_BASE_URL;
		const urls = [
			`${base}/`,
			`${base}/terms`,
			...facets.programs.map((program) => `${base}/program/${program}`),
			...facets.agencies.map((name) => `${base}/agency/${agencySlug(name)}`),
			...numbers.map((n) => `${base}/d/${n}`),
		];
		c.header("content-type", "application/xml; charset=utf-8");
		c.header("cache-control", "public, max-age=3600");
		return c.body(
			`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
				.map((u) => `<url><loc>${u}</loc></url>`)
				.join("\n")}\n</urlset>`,
		);
	})

	.get("/terms", (c) => c.html(termsPage()))

	// The deletion page lives off the main flow; the footer links here.
	.get("/account/delete", (c) => c.html(deletePage()))

	// Self-serve deletion: enter the signup email and the key(s), usage
	// records, and address are removed; any Stripe subscription is cancelled.
	// The response is identical whether or not the address had keys, so the
	// endpoint can't be used to probe which emails are customers.
	.post("/account/delete", zValidator("json", deleteBodySchema), async (c) => {
		const { email } = c.req.valid("json");
		const { results } = await c.env.DB.prepare("SELECT id, stripe_subscription_id FROM api_keys WHERE email = ?")
			.bind(email)
			.all();
		const keys = z.array(z.object({ id: z.string(), stripe_subscription_id: z.string().nullable() })).parse(results);
		const stripeEnv = z.object({ STRIPE_SECRET_KEY: z.string().min(1).optional() }).parse(c.env);
		for (const key of keys) {
			if (key.stripe_subscription_id !== null && stripeEnv.STRIPE_SECRET_KEY !== undefined) {
				await cancelSubscription(stripeEnv.STRIPE_SECRET_KEY, key.stripe_subscription_id);
			}
			await c.env.DB.prepare("DELETE FROM usage_events WHERE key_id = ?").bind(key.id).run();
		}
		await c.env.DB.prepare(
			"DELETE FROM provisioned_keys WHERE email = ? OR key_id IN (SELECT id FROM api_keys WHERE email = ?)",
		)
			.bind(email, email)
			.run();
		await c.env.DB.prepare("DELETE FROM api_keys WHERE email = ?").bind(email).run();
		c.executionCtx.waitUntil(track(c.env.DB, "account_deleted"));
		return c.json({
			deleted: true,
			message: "If a key existed for that address, the key, its usage records, and the address are now deleted.",
		});
	})

	// Structured changes feed. Validator runs BEFORE metered() so malformed
	// (4xx) requests are never billed.
	.get("/v1/changes", zValidator("query", changesQuerySchema), metered<AppEnv>("changes"), async (c) => {
		const { since, limit } = c.req.valid("query");
		const sinceDate = since ?? isoDate(new Date(Date.now() - 7 * 86_400_000));
		const docs = await listTradeActions(c.env.DB, { since: sinceDate, limit });
		return c.json({
			since: sinceDate,
			count: docs.length,
			results: docs,
			usage: { remaining: c.get("usage").remaining },
		});
	})

	// Watchlist management: keyed, never billed. The webhook signing secret is
	// returned exactly once, on creation.
	.get("/v1/watchlists", async (c) => {
		const auth = await authenticateBearer(c);
		if (!("record" in auth)) {
			return c.json(errorBody("missing_api_key", auth.message), auth.status);
		}
		const rows = await listWatchlists(c.env.DB, auth.record.id);
		return c.json({
			watchlists: rows.map((w) => ({
				id: w.id,
				kind: w.kind,
				value: w.value,
				webhook_url: w.webhook_url,
				created_at: w.created_at,
			})),
		});
	})

	.post("/v1/watchlists", zValidator("json", watchlistBodySchema), async (c) => {
		const auth = await authenticateBearer(c);
		if (!("record" in auth)) {
			return c.json(errorBody("missing_api_key", auth.message), auth.status);
		}
		const existing = await listWatchlists(c.env.DB, auth.record.id);
		if (existing.length >= MAX_WATCHLISTS_PER_KEY) {
			return c.json(errorBody("watchlist_limit", `Maximum ${MAX_WATCHLISTS_PER_KEY} watchlists per key.`), 409);
		}
		const body = c.req.valid("json");
		if (existing.some((w) => w.kind === body.kind && w.value === body.value)) {
			return c.json(errorBody("duplicate_watchlist", "That watchlist already exists on this key."), 409);
		}
		const created = await createWatchlist(c.env.DB, {
			keyId: auth.record.id,
			kind: body.kind,
			value: body.kind === "program" ? body.value.toLowerCase() : body.value,
			webhookUrl: body.webhook_url,
		});
		c.executionCtx.waitUntil(track(c.env.DB, "watchlist_created", { kind: body.kind }));
		return c.json(
			{
				id: created.id,
				kind: created.kind,
				value: created.value,
				webhook_url: created.webhook_url,
				// Shown once: verify deliveries like a Stripe signature
				// (HMAC-SHA256 over `${t}.${body}` in tariff-watch-signature).
				webhook_secret: created.webhook_secret,
			},
			201,
		);
	})

	.delete("/v1/watchlists/:id", async (c) => {
		const auth = await authenticateBearer(c);
		if (!("record" in auth)) {
			return c.json(errorBody("missing_api_key", auth.message), auth.status);
		}
		const removed = await deleteWatchlist(c.env.DB, auth.record.id, c.req.param("id"));
		if (!removed) {
			return c.json(errorBody("not_found", "No such watchlist on this key."), 404);
		}
		return c.json({ deleted: true });
	})

	// Operational trigger for ingest (cron does this daily). Requires ADMIN_TOKEN.
	// Optional JSON body {"since":"YYYY-MM-DD"} widens the fetch window — the
	// backfill path that re-pulls and reclassifies historical rows after
	// classifier changes.
	.post("/admin/ingest", async (c) => {
		const adminEnv = adminEnvSchema.parse(c.env);
		const provided = c.req.header("x-admin-token");
		if (adminEnv.ADMIN_TOKEN === undefined) {
			return c.json(errorBody("not_configured", "ADMIN_TOKEN is not configured."), 503);
		}
		if (provided === undefined || !(await timingSafeEqualStrings(provided, adminEnv.ADMIN_TOKEN))) {
			return c.json(errorBody("forbidden", "Invalid admin token."), 403);
		}
		const rawBody = await c.req.text();
		let body: z.infer<typeof adminIngestBodySchema>;
		try {
			body = adminIngestBodySchema.parse(rawBody === "" ? {} : JSON.parse(rawBody));
		} catch {
			return c.json(errorBody("invalid_body", 'Body must be empty or {"since":"YYYY-MM-DD"}.'), 400);
		}
		const result = await runIngest(c.env, new Date(), { sinceDate: body.since });
		c.executionCtx.waitUntil(track(c.env.DB, "ingest_run", { trigger: "admin", ...result }));
		return c.json(result);
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
			// The "first 30 calls free" offer: a US$3 promotional credit grant
			// against metered usage. Idempotent per session; a failure (e.g.
			// key missing the credit-grants scope) is logged and never blocks
			// the key reveal — the grant can be re-issued operationally.
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
						name: `First ${c.env.FREE_CALL_ALLOWANCE} API calls free — tariff.watch signup credit`,
						idempotencyKey: `signup-credit-${session_id}`,
					});
				} catch (err) {
					console.error(JSON.stringify({ event: "signup_credit_failed", session: session_id, message: String(err) }));
				}
			}
			c.executionCtx.waitUntil(track(c.env.DB, "key_claimed"));
			// Receipt + standing deletion offer; the raw key is never emailed.
			if (provisioned.email !== null) {
				c.executionCtx.waitUntil(sendKeyCreatedEmail(c.env, provisioned.email));
			}
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
