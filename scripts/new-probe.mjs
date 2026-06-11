#!/usr/bin/env node
/**
 * Stamp a new probe from templates/probe into probes/<name>.
 *
 * v2: creates the D1 database and injects its id, refuses to finish without
 * kill criteria (a probe without them is a zombie, not an experiment), and
 * prints the post-scaffold checklist.
 *
 * Usage:
 *   npm run new-probe -- <name> \
 *     --hypothesis "who pays, for what, found how" \
 *     --signal "e.g. >=200 organic visits/week OR >=1 paid key by day 30" \
 *     --kill-date YYYY-MM-DD \
 *     [--skip-d1]
 */
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const NAME_PATTERN = /^[a-z][a-z0-9-]{2,30}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SKIP = new Set(["node_modules", ".wrangler", ".dev.vars"]);

function fail(message) {
	console.error(message);
	process.exit(1);
}

const args = process.argv.slice(2);
const name = args[0];
const flags = {};
for (let i = 1; i < args.length; i++) {
	const arg = args[i];
	if (arg === "--skip-d1") {
		flags.skipD1 = true;
	} else if (arg.startsWith("--")) {
		flags[arg.slice(2)] = args[++i];
	}
}

if (name === undefined || !NAME_PATTERN.test(name)) {
	fail("Usage: npm run new-probe -- <kebab-case-name> --hypothesis ... --signal ... --kill-date YYYY-MM-DD");
}

// The kill-criteria gate: no scaffold without all three, non-placeholder.
const hypothesis = flags.hypothesis?.trim();
const signal = flags.signal?.trim();
const killDate = flags["kill-date"]?.trim();
if (!hypothesis || hypothesis.length < 12) {
	fail('Refusing to scaffold: --hypothesis is required ("who pays, for what, found how" — be specific).');
}
if (!signal || signal.length < 12) {
	fail("Refusing to scaffold: --signal is required (the measurable day-30 success signal).");
}
if (!killDate || !DATE_PATTERN.test(killDate)) {
	fail("Refusing to scaffold: --kill-date YYYY-MM-DD is required (the date the dials are read and acted on).");
}

const root = resolve(import.meta.dirname, "..");
const source = join(root, "templates", "probe");
const target = join(root, "probes", name);

if (existsSync(target)) {
	fail(`probes/${name} already exists.`);
}

cpSync(source, target, {
	recursive: true,
	filter: (src) => !SKIP.has(basename(src)),
});

function* walk(dir) {
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) {
			yield* walk(full);
		} else {
			yield full;
		}
	}
}

let replaced = 0;
for (const file of walk(target)) {
	const content = readFileSync(file, "utf8");
	if (content.includes("probe-template")) {
		writeFileSync(file, content.replaceAll("probe-template", name));
		replaced++;
	}
}

// Fill the KILL CRITERIA block so the probe is born with its exit conditions.
const readmePath = join(target, "README.md");
const readme = readFileSync(readmePath, "utf8")
	.replace("- **Hypothesis:** _who pays, for what, found how?_", `- **Hypothesis:** ${hypothesis}`)
	.replace(
		"- **Success signal by day 30:** _e.g. ≥200 organic landing visits/week OR ≥1 paid key_",
		`- **Success signal by day 30:** ${signal}`,
	)
	.replace(
		"- **Kill date:** _YYYY-MM-DD_ — if the signal is not met, archive the probe and write a 5-line post-mortem below.",
		`- **Kill date:** ${killDate} — if the signal is not met, archive the probe and write a 5-line post-mortem below.`,
	);
if (!readme.includes(hypothesis) || !readme.includes(killDate)) {
	fail("KILL CRITERIA template block not found in README.md — template drift; fix templates/probe/README.md.");
}
writeFileSync(readmePath, readme);

// Create the D1 database and inject its id (the template carries a zero id).
let d1Note = `  - wrangler d1 create ${name}   # then paste database_id into wrangler.jsonc (--skip-d1 was set)`;
if (flags.skipD1 !== true) {
	try {
		const output = execFileSync("npx", ["wrangler", "d1", "create", name], { cwd: target, encoding: "utf8" });
		const match = output.match(/"database_id":\s*"([0-9a-f-]{36})"/);
		if (match === null) {
			fail(`wrangler d1 create succeeded but no database_id found in output:\n${output}`);
		}
		const wranglerPath = join(target, "wrangler.jsonc");
		writeFileSync(
			wranglerPath,
			readFileSync(wranglerPath, "utf8").replace("00000000-0000-0000-0000-000000000000", match[1]),
		);
		d1Note = `  - D1 created and injected: ${name} (${match[1]})`;
	} catch (err) {
		fail(`wrangler d1 create failed (use --skip-d1 to scaffold offline): ${err.message ?? err}`);
	}
}

console.log(`Created probes/${name} (${replaced} files rewritten). Kill date: ${killDate}.
${d1Note}

Post-scaffold checklist:
  1. npm install                                   # link the new workspace
  2. cd probes/${name}
  3. cp .dev.vars.example .dev.vars                # Stripe test secrets (rk_), ADMIN_TOKEN
  4. npm run types                                 # regenerate Env after any wrangler.jsonc edit
  5. npm run migrate:local && npm run dev          # includes feed_items (FeedItemV1 contract)
  6. Map the source into FeedItemV1 (src/feed-item.ts; spec: https://netm8.com/standards/feed-item-v1.schema.json)
  7. npm run verify                                # from the repo root, before first deploy
  8. wrangler secret put STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET / ADMIN_TOKEN, then npm run deploy
`);
