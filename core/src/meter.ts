import { z } from "zod";

/** Record one billable usage event against an API key. */
export async function recordUsage(db: D1Database, keyId: string, route: string, qty = 1): Promise<void> {
	await db
		.prepare("INSERT INTO usage_events (id, key_id, route, qty) VALUES (?, ?, ?, ?)")
		.bind(crypto.randomUUID(), keyId, route, qty)
		.run();
}

const totalSchema = z.object({ total: z.number() });

/** Total usage for a key in the current calendar month (UTC, matching SQLite `datetime('now')`). */
export async function monthlyUsage(db: D1Database, keyId: string): Promise<number> {
	const row = await db
		.prepare(
			"SELECT COALESCE(SUM(qty), 0) AS total FROM usage_events WHERE key_id = ? AND created_at >= datetime('now', 'start of month')",
		)
		.bind(keyId)
		.first();
	return totalSchema.parse(row).total;
}

/**
 * Total usage for a key across its whole life. Supports lifetime free
 * allowances ("your first N calls are free") that Stripe's per-period
 * tiers cannot express — the app simply doesn't report the first N calls
 * to the billing meter.
 */
export async function lifetimeUsage(db: D1Database, keyId: string): Promise<number> {
	const row = await db
		.prepare("SELECT COALESCE(SUM(qty), 0) AS total FROM usage_events WHERE key_id = ?")
		.bind(keyId)
		.first();
	return totalSchema.parse(row).total;
}

export interface QuotaCheck {
	allowed: boolean;
	used: number;
	remaining: number;
}

/**
 * Check whether `qty` more units fit in a key's monthly quota.
 * `remaining` is pre-consumption (caller records usage after).
 */
export async function checkQuota(db: D1Database, keyId: string, monthlyQuota: number, qty = 1): Promise<QuotaCheck> {
	const used = await monthlyUsage(db, keyId);
	const remaining = Math.max(0, monthlyQuota - used);
	return { allowed: used + qty <= monthlyQuota, used, remaining };
}
