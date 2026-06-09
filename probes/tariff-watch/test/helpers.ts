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

/** Build + sign a Stripe webhook request body/headers pair. */
export async function signedWebhookRequest(
	event: Record<string, unknown>,
	secret: string,
): Promise<{ body: string; headers: Record<string, string> }> {
	const body = JSON.stringify(event);
	const header = await signStripePayload(body, secret, Math.floor(Date.now() / 1000));
	return { body, headers: { "stripe-signature": header, "content-type": "application/json" } };
}
