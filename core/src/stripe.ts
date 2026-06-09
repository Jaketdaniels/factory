import { z } from "zod";
import { ApiError } from "./errors";

/**
 * Minimal fetch-based Stripe client for Workers (Web APIs only, no SDK).
 * Use a restricted API key (rk_…) scoped to Checkout Sessions + Billing,
 * stored via `wrangler secret put` — never in source or wrangler.jsonc vars.
 */
export const STRIPE_API_VERSION = "2026-05-27.dahlia";
const STRIPE_BASE_URL = "https://api.stripe.com";

const encoder = new TextEncoder();

function hexToBytes(hex: string): Uint8Array | null {
	if (hex.length % 2 !== 0 || /[^0-9a-f]/i.test(hex)) {
		return null;
	}
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < bytes.length; i++) {
		bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
	}
	return bytes;
}

export interface VerifySignatureOptions {
	/** Maximum allowed age of the event, in seconds. Stripe's default guidance is 300. */
	toleranceSeconds?: number;
	/** Injection point for tests; defaults to the real clock. */
	nowMs?: number;
}

/**
 * Verify a `Stripe-Signature` header against the raw request body.
 * HMAC-SHA256 over `${timestamp}.${rawBody}`; comparison is timing-safe
 * (crypto.subtle.verify). Returns false on malformed, stale, or mismatched input.
 */
export async function verifyStripeSignature(
	rawBody: string,
	signatureHeader: string | undefined,
	webhookSecret: string,
	options: VerifySignatureOptions = {},
): Promise<boolean> {
	if (signatureHeader === undefined || signatureHeader.length === 0) {
		return false;
	}
	const toleranceSeconds = options.toleranceSeconds ?? 300;
	const nowMs = options.nowMs ?? Date.now();

	let timestamp: number | null = null;
	const candidates: Uint8Array[] = [];
	for (const part of signatureHeader.split(",")) {
		const [key, value] = part.split("=", 2);
		if (key === "t" && value !== undefined) {
			const parsed = Number.parseInt(value, 10);
			timestamp = Number.isFinite(parsed) ? parsed : null;
		} else if (key === "v1" && value !== undefined) {
			const bytes = hexToBytes(value);
			if (bytes !== null) {
				candidates.push(bytes);
			}
		}
	}
	if (timestamp === null || candidates.length === 0) {
		return false;
	}
	if (Math.abs(nowMs / 1000 - timestamp) > toleranceSeconds) {
		return false;
	}

	const cryptoKey = await crypto.subtle.importKey(
		"raw",
		encoder.encode(webhookSecret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["verify"],
	);
	const signedPayload = encoder.encode(`${timestamp}.${rawBody}`);
	for (const candidate of candidates) {
		// crypto.subtle.verify performs a constant-time comparison internally.
		const valid = await crypto.subtle.verify("HMAC", cryptoKey, candidate.slice().buffer, signedPayload);
		if (valid) {
			return true;
		}
	}
	return false;
}

export const stripeEventSchema = z.object({
	id: z.string(),
	type: z.string(),
	data: z.object({ object: z.unknown() }),
});
export type StripeEvent = z.infer<typeof stripeEventSchema>;

export const checkoutSessionCompletedSchema = z.object({
	id: z.string(),
	customer: z.string().nullish(),
	subscription: z.string().nullish(),
	client_reference_id: z.string().nullish(),
	customer_details: z.object({ email: z.string().nullish() }).nullish(),
});
export type CheckoutSessionCompleted = z.infer<typeof checkoutSessionCompletedSchema>;

export const subscriptionDeletedSchema = z.object({
	id: z.string(),
	customer: z.string().nullish(),
});
export type SubscriptionDeleted = z.infer<typeof subscriptionDeletedSchema>;

const stripeErrorSchema = z.object({
	error: z.object({ message: z.string().optional(), type: z.string().optional() }),
});

async function stripePost<T>(
	secretKey: string,
	path: string,
	form: Record<string, string>,
	schema: z.ZodType<T>,
): Promise<T> {
	const response = await fetch(`${STRIPE_BASE_URL}${path}`, {
		method: "POST",
		headers: {
			authorization: `Bearer ${secretKey}`,
			"content-type": "application/x-www-form-urlencoded",
			"stripe-version": STRIPE_API_VERSION,
			"idempotency-key": crypto.randomUUID(),
		},
		body: new URLSearchParams(form).toString(),
	});
	const payload: unknown = await response.json();
	if (!response.ok) {
		const parsed = stripeErrorSchema.safeParse(payload);
		const message = parsed.success ? (parsed.data.error.message ?? "unknown") : "unknown";
		// Log detail server-side; expose only a generic message to anonymous
		// callers (Stripe messages leak price ids / account configuration).
		console.error(JSON.stringify({ event: "stripe_api_error", path, status: response.status, message }));
		throw new ApiError(502, "stripe_error", "Payment provider rejected the request. Please try again later.");
	}
	return schema.parse(payload);
}

const checkoutSessionSchema = z.object({ id: z.string(), url: z.string().nullable() });
export type CheckoutSession = z.infer<typeof checkoutSessionSchema>;

export interface CreateCheckoutSessionInput {
	secretKey: string;
	priceId: string;
	successUrl: string;
	cancelUrl: string;
	customerEmail?: string | undefined;
}

/**
 * Create a subscription-mode Checkout Session.
 * Deliberately omits `payment_method_types` so Stripe selects eligible
 * payment methods dynamically from Dashboard settings.
 */
export async function createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CheckoutSession> {
	const form: Record<string, string> = {
		mode: "subscription",
		"line_items[0][price]": input.priceId,
		"line_items[0][quantity]": "1",
		success_url: input.successUrl,
		cancel_url: input.cancelUrl,
	};
	if (input.customerEmail !== undefined) {
		form.customer_email = input.customerEmail;
	}
	return stripePost(input.secretKey, "/v1/checkout/sessions", form, checkoutSessionSchema);
}

const meterEventSchema = z.object({ identifier: z.string().optional() });

export interface ReportMeterEventInput {
	secretKey: string;
	eventName: string;
	stripeCustomerId: string;
	value: number;
}

/** Report a usage value to Stripe Billing Meters (usage-based subscription pricing). */
export async function reportMeterEvent(input: ReportMeterEventInput): Promise<void> {
	await stripePost(
		input.secretKey,
		"/v1/billing/meter_events",
		{
			event_name: input.eventName,
			"payload[stripe_customer_id]": input.stripeCustomerId,
			"payload[value]": String(input.value),
		},
		meterEventSchema,
	);
}
