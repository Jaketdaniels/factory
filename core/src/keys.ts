import { z } from "zod";

const encoder = new TextEncoder();

/** Hex-encoded SHA-256 of an arbitrary string (used to store API keys without retaining the raw value). */
export async function sha256Hex(input: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", encoder.encode(input));
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function base64Url(bytes: Uint8Array): string {
	let binary = "";
	for (const b of bytes) {
		binary += String.fromCharCode(b);
	}
	return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

/** Generate a new random API key, e.g. `fk_3J0c…` (~192 bits of entropy via Web Crypto). */
export function generateApiKey(prefix = "fk"): string {
	const bytes = new Uint8Array(24);
	crypto.getRandomValues(bytes);
	return `${prefix}_${base64Url(bytes)}`;
}

export const planSchema = z.enum(["free", "pro"]);
export type Plan = z.infer<typeof planSchema>;

export const apiKeyRecordSchema = z.object({
	id: z.string(),
	key_hash: z.string(),
	key_hint: z.string(),
	plan: planSchema,
	monthly_quota: z.number().int().nonnegative(),
	status: z.enum(["active", "revoked"]),
	email: z.string().nullable(),
	stripe_customer_id: z.string().nullable(),
	stripe_subscription_id: z.string().nullable(),
	created_at: z.string(),
});
export type ApiKeyRecord = z.infer<typeof apiKeyRecordSchema>;

/** Look up an API key record by its raw value. Returns null when unknown. */
export async function findApiKey(db: D1Database, rawKey: string): Promise<ApiKeyRecord | null> {
	const hash = await sha256Hex(rawKey);
	const row = await db
		.prepare(
			"SELECT id, key_hash, key_hint, plan, monthly_quota, status, email, stripe_customer_id, stripe_subscription_id, created_at FROM api_keys WHERE key_hash = ?",
		)
		.bind(hash)
		.first();
	if (row === null) {
		return null;
	}
	return apiKeyRecordSchema.parse(row);
}

export interface CreateApiKeyInput {
	plan: Plan;
	monthlyQuota: number;
	email?: string | undefined;
	stripeCustomerId?: string | undefined;
	stripeSubscriptionId?: string | undefined;
}

export interface CreatedApiKey {
	id: string;
	/** Shown to the customer exactly once; only the SHA-256 hash is retained in api_keys. */
	rawKey: string;
}

/** Create an API key: stores hash + hint, returns the raw key for one-time delivery. */
export async function createApiKey(db: D1Database, input: CreateApiKeyInput): Promise<CreatedApiKey> {
	const rawKey = generateApiKey();
	const id = crypto.randomUUID();
	await db
		.prepare(
			"INSERT INTO api_keys (id, key_hash, key_hint, plan, monthly_quota, email, stripe_customer_id, stripe_subscription_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		)
		.bind(
			id,
			await sha256Hex(rawKey),
			rawKey.slice(0, 8),
			input.plan,
			input.monthlyQuota,
			input.email ?? null,
			input.stripeCustomerId ?? null,
			input.stripeSubscriptionId ?? null,
		)
		.run();
	return { id, rawKey };
}

/** Revoke every key attached to a Stripe subscription (e.g. on `customer.subscription.deleted`). */
export async function revokeKeysForSubscription(db: D1Database, subscriptionId: string): Promise<number> {
	const result = await db
		.prepare("UPDATE api_keys SET status = 'revoked' WHERE stripe_subscription_id = ?")
		.bind(subscriptionId)
		.run();
	return result.meta.changes;
}
