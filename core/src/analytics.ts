import { z } from "zod";

/**
 * Minimal self-hosted product analytics: one D1 table, no third parties.
 * Call inside `c.executionCtx.waitUntil(...)` so tracking never blocks responses.
 */
export async function track(db: D1Database, name: string, props: Record<string, unknown> = {}): Promise<void> {
	await db
		.prepare("INSERT INTO analytics_events (id, name, props) VALUES (?, ?, ?)")
		.bind(crypto.randomUUID(), name, JSON.stringify(props))
		.run();
}

const countRowSchema = z.object({ name: z.string(), total: z.number() });
const countRowsSchema = z.array(countRowSchema);
export type EventCount = z.infer<typeof countRowSchema>;

/** Event counts over the trailing N days — enough to judge a probe against its kill criteria. */
export async function eventCounts(db: D1Database, days = 30): Promise<EventCount[]> {
	const { results } = await db
		.prepare(
			"SELECT name, COUNT(*) AS total FROM analytics_events WHERE created_at >= datetime('now', ?) GROUP BY name ORDER BY total DESC",
		)
		.bind(`-${days} days`)
		.all();
	return countRowsSchema.parse(results);
}
