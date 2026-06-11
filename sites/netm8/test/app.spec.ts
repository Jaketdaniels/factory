import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("netm8.com", () => {
	it("serves all four pages with the catalog and method", async () => {
		const home = await SELF.fetch("https://example.com/");
		expect(home.status).toBe(200);
		const html = await home.text();
		expect(html).toContain("Changelogs of government rules.");
		expect(html).toContain("https://tariff.watch");
		expect(html).toContain("FeedItemV1");

		for (const path of ["/standards", "/licensing", "/contact"]) {
			const res = await SELF.fetch(`https://example.com${path}`);
			expect(res.status).toBe(200);
		}
		expect(await (await SELF.fetch("https://example.com/standards")).text()).toContain("six publishing rules");
		expect(await (await SELF.fetch("https://example.com/licensing")).text()).toContain(
			"Verify against the cited source",
		);
	});

	it("serves the FeedItemV1 schema at the stable URL", async () => {
		const res = await SELF.fetch("https://example.com/standards/feed-item-v1.schema.json");
		expect(res.status).toBe(200);
		const schema = (await res.json()) as { title: string; required: string[]; properties: Record<string, unknown> };
		expect(schema.title).toBe("FeedItemV1");
		expect(schema.required).toContain("provenance");
		expect(Object.keys(schema.properties)).toEqual(
			expect.arrayContaining(["source", "classification", "status", "dates", "change_tracking", "delivery"]),
		);
	});

	it("404s unknown paths and serves llms.txt", async () => {
		expect((await SELF.fetch("https://example.com/nope")).status).toBe(404);
		const llms = await SELF.fetch("https://example.com/llms.txt");
		expect(llms.status).toBe(200);
		expect(await llms.text()).toContain("feed-item-v1.schema.json");
	});
});
