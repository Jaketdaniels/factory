import { track } from "@factory/core";
import { recordChangeEvent } from "./ingest";
import { fetchEnforcement, PRODUCT_TYPES, toChangeEvent } from "./openfda";

export interface RecallIngestResult {
	fetched: number;
	recorded: number;
}

const LOOKBACK_DAYS = 14;

/**
 * Cron job: pull the recent enforcement window for each product type, archive
 * each raw response in R2, and record change events idempotently (event
 * identity = recall x lifecycle state, so re-runs and status changes both do
 * the right thing).
 */
export async function runRecallIngest(env: Env, now: Date): Promise<RecallIngestResult> {
	const since = new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000);
	let fetched = 0;
	let recorded = 0;
	for (const productType of PRODUCT_TYPES) {
		const { records, rawBody } = await fetchEnforcement(productType, since, now);
		fetched += records.length;
		for (const record of records) {
			const { inserted } = await recordChangeEvent(env, {
				rawBody,
				contentType: "application/json",
				item: toChangeEvent(record, productType, now, env.APP_BASE_URL),
			});
			if (inserted) {
				recorded += 1;
			}
		}
	}
	await track(env.DB, "ingest_run", { fetched, recorded });
	return { fetched, recorded };
}
