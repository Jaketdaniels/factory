import { createExecutionContext, createScheduledController, env, SELF, waitOnExecutionContext } from "cloudflare:test";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import worker from "../src/index";
import { runIngest } from "../src/ingest";

const FR_URL = "https://www.federalregister.gov/api/v1/documents.json";

async function clearTables(): Promise<void> {
	for (const table of ["tariff_documents", "snapshots", "analytics_events"]) {
		await env.DB.prepare(`DELETE FROM ${table}`).run();
	}
}

interface FixtureDoc {
	comments_close_on?: string | null;
	document_number: string;
	effective_on?: string | null;
	title: string;
	type: string;
	abstract: string | null;
	publication_date: string;
	html_url: string;
	agency_names: string[];
}

function doc(n: string, title: string, date: string): FixtureDoc {
	return {
		document_number: n,
		title,
		type: "Notice",
		abstract: `Abstract for ${n}`,
		publication_date: date,
		html_url: `https://www.federalregister.gov/d/${n}`,
		agency_names: ["International Trade Commission"],
	};
}

const PAGE_TWO_MARKER = "page=2";

/**
 * Default fixture: the agency query returns two pages (one doc each); the
 * presidential query returns one doc plus an overlap that must deduplicate.
 */
function frHandler() {
	return http.get(FR_URL, ({ request }) => {
		const url = new URL(request.url);
		if (url.searchParams.getAll("conditions[type][]").includes("PRESDOCU")) {
			return HttpResponse.json({
				count: 2,
				results: [
					doc("2026-30001", "Proclamation: Adjusting Imports of Steel", "2026-06-09"),
					doc("2026-20001", "Overlap Doc", "2026-06-08"),
				],
			});
		}
		if (url.search.includes(PAGE_TWO_MARKER)) {
			return HttpResponse.json({
				count: 3,
				results: [doc("2026-20002", "Agency Doc Page Two", "2026-06-07")],
			});
		}
		return HttpResponse.json({
			count: 3,
			next_page_url: `${FR_URL}?${PAGE_TWO_MARKER}`,
			results: [doc("2026-20001", "Overlap Doc", "2026-06-08"), doc("2026-20003", "Agency Doc Page One", "2026-06-08")],
		});
	});
}

function forcedLaborSection301Doc(): FixtureDoc {
	return {
		document_number: "2026-11296",
		title: "Section 301 Investigations of Forced Labor Import Prohibitions",
		type: "Notice",
		abstract:
			"Notice of determinations and request for comments concerning actions in Section 301 investigations related to forced labor goods.",
		publication_date: "2026-06-05",
		html_url: "https://www.federalregister.gov/d/2026-11296",
		agency_names: ["Office of the United States Trade Representative"],
		comments_close_on: "2026-07-06",
	};
}

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

describe("runIngest", () => {
	beforeEach(clearTables);

	it("inserts deduplicated documents across queries and pages, and writes the snapshot", async () => {
		server.use(frHandler());
		const result = await runIngest(env, new Date("2026-06-09T14:00:00Z"));

		// 4 unique docs: overlap appears in both queries but is stored once.
		expect(result.inserted).toBe(4);
		expect(result.snapshotDate).toBe("2026-06-09");
		expect(result.snapshotEntryCount).toBe(4);

		const snapshot = await env.DB.prepare("SELECT markdown, entry_count FROM snapshots WHERE snapshot_date = ?")
			.bind("2026-06-09")
			.first<{ markdown: string; entry_count: number }>();
		expect(snapshot?.entry_count).toBe(4);
		expect(snapshot?.markdown).toContain("Proclamation: Adjusting Imports of Steel");
		expect(snapshot?.markdown).toContain("Agency Doc Page Two");
		expect(snapshot?.markdown).toContain("public domain");
	});

	it("is idempotent: a re-run inserts nothing new and refreshes the same-day snapshot", async () => {
		server.use(frHandler());
		await runIngest(env, new Date("2026-06-09T14:00:00Z"));
		server.use(frHandler());
		const second = await runIngest(env, new Date("2026-06-09T20:00:00Z"));

		expect(second.inserted).toBe(0);
		const snapshots = await env.DB.prepare("SELECT snapshot_date FROM snapshots").all();
		expect(snapshots.results).toHaveLength(1);
		const docs = await env.DB.prepare("SELECT document_number FROM tariff_documents").all();
		expect(docs.results).toHaveLength(4);
	});

	it("renders an honest empty snapshot when nothing was published", async () => {
		server.use(http.get(FR_URL, () => HttpResponse.json({ count: 0, results: [] })));
		const result = await runIngest(env, new Date("2026-06-09T14:00:00Z"));
		expect(result.inserted).toBe(0);
		const snapshot = await env.DB.prepare("SELECT markdown FROM snapshots WHERE snapshot_date = '2026-06-09'").first<{
			markdown: string;
		}>();
		expect(snapshot?.markdown).toContain("No trade-relevant documents");
	});

	it("tracks the June 2026 USTR forced-labor Section 301 program as a source evidence event", async () => {
		server.use(
			http.get(FR_URL, ({ request }) => {
				const url = new URL(request.url);
				if (url.searchParams.get("conditions[term]") === "2026-11296") {
					return HttpResponse.json({ count: 1, results: [forcedLaborSection301Doc()] });
				}
				return HttpResponse.json({ count: 0, results: [] });
			}),
		);

		const result = await runIngest(env, new Date("2026-06-10T14:00:00Z"));
		expect(result.inserted).toBe(1);

		const stored = await env.DB.prepare(
			"SELECT program, legal_status, comments_close_on, hearing_on, source_type, source_id, confidence FROM tariff_documents WHERE document_number = ?",
		)
			.bind("2026-11296")
			.first<{
				comments_close_on: string | null;
				confidence: string;
				hearing_on: string | null;
				legal_status: string;
				program: string;
				source_id: string;
				source_type: string;
			}>();
		expect(stored).toEqual({
			program: "section_301_forced_labor",
			legal_status: "proposed",
			comments_close_on: "2026-07-06",
			hearing_on: "2026-07-07",
			source_type: "federal_register",
			source_id: "2026-11296",
			confidence: "high",
		});

		const snapshot = await env.DB.prepare("SELECT markdown FROM snapshots WHERE snapshot_date = '2026-06-10'").first<{
			markdown: string;
		}>();
		expect(snapshot?.markdown).toContain("section_301_forced_labor");
		expect(snapshot?.markdown).toContain("Comment deadline: 2026-07-06");
		expect(snapshot?.markdown).toContain("Hearing: 2026-07-07");
	});

	it("propagates source corrections to stored rows, then settles back to zero writes", async () => {
		const fixture = forcedLaborSection301Doc();
		const handler = () =>
			http.get(FR_URL, ({ request }) => {
				const url = new URL(request.url);
				if (url.searchParams.get("conditions[term]") === "2026-11296") {
					return HttpResponse.json({ count: 1, results: [fixture] });
				}
				return HttpResponse.json({ count: 0, results: [] });
			});

		server.use(handler());
		const first = await runIngest(env, new Date("2026-06-10T14:00:00Z"));
		expect(first.inserted).toBe(1);

		// The source corrects the comment deadline: the stored row must follow.
		fixture.comments_close_on = "2026-07-13";
		server.use(handler());
		const second = await runIngest(env, new Date("2026-06-10T20:00:00Z"));
		expect(second.inserted).toBe(1);
		const stored = await env.DB.prepare(
			"SELECT comments_close_on FROM tariff_documents WHERE document_number = '2026-11296'",
		).first<{ comments_close_on: string | null }>();
		expect(stored?.comments_close_on).toBe("2026-07-13");

		// Unchanged data writes nothing: ingest stays observably idempotent.
		server.use(handler());
		const third = await runIngest(env, new Date("2026-06-10T22:00:00Z"));
		expect(third.inserted).toBe(0);
	});

	it("surfaces upstream failures instead of writing a bad snapshot", async () => {
		server.use(http.get(FR_URL, () => HttpResponse.json({ error: "down" }, { status: 503 })));
		await expect(runIngest(env, new Date("2026-06-09T14:00:00Z"))).rejects.toThrowError();
		const snapshots = await env.DB.prepare("SELECT snapshot_date FROM snapshots").all();
		expect(snapshots.results).toHaveLength(0);
	});
});

describe("scheduled handler", () => {
	beforeEach(clearTables);

	it("runs the full ingest and records the run", async () => {
		server.use(frHandler());
		const ctx = createExecutionContext();
		const controller = createScheduledController({
			cron: "0 14 * * *",
			scheduledTime: new Date("2026-06-09T14:00:00Z"),
		});
		await worker.scheduled(controller, env, ctx);
		await waitOnExecutionContext(ctx);

		const docs = await env.DB.prepare("SELECT document_number FROM tariff_documents").all();
		expect(docs.results).toHaveLength(4);
		const runs = await env.DB.prepare("SELECT props FROM analytics_events WHERE name = 'ingest_run'").all();
		expect(runs.results).toHaveLength(1);

		// The snapshot is now live on the public surface.
		const latest = await SELF.fetch("https://example.com/snapshot/latest.md");
		expect(latest.status).toBe(200);
		expect(latest.headers.get("x-snapshot-date")).toBe("2026-06-09");
	});
});
