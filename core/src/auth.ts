import type { MiddlewareHandler } from "hono";
import { createMiddleware } from "hono/factory";
import { z } from "zod";
import { errorBody } from "./errors";
import { type ApiKeyRecord, findApiKey } from "./keys";
import { checkQuota, lifetimeUsage, recordUsage } from "./meter";
import { reportMeterEvent } from "./stripe";

export interface MeteredVariables {
	apiKey: ApiKeyRecord;
	usage: { used: number; remaining: number };
}

/** Minimum environment shape the metered middleware needs; probe Envs must satisfy it. */
export type CoreEnv = {
	Bindings: { DB: D1Database };
	Variables: MeteredVariables;
};

const meterEnvSchema = z.object({
	STRIPE_SECRET_KEY: z.string().min(1).optional(),
	STRIPE_METER_EVENT_NAME: z.string().min(1).optional(),
	/** Lifetime free calls per key: the first N calls are never reported to
	 * the billing meter (Stripe period tiers reset monthly and cannot express
	 * a one-time allowance). */
	FREE_CALL_ALLOWANCE: z.number().int().min(0).optional(),
});

function extractBearer(authorization: string | undefined): string | null {
	if (authorization === undefined) {
		return null;
	}
	const match = authorization.match(/^Bearer\s+(.+)$/i);
	return match?.[1] ?? null;
}

/**
 * Authenticate + meter a billable route in one middleware:
 * 401 unknown/revoked key, 429 over monthly quota; otherwise records a usage
 * event, mirrors it to Stripe Billing Meters for pro keys (fire-and-forget via
 * waitUntil), and exposes `apiKey` + `usage` as typed context variables.
 *
 * Billing semantics: usage is recorded BEFORE the downstream handler runs, so
 * a handler failure (5xx) still consumes quota — deliberate, since compute was
 * spent. Place request validators (zValidator) BEFORE metered() in the chain
 * so malformed 4xx requests are never billed.
 */
export function metered<E extends CoreEnv>(route: string, qty = 1): MiddlewareHandler<E> {
	return createMiddleware<E>(async (c, next) => {
		const rawKey = extractBearer(c.req.header("authorization"));
		if (rawKey === null) {
			return c.json(errorBody("missing_api_key", "Provide an API key: Authorization: Bearer <key>"), 401);
		}
		const record = await findApiKey(c.env.DB, rawKey);
		if (record === null || record.status !== "active") {
			return c.json(errorBody("invalid_api_key", "Unknown or revoked API key."), 401);
		}
		const quota = await checkQuota(c.env.DB, record.id, record.monthly_quota, qty);
		if (!quota.allowed) {
			return c.json(errorBody("quota_exceeded", `Monthly quota of ${record.monthly_quota} requests exhausted.`), 429);
		}
		await recordUsage(c.env.DB, record.id, route, qty);

		const meterEnv = meterEnvSchema.parse(c.env);
		if (
			record.plan === "pro" &&
			record.stripe_customer_id !== null &&
			meterEnv.STRIPE_SECRET_KEY !== undefined &&
			meterEnv.STRIPE_METER_EVENT_NAME !== undefined &&
			// Lifetime allowance: usage was just recorded, so the count includes
			// this call — call #N stays free while N <= allowance.
			(await lifetimeUsage(c.env.DB, record.id)) > (meterEnv.FREE_CALL_ALLOWANCE ?? 0)
		) {
			c.executionCtx.waitUntil(
				reportMeterEvent({
					secretKey: meterEnv.STRIPE_SECRET_KEY,
					eventName: meterEnv.STRIPE_METER_EVENT_NAME,
					stripeCustomerId: record.stripe_customer_id,
					value: qty,
				}).catch((err: unknown) => {
					console.error(JSON.stringify({ event: "meter_report_failed", message: String(err) }));
				}),
			);
		}

		c.set("apiKey", record);
		c.set("usage", { used: quota.used + qty, remaining: Math.max(0, quota.remaining - qty) });
		await next();
	});
}
