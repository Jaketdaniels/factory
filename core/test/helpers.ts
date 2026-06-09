import { env } from "cloudflare:test";

const STATEMENTS: string[] = [
	"CREATE TABLE IF NOT EXISTS api_keys (id TEXT PRIMARY KEY, key_hash TEXT NOT NULL UNIQUE, key_hint TEXT NOT NULL, plan TEXT NOT NULL DEFAULT 'free', monthly_quota INTEGER NOT NULL DEFAULT 100, status TEXT NOT NULL DEFAULT 'active', email TEXT, stripe_customer_id TEXT, stripe_subscription_id TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')))",
	"CREATE TABLE IF NOT EXISTS usage_events (id TEXT PRIMARY KEY, key_id TEXT NOT NULL, route TEXT NOT NULL, qty INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')))",
	"CREATE TABLE IF NOT EXISTS analytics_events (id TEXT PRIMARY KEY, name TEXT NOT NULL, props TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT (datetime('now')))",
	"DELETE FROM api_keys",
	"DELETE FROM usage_events",
	"DELETE FROM analytics_events",
];

/** Create the core tables fresh for each test file (mirrors templates/probe/migrations). */
export async function resetDb(): Promise<D1Database> {
	for (const sql of STATEMENTS) {
		await env.DB.prepare(sql).run();
	}
	return env.DB;
}

const encoder = new TextEncoder();

/** Produce a valid Stripe-Signature header for tests (same HMAC scheme Stripe uses). */
export async function signStripePayload(rawBody: string, secret: string, timestampSeconds: number): Promise<string> {
	const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
		"sign",
	]);
	const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestampSeconds}.${rawBody}`));
	const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
	return `t=${timestampSeconds},v1=${hex}`;
}
