import { describe, expect, it } from "vitest";
import { brandCss, SEMANTIC_TOKEN_NAMES } from "../src/brand";

describe("brand design tokens", () => {
	it("exposes the three-tier token contract for each brand overlay", () => {
		expect(SEMANTIC_TOKEN_NAMES).toEqual(
			expect.arrayContaining(["--surface", "--accent", "--datum-fresh", "--badge-alert"]),
		);

		const parentCss = brandCss("netm8-parent");
		expect(parentCss).toContain("Tier 1 - primitives");
		expect(parentCss).toContain("Tier 2 - semantic tokens");
		expect(parentCss).toContain("Tier 3 - brand overlay: netm8-parent");
		expect(parentCss).toContain("color-scheme: light;");
		expect(parentCss).toContain("--surface: var(--brand-surface);");
		expect(parentCss).toContain("--brand-surface: var(--color-parent-surface);");

		const feedCss = brandCss("netm8-feed");
		expect(feedCss).toContain("Tier 3 - brand overlay: netm8-feed");
		expect(feedCss).toContain("color-scheme: dark;");
		expect(feedCss).toContain("--brand-surface: var(--color-feed-surface);");
	});
});
