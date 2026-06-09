import { beforeEach, describe, expect, it } from "vitest";
import { checkQuota, monthlyUsage, recordUsage } from "../src/meter";
import { resetDb } from "./helpers";

describe("metering", () => {
	beforeEach(async () => {
		await resetDb();
	});

	it("sums usage for the current month only for the given key", async () => {
		const db = await resetDb();
		await recordUsage(db, "key-1", "echo");
		await recordUsage(db, "key-1", "echo", 2);
		await recordUsage(db, "key-2", "echo");
		await expect(monthlyUsage(db, "key-1")).resolves.toBe(3);
		await expect(monthlyUsage(db, "key-2")).resolves.toBe(1);
		await expect(monthlyUsage(db, "key-3")).resolves.toBe(0);
	});

	it("allows under quota and blocks at quota", async () => {
		const db = await resetDb();
		await recordUsage(db, "key-1", "echo", 4);
		const under = await checkQuota(db, "key-1", 5);
		expect(under).toEqual({ allowed: true, used: 4, remaining: 1 });
		await recordUsage(db, "key-1", "echo");
		const at = await checkQuota(db, "key-1", 5);
		expect(at).toEqual({ allowed: false, used: 5, remaining: 0 });
	});

	it("accounts for qty so multi-unit usage cannot blow through the gate", async () => {
		const db = await resetDb();
		await recordUsage(db, "key-1", "echo", 4);
		expect((await checkQuota(db, "key-1", 5, 1)).allowed).toBe(true);
		expect((await checkQuota(db, "key-1", 5, 2)).allowed).toBe(false);
	});
});
