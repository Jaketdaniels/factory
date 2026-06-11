/**
 * Transactional email via the Cloudflare Email Service binding.
 *
 * The sender domain is netm8.com (onboarded for Email Sending); tariff.watch
 * is a netm8 feed, so operational mail carries the imprint. The raw API key
 * is NEVER emailed — the email is a receipt plus the standing deletion offer.
 */

const FROM = { email: "keys@netm8.com", name: "tariff.watch" };
const REPLY_TO = "hello@netm8.com";

interface EmailSendInput {
	to: string;
	from: { email: string; name?: string };
	replyTo?: string;
	subject: string;
	text: string;
	html?: string;
}

interface EmailSender {
	send(message: EmailSendInput): Promise<unknown>;
}

export interface KeyCreatedEmailInput {
	to: string;
	baseUrl: string;
	freeQuota: number;
}

export function keyCreatedEmail(input: KeyCreatedEmailInput): { subject: string; text: string; html: string } {
	const subject = "Your tariff.watch API key is active";
	const text = `Your tariff.watch API key was created and shown to you once in the browser.
For your security it is never sent by email — if you lost it, delete it below
and create a new one.

What you signed up for
- Pay as you go: your first ${input.freeQuota} API calls are free — a month\n  of daily updates on us.
- US$0.10 per API call after that, billed monthly by Stripe for actual usage.
  $0 was charged today. Stripe emails your invoices. Cancel anytime.

Delete your key and data — anytime
${input.baseUrl}/account/delete
Enter this email address there and your key, usage records, and address are
deleted immediately. Cancelling your subscription from any Stripe invoice
email also deactivates the key.

Terms: ${input.baseUrl}/terms

tariff.watch — a netm8 feed. Facts only, primary sources, immutable snapshots.
Questions: reply to this email.`;
	const html = `<p>Your tariff.watch API key was created and shown to you once in the browser. For your security it is never sent by email — if you lost it, delete it below and create a new one.</p>
<p><strong>What you signed up for</strong><br>
Pay as you go: your first ${input.freeQuota} API calls are free — a month of daily updates on us. After that, US$0.10 per API call, billed monthly by Stripe for actual usage. $0 was charged today. Stripe emails your invoices. Cancel anytime.</p>
<p><strong>Delete your key and data — anytime</strong><br>
<a href="${input.baseUrl}/account/delete">${input.baseUrl}/account/delete</a><br>
Enter this email address there and your key, usage records, and address are deleted immediately. Cancelling your subscription from any Stripe invoice email also deactivates the key.</p>
<p><a href="${input.baseUrl}/terms">Terms</a> · tariff.watch — a netm8 feed. Facts only, primary sources, immutable snapshots.<br>
Questions: reply to this email.</p>`;
	return { subject, text, html };
}

/** Plain-text alert sender for watchlist notifications (binding-optional). */
export function makeEmailSink(env: Env): { sendEmail: (to: string, subject: string, text: string) => Promise<void> } {
	const sender = (env as unknown as { EMAIL?: EmailSender }).EMAIL;
	return {
		async sendEmail(to: string, subject: string, text: string): Promise<void> {
			if (sender === undefined) {
				return;
			}
			await sender.send({ to, from: FROM, replyTo: REPLY_TO, subject, text });
		},
	};
}

/**
 * Fire-and-forget sender for use inside waitUntil: a missing binding (tests,
 * local dev) or a provider error must never break the key flow.
 */
export async function sendKeyCreatedEmail(env: Env, to: string): Promise<boolean> {
	// workers-types still types the binding as the legacy SendEmail (raw
	// EmailMessage); the Email Service runtime accepts the structured form.
	const sender = (env as unknown as { EMAIL?: EmailSender }).EMAIL;
	if (sender === undefined) {
		return false;
	}
	const content = keyCreatedEmail({ to, baseUrl: env.APP_BASE_URL, freeQuota: env.FREE_CALL_ALLOWANCE });
	try {
		await sender.send({ to, from: FROM, replyTo: REPLY_TO, ...content });
		return true;
	} catch (err) {
		console.error(JSON.stringify({ event: "email_send_failed", message: err instanceof Error ? err.message : "" }));
		return false;
	}
}
