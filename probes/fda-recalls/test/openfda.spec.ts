import { env } from "cloudflare:test";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { toChangeEvent } from "../src/openfda";
import { runRecallIngest } from "../src/recall-ingest";
import { sampleRecord } from "./fixtures";

const NOW = new Date("2026-06-11T15:00:00Z");

describe("openFDA mapping", () => {
	it("maps an enforcement record to the contract with severity and lifecycle", () => {
		const event = toChangeEvent(sampleRecord("F-0100-2026"), "food", NOW, "https://recalls.netm8.com");
		expect(event.id).toBe("food-F-0100-2026-effective");
		expect(event.classification.category).toBe("fda_recall_food");
		expect(event.change_tracking?.change_severity).toBe("critical");
		expect(event.dates.published_at).toBe("2026-06-03T00:00:00Z");
		expect(event.dates.effective_at).toBe("2026-05-05T00:00:00Z");
		expect(event.source.license_note).toContain("17 U.S.C.");

		const done = toChangeEvent(
			sampleRecord("F-0100-2026", { status: "Terminated", classification: "Class III" }),
			"food",
			NOW,
			"https://recalls.netm8.com",
		);
		expect(done.id).toBe("food-F-0100-2026-archived");
		expect(done.status.state).toBe("archived");
		expect(done.change_tracking?.change_severity).toBe("minor");
	});
});

describe("recall ingest", () => {
	const server = setupServer();

	beforeAll(() => {
		server.listen({ onUnhandledRequest: "error" });
	});
	afterEach(() => {
		server.resetHandlers();
	});
	afterAll(() => {
		server.close();
	});
	beforeEach(async () => {
		await env.DB.prepare("DELETE FROM feed_items").run();
		await env.DB.prepare("DELETE FROM analytics_events").run();
	});

	it("archives raw responses and records events idempotently across runs", async () => {
		const body = JSON.stringify({ results: [sampleRecord("F-0200-2026")] });
		server.use(
			http.get("https://api.fda.gov/food/enforcement.json", () => HttpResponse.text(body)),
			http.get("https://api.fda.gov/drug/enforcement.json", () => new HttpResponse(null, { status: 404 })),
			http.get("https://api.fda.gov/device/enforcement.json", () => new HttpResponse(null, { status: 404 })),
		);

		const first = await runRecallIngest(env, NOW);
		expect(first).toEqual({ fetched: 1, recorded: 1 });

		const row = await env.DB.prepare(
			"SELECT snapshot_hash FROM feed_items WHERE id = 'food-F-0200-2026-effective'",
		).first<{ snapshot_hash: string }>();
		expect(row?.snapshot_hash).toMatch(/^[0-9a-f]{64}$/);
		expect(await (await env.RAW.get(row?.snapshot_hash as string))?.text()).toBe(body);

		// Second run: same window, zero new events.
		const second = await runRecallIngest(env, NOW);
		expect(second).toEqual({ fetched: 1, recorded: 0 });

		// Status change: a new event with its own identity, not a mutation.
		const terminated = JSON.stringify({ results: [sampleRecord("F-0200-2026", { status: "Terminated" })] });
		server.use(http.get("https://api.fda.gov/food/enforcement.json", () => HttpResponse.text(terminated)));
		const third = await runRecallIngest(env, NOW);
		expect(third).toEqual({ fetched: 1, recorded: 1 });
		const ids = await env.DB.prepare("SELECT id FROM feed_items ORDER BY id").all();
		expect(ids.results.map((r) => (r as { id: string }).id)).toEqual([
			"food-F-0200-2026-archived",
			"food-F-0200-2026-effective",
		]);
	});
});
