// Captures each .variant section in an exploration page to its own PNG.
// Usage: node sites/netm8/design/capture-heroes.mjs [htmlFile] [outDir]
// playwright is not a workspace dependency; resolve via require so NODE_PATH
// (e.g. an npx cache node_modules) can supply it.

import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { chromium } = createRequire(import.meta.url)("playwright");

const here = path.dirname(fileURLToPath(import.meta.url));
const htmlFile = path.resolve(here, process.argv[2] ?? "hero-explorations.html");
const outDir = process.argv[3] ?? "/tmp/hero-previews";
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const passes = [
	{ width: 1280, height: 900, suffix: "" },
	{ width: 390, height: 844, suffix: "-mobile" },
];

for (const pass of passes) {
	const page = await browser.newPage({
		viewport: { width: pass.width, height: pass.height },
		deviceScaleFactor: 2,
	});
	await page.goto(`file://${htmlFile}`);
	await page.waitForTimeout(300);

	const variants = page.locator(".variant");
	const count = await variants.count();
	for (let i = 0; i < count; i++) {
		const el = variants.nth(i);
		// textContent, not innerText: the tag is display:none in the mobile pass
		const tag = (await el.locator(".tag").textContent()).trim().slice(0, 1).toLowerCase();
		const file = path.join(outDir, `hero-${tag}${pass.suffix}.png`);
		await el.screenshot({ path: file });
		console.log(file);
	}

	if (!pass.suffix) {
		await page.screenshot({ path: path.join(outDir, "all-variants.png"), fullPage: true });
		console.log(path.join(outDir, "all-variants.png"));
	}
	await page.close();
}
await browser.close();
