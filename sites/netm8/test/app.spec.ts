import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("netm8.com", () => {
	it("serves the homepage with hero, benefits, feed links, and CTAs", async () => {
		const home = await SELF.fetch("https://example.com/");
		expect(home.status).toBe(200);
		const html = await home.text();
		expect(html).toContain("Current specialist context for your stack");
		expect(html).toContain("Why netm8");
		expect(html).toContain("Source-linked records");
		expect(html).toContain("tariff.watch");
		expect(html).toContain("recalls.netm8.com");
		expect(html).toContain("Start free");
		expect(html).toContain("Get your API key");
		expect(html).toContain('class="hero"');
		expect(html).toContain('data-brand="netm8-parent"');
		expect(html).toContain("Tier 1 - primitives");
		expect(html).toContain("Tier 2 - semantic tokens");
		expect(html).toContain("Tier 3 - brand overlay: netm8-parent");
		expect(html).toContain("color-scheme: light;");
		expect(html).toContain("--surface: var(--brand-surface);");
		expect(html).toContain("--datum-fresh: var(--brand-datum-fresh);");
		expect(html).not.toContain("--bg:");
		expect(html).not.toContain("var(--bg)");
		expect(html).not.toContain("Changelogs of government rules");

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
		const text = await llms.text();
		expect(text).toContain("Current context APIs for specialist domains");
		expect(text).toContain("feed-item-v1.schema.json");
	});
});
