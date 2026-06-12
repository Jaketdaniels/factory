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
	metadata: z.record(z.string(), z.string()).nullish(),
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
	idempotencyKey?: string,
): Promise<T> {
	const response = await fetch(`${STRIPE_BASE_URL}${path}`, {
		method: "POST",
		headers: {
			authorization: `Bearer ${secretKey}`,
			"content-type": "application/x-www-form-urlencoded",
			"stripe-version": STRIPE_API_VERSION,
			// Callers pass a deterministic key when retries must not duplicate
			// the side effect (e.g. one signup credit per checkout session).
			"idempotency-key": idempotencyKey ?? crypto.randomUUID(),
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

export interface CheckoutLineItem {
	priceId: string;
	/** Licensed (flat) prices need quantity 1; metered prices must omit it. */
	metered: boolean;
}

export interface CreateCheckoutSessionInput {
	secretKey: string;
	priceId: string;
	successUrl: string;
	cancelUrl: string;
	customerEmail?: string | undefined;
	/** Usage-based (metered) prices reject `quantity` on line items. */
	meteredPrice?: boolean | undefined;
	/** Additional line items (e.g. a fixed-rate flat fee alongside the meter). */
	extraLineItems?: CheckoutLineItem[] | undefined;
	/** Copied onto the session and surfaced in checkout.session.completed —
	 * used to carry the chosen plan into webhook provisioning. */
	metadata?: Record<string, string> | undefined;
	/** Shown on the Checkout page above the pay button — use it to spell out
	 * free allowances so a $0-due-today metered subscription is unambiguous. */
	submitNote?: string | undefined;
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
		success_url: input.successUrl,
		cancel_url: input.cancelUrl,
	};
	if (input.meteredPrice !== true) {
		form["line_items[0][quantity]"] = "1";
	}
	for (const [i, item] of (input.extraLineItems ?? []).entries()) {
		form[`line_items[${i + 1}][price]`] = item.priceId;
		if (!item.metered) {
			form[`line_items[${i + 1}][quantity]`] = "1";
		}
	}
	for (const [key, value] of Object.entries(input.metadata ?? {})) {
		form[`metadata[${key}]`] = value;
	}
	if (input.customerEmail !== undefined) {
		form.customer_email = input.customerEmail;
	}
	if (input.submitNote !== undefined) {
		form["custom_text[submit][message]"] = input.submitNote;
	}
	return stripePost(input.secretKey, "/v1/checkout/sessions", form, checkoutSessionSchema);
}

/**
 * Cancel a subscription immediately. Returns false instead of throwing when
 * Stripe refuses (for example a restricted key without subscription write):
 * callers use this in account-deletion flows that must succeed regardless,
 * and a lingering metered subscription with no key accrues $0.
 */
export async function cancelSubscription(secretKey: string, subscriptionId: string): Promise<boolean> {
	const response = await fetch(`${STRIPE_BASE_URL}/v1/subscriptions/${subscriptionId}`, {
		method: "DELETE",
		headers: {
			authorization: `Bearer ${secretKey}`,
			"stripe-version": STRIPE_API_VERSION,
		},
	});
	if (!response.ok) {
		console.error(JSON.stringify({ event: "stripe_cancel_failed", subscriptionId, status: response.status }));
	}
	return response.ok;
}

const creditGrantSchema = z.object({ id: z.string() });

export interface CreateCreditGrantInput {
	secretKey: string;
	customerId: string;
	/** Positive integer in the currency's minor unit (300 = US$3.00). */
	amountCents: number;
	currency: string;
	/** Shown on the customer's invoices/credit history (max 100 chars). */
	name: string;
	/** Deterministic key so webhook/claim retries never double-grant. */
	idempotencyKey: string;
}

/**
 * Grant promotional billing credit that Stripe applies automatically to
 * metered usage charges (and only those — scope is price_type=metered).
 * Used to back "first N calls free" offers without suppressing meter events:
 * the meter stays a complete record of usage and the credit absorbs the cost.
 * Requires the Credit Grants write scope on the restricted key.
 */
export async function createCreditGrant(input: CreateCreditGrantInput): Promise<{ id: string }> {
	return stripePost(
		input.secretKey,
		"/v1/billing/credit_grants",
		{
			customer: input.customerId,
			name: input.name,
			category: "promotional",
			"amount[type]": "monetary",
			"amount[monetary][currency]": input.currency,
			"amount[monetary][value]": String(input.amountCents),
			"applicability_config[scope][price_type]": "metered",
		},
		creditGrantSchema,
		input.idempotencyKey,
	);
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
