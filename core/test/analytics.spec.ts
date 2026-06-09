import { beforeEach, describe, expect, it } from "vitest";
import { eventCounts, track } from "../src/analytics";
import { resetDb } from "./helpers";

describe("analytics", () => {
	beforeEach(async () => {
		await resetDb();
	});

	it("tracks events and aggregates counts over the window", async () => {
		const db = await resetDb();
		await track(db, "pageview", { path: "/" });
		await track(db, "pageview", { path: "/pricing" });
		await track(db, "checkout_started");
		const counts = await eventCounts(db, 30);
		expect(counts).toEqual([
			{ name: "pageview", total: 2 },
			{ name: "checkout_started", total: 1 },
		]);
	});

	it("returns an empty list when nothing is tracked", async () => {
		const db = await resetDb();
		await expect(eventCounts(db)).resolves.toEqual([]);
	});
});
