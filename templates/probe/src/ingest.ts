import { type FeedItemV1, feedItemV1Schema, insertFeedItem } from "./feed-item";

/**
 * Reference ingest path: archive the raw source response in R2 keyed by its
 * SHA-256, then persist the change event with its provenance block pointing
 * at the archive. The hash is computed here so callers cannot desynchronize
 * the record from the bytes it claims to describe.
 */

async function sha256HexOf(bytes: ArrayBuffer): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", bytes);
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Store raw bytes once (content-addressed: identical responses share one object). */
export async function storeRawSnapshot(bucket: R2Bucket, bytes: ArrayBuffer, contentType: string): Promise<string> {
	const hash = await sha256HexOf(bytes);
	const existing = await bucket.head(hash);
	if (existing === null) {
		await bucket.put(hash, bytes, { httpMetadata: { contentType } });
	}
	return hash;
}

export interface RecordChangeEventInput {
	/** The raw source response this event was derived from. */
	rawBody: ArrayBuffer;
	contentType: string;
	/** The event, minus the provenance/raw fields this function owns. */
	item: Omit<FeedItemV1, "provenance" | "raw"> & {
		provenance: Omit<FeedItemV1["provenance"], "snapshot_hash">;
	};
}

/**
 * Archive + persist in one step. Returns the stored item (with hash and
 * archive ref filled) and whether the row was new (id is the idempotence key).
 */
export async function recordChangeEvent(
	env: { DB: D1Database; RAW: R2Bucket },
	input: RecordChangeEventInput,
): Promise<{ item: FeedItemV1; inserted: boolean }> {
	const hash = await storeRawSnapshot(env.RAW, input.rawBody, input.contentType);
	const item = feedItemV1Schema.parse({
		...input.item,
		provenance: { ...input.item.provenance, snapshot_hash: hash },
		raw: { content_type: input.contentType, raw_snapshot_ref: `r2://${hash}` },
	});
	const inserted = await insertFeedItem(env.DB, item);
	return { item, inserted };
}
