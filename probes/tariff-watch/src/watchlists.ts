import { z } from "zod";
import type { PublicTradeAction } from "./trade-action";

/**
 * Watchlists: per-key subscriptions to a program or agency, alerted on newly
 * written documents by email and an optional HMAC-signed webhook. The
 * alert_events table is the idempotence ledger — one alert per
 * watchlist x document x channel, ever.
 */

export const watchlistKindSchema = z.enum(["program", "agency"]);

export const watchlistRowSchema = z.object({
	id: z.string(),
	key_id: z.string(),
	kind: watchlistKindSchema,
	value: z.string(),
	webhook_url: z.string().nullable(),
	webhook_secret: z.string().nullable(),
	created_at: z.string(),
});
export type WatchlistRow = z.infer<typeof watchlistRowSchema>;

export const MAX_WATCHLISTS_PER_KEY = 20;

export async function listWatchlists(db: D1Database, keyId: string): Promise<WatchlistRow[]> {
	const { results } = await db
		.prepare(
			"SELECT id, key_id, kind, value, webhook_url, webhook_secret, created_at FROM watchlists WHERE key_id = ? ORDER BY created_at",
		)
		.bind(keyId)
		.all();
	return z.array(watchlistRowSchema).parse(results);
}

export async function createWatchlist(
	db: D1Database,
	input: { keyId: string; kind: "program" | "agency"; value: string; webhookUrl?: string | undefined },
): Promise<WatchlistRow> {
	const id = crypto.randomUUID();
	// One signing secret per watchlist so receivers can verify deliveries the
	// same way we verify Stripe's (HMAC t/v1 over `${t}.${body}`).
	const secret = input.webhookUrl === undefined ? null : `whsec_tw_${crypto.randomUUID().replaceAll("-", "")}`;
	await db
		.prepare("INSERT INTO watchlists (id, key_id, kind, value, webhook_url, webhook_secret) VALUES (?, ?, ?, ?, ?, ?)")
		.bind(id, input.keyId, input.kind, input.value, input.webhookUrl ?? null, secret)
		.run();
	const row = await db
		.prepare("SELECT id, key_id, kind, value, webhook_url, webhook_secret, created_at FROM watchlists WHERE id = ?")
		.bind(id)
		.first();
	return watchlistRowSchema.parse(row);
}

export async function deleteWatchlist(db: D1Database, keyId: string, id: string): Promise<boolean> {
	const result = await db
		.prepare("DELETE FROM alert_events WHERE watchlist_id IN (SELECT id FROM watchlists WHERE id = ? AND key_id = ?)")
		.bind(id, keyId)
		.run();
	void result;
	const deleted = await db.prepare("DELETE FROM watchlists WHERE id = ? AND key_id = ?").bind(id, keyId).run();
	return deleted.meta.changes > 0;
}

/** Sign a webhook payload exactly like Stripe signs theirs (verifiable with
 * any stripe-signature verifier, including our own core implementation). */
export async function signWebhookPayload(secret: string, body: string, nowMs: number): Promise<string> {
	const t = Math.floor(nowMs / 1000);
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
		"sign",
	]);
	const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(`${t}.${body}`));
	const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
	return `t=${t},v1=${hex}`;
}

interface AlertSink {
	sendEmail: (to: string, subject: string, text: string) => Promise<void>;
}

const matchRowSchema = z.object({
	watchlist_id: z.string(),
	kind: watchlistKindSchema,
	value: z.string(),
	webhook_url: z.string().nullable(),
	webhook_secret: z.string().nullable(),
	email: z.string().nullable(),
});

/**
 * Alert every watchlist matching the documents written by this ingest run.
 * Idempotent via alert_events (UNIQUE watchlist x document x channel):
 * re-runs and overlapping look-back windows never alert twice.
 */
export async function evaluateWatchlists(
	db: D1Database,
	actions: PublicTradeAction[],
	sink: AlertSink,
	nowMs: number,
): Promise<{ emails: number; webhooks: number }> {
	let emails = 0;
	let webhooks = 0;
	for (const action of actions) {
		const { results } = await db
			.prepare(
				`SELECT w.id AS watchlist_id, w.kind, w.value, w.webhook_url, w.webhook_secret, k.email
				 FROM watchlists w JOIN api_keys k ON k.id = w.key_id
				 WHERE k.status = 'active' AND (
					(w.kind = 'program' AND w.value = ?1)
					OR (w.kind = 'agency' AND EXISTS (SELECT 1 FROM json_each(?2) WHERE json_each.value = w.value))
				 )`,
			)
			.bind(action.program, JSON.stringify(action.agencies))
			.all();
		for (const match of z.array(matchRowSchema).parse(results)) {
			if (match.email !== null) {
				const claimed = await db
					.prepare(
						"INSERT INTO alert_events (id, watchlist_id, document_number, channel) VALUES (?, ?, ?, 'email') ON CONFLICT DO NOTHING",
					)
					.bind(crypto.randomUUID(), match.watchlist_id, action.document_number)
					.run();
				if (claimed.meta.changes > 0) {
					try {
						await sink.sendEmail(
							match.email,
							`tariff.watch alert: ${action.title.slice(0, 80)}`,
							`Your watchlist (${match.kind}: ${match.value}) matched a new document.

${action.title}
Published ${action.publication_date} · status ${action.legal_status}${action.effective_on === null ? "" : ` · takes effect ${action.effective_on}`}
Primary source: ${action.url}
Record: https://tariff.watch/d/${action.document_number}

Manage watchlists with your API key; delete everything at https://tariff.watch/account/delete`,
						);
						emails += 1;
					} catch (err) {
						console.error(JSON.stringify({ event: "alert_email_failed", message: String(err) }));
					}
				}
			}
			if (match.webhook_url !== null && match.webhook_secret !== null) {
				const claimed = await db
					.prepare(
						"INSERT INTO alert_events (id, watchlist_id, document_number, channel) VALUES (?, ?, ?, 'webhook') ON CONFLICT DO NOTHING",
					)
					.bind(crypto.randomUUID(), match.watchlist_id, action.document_number)
					.run();
				if (claimed.meta.changes > 0) {
					const body = JSON.stringify({
						event: "tariff_watch.document.recorded",
						watch: { kind: match.kind, value: match.value },
						document: action,
					});
					try {
						const signature = await signWebhookPayload(match.webhook_secret, body, nowMs);
						const res = await fetch(match.webhook_url, {
							method: "POST",
							headers: { "content-type": "application/json", "tariff-watch-signature": signature },
							body,
						});
						if (!res.ok) {
							console.error(JSON.stringify({ event: "alert_webhook_failed", status: res.status }));
						} else {
							webhooks += 1;
						}
					} catch (err) {
						console.error(JSON.stringify({ event: "alert_webhook_failed", message: String(err) }));
					}
				}
			}
		}
	}
	return { emails, webhooks };
}
