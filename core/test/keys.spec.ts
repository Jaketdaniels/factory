import { beforeEach, describe, expect, it } from "vitest";
import { createApiKey, findApiKey, generateApiKey, revokeKeysForSubscription, sha256Hex } from "../src/keys";
import { resetDb } from "./helpers";

describe("generateApiKey", () => {
	it("produces prefixed, url-safe, unique keys", () => {
		const a = generateApiKey();
		const b = generateApiKey();
		expect(a).toMatch(/^fk_[A-Za-z0-9_-]{32}$/);
		expect(a).not.toBe(b);
	});
});

describe("sha256Hex", () => {
	it("matches the known SHA-256 of an empty string", async () => {
		await expect(sha256Hex("")).resolves.toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
	});
});

describe("api key lifecycle", () => {
	beforeEach(async () => {
		await resetDb();
	});

	it("creates a key and finds it by raw value, storing only the hash", async () => {
		const db = await resetDb();
		const created = await createApiKey(db, { plan: "pro", monthlyQuota: 500, email: "a@b.co" });
		const found = await findApiKey(db, created.rawKey);
		expect(found).not.toBeNull();
		expect(found?.id).toBe(created.id);
		expect(found?.plan).toBe("pro");
		expect(found?.monthly_quota).toBe(500);
		expect(found?.key_hash).not.toContain(created.rawKey);
	});

	it("returns null for unknown keys", async () => {
		const db = await resetDb();
		await expect(findApiKey(db, "fk_does-not-exist")).resolves.toBeNull();
	});

	it("revokes keys by stripe subscription id", async () => {
		const db = await resetDb();
		const created = await createApiKey(db, {
			plan: "pro",
			monthlyQuota: 500,
			stripeSubscriptionId: "sub_123",
		});
		const changed = await revokeKeysForSubscription(db, "sub_123");
		expect(changed).toBe(1);
		const found = await findApiKey(db, created.rawKey);
		expect(found?.status).toBe("revoked");
	});
});
