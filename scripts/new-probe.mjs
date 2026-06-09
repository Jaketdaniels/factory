#!/usr/bin/env node
/** Stamp a new probe from templates/probe into probes/<name>. */
import { cpSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const NAME_PATTERN = /^[a-z][a-z0-9-]{2,30}$/;
const SKIP = new Set(["node_modules", ".wrangler", ".dev.vars"]);

const name = process.argv[2];
if (name === undefined || !NAME_PATTERN.test(name)) {
	console.error("Usage: npm run new-probe -- <kebab-case-name>   (3-31 chars, [a-z0-9-])");
	process.exit(1);
}

const root = resolve(import.meta.dirname, "..");
const source = join(root, "templates", "probe");
const target = join(root, "probes", name);

if (existsSync(target)) {
	console.error(`probes/${name} already exists.`);
	process.exit(1);
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

console.log(`Created probes/${name} (${replaced} files rewritten).

Next steps:
  1. npm install                                  # link the new workspace
  2. cd probes/${name}
  3. wrangler d1 create ${name}                   # paste database_id into wrangler.jsonc
  4. cp .dev.vars.example .dev.vars               # fill Stripe test secrets
  5. Fill in the KILL CRITERIA section of README.md before writing any code.
  6. npm run migrate:local && npm run dev
`);
