/** Server-rendered pages for netm8.com — the umbrella, same design system as the feeds. */

export function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

const FAVICON =
	"data:image/svg+xml," +
	encodeURIComponent(
		'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#16140f"/><path d="M8 22V10l8 8V10M20 22V10h4" stroke="#d2a44c" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>',
	);

function page(title: string, description: string, body: string): string {
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="${escapeHtml(description)}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:type" content="website">
<link rel="icon" href="${FAVICON}">
<title>${escapeHtml(title)}</title>
<style>
:root {
	color-scheme: dark;
	--bg: #131210; --surface: #1b1916; --border: #2c2822;
	--text: #eae6de; --muted: #a59c8d; --accent: #d2a44c;
	--mono: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace;
}
* { box-sizing: border-box; }
body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; background: var(--bg); color: var(--text); max-width: 44rem; margin: 0 auto; padding: 2.25rem 1.25rem 4rem; line-height: 1.65; }
.site { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin-bottom: 2.75rem; }
.wordmark { font-family: var(--mono); font-weight: 600; font-size: 1.05rem; color: var(--text); text-decoration: none; }
.wordmark span { color: var(--accent); }
.site nav { display: flex; gap: 1.1rem; flex-wrap: wrap; }
.site nav a { color: var(--muted); text-decoration: none; font-size: 0.85rem; }
.site nav a:hover { color: var(--text); }
h1 { font-size: clamp(1.8rem, 5vw, 2.3rem); line-height: 1.12; letter-spacing: -0.02em; margin: 0 0 1.1rem; text-wrap: balance; }
h2 { font-family: var(--mono); font-size: 0.8rem; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); margin: 3.25rem 0 1rem; }
h3 { font-size: 0.95rem; margin: 1.6rem 0 0.45rem; }
.lede { font-size: 1.05rem; max-width: 60ch; }
a { color: var(--accent); text-underline-offset: 3px; }
a:hover { color: #e5c078; }
code, pre { font-family: var(--mono); }
code { background: var(--surface); border: 1px solid var(--border); border-radius: 4px; padding: 0.1rem 0.35rem; font-size: 0.85em; }
pre { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 1rem; overflow-x: auto; line-height: 1.55; font-size: 0.82rem; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 1.25rem 1.4rem; margin: 0 0 1rem; }
.card h3 { margin-top: 0; }
.card p { margin: 0.35rem 0 0; font-size: 0.9rem; color: var(--muted); }
.card .live { color: #8fb284; font-family: var(--mono); font-size: 0.72rem; letter-spacing: 0.08em; text-transform: uppercase; }
.card .soon { color: var(--muted); font-family: var(--mono); font-size: 0.72rem; letter-spacing: 0.08em; text-transform: uppercase; }
ol, ul { padding-left: 1.2rem; }
li { margin: 0.4rem 0; }
.meta { font-size: 0.8rem; color: var(--muted); }
footer { margin-top: 4rem; padding-top: 1.4rem; border-top: 1px solid var(--border); font-size: 0.84rem; color: var(--muted); }
footer p { margin: 0 0 0.5rem; }
.imprint { font-family: var(--mono); font-size: 0.76rem; }
</style>
</head>
<body>
<header class="site">
<a class="wordmark" href="/">net<span>m8</span></a>
<nav><a href="/standards">standards</a><a href="/licensing">licensing</a><a href="/contact">contact</a></nav>
</header>
${body}
<footer>
<p class="imprint">netm8 · changelogs of government rules · primary sources only · <a href="/standards">the contract</a></p>
</footer>
</body>
</html>`;
}

export function homePage(): string {
	return page(
		"netm8 — changelogs of government rules",
		"Machine-readable changefeeds of government rule changes: normalized evidence fields, immutable snapshots, primary-source links. Built for AI agents and the people who run them.",
		`<h1>Changelogs of government rules.</h1>
<p class="lede">Governments publish rule changes as prose scattered across registers and dockets. netm8 feeds read the primary sources on a schedule and publish each change as a structured record: what changed, its legal status, when it takes effect, and a link to the government document — for AI agents, compliance software, and the people who run them.</p>

<h2>Method</h2>
<ul>
<li><strong>Primary sources only.</strong> Every record links the government document it came from; reuse rights are affirmatively established before a source is onboarded.</li>
<li><strong>Facts, not takes.</strong> Statuses are inferred only from signals the source carries — never keyword-guessed. Source corrections propagate and are recorded as corrections.</li>
<li><strong>Immutable history.</strong> Dated snapshots never change once their day has passed, so software can prove what was known on a date.</li>
<li><strong>One contract.</strong> Every feed publishes the same record shape — <a href="/standards">FeedItemV1</a> — across JSON, RSS, calendar, webhook, and MCP.</li>
</ul>

<h2>Feeds</h2>
<div class="card">
<span class="live">live</span>
<h3><a href="https://tariff.watch">tariff.watch</a></h3>
<p>US tariff, customs, and trade-action changes from the Federal Register: programs, legal status, effective dates, comment deadlines. Free daily snapshot, RSS, and calendar; metered API, MCP tools, and dated archive.</p>
</div>
<div class="card">
<span class="soon">in selection</span>
<h3>Feed #2</h3>
<p>Candidates are scored against a published rubric (source quality, license gate, buyer evidence) before any code is written. Current shortlist: export controls, FDA recalls.</p>
</div>

<h2>For agents</h2>
<p>Each feed serves <code>llms.txt</code>, markdown snapshots sized for context windows, and an MCP server listed in the official registry. Discovery is free; tool calls are metered per use — no subscription required to make the first call.</p>`,
	);
}

export function standardsPage(): string {
	return page(
		"Standards — netm8",
		"The netm8 feed contract: FeedItemV1 record schema and the six publishing rules every feed follows.",
		`<h1>Standards</h1>
<p class="lede">Every netm8 feed publishes the same record shape under the same rules. The contract is versioned and public; if a feed violates it, that is a bug.</p>

<h2>FeedItemV1</h2>
<p>One canonical record type — a <strong>change event</strong> — serialized identically across JSON, RSS, calendar, webhook, and MCP. The machine-readable contract lives at a stable URL:</p>
<pre>curl https://netm8.com/standards/feed-item-v1.schema.json</pre>
<p>Blocks: <code>source</code> (identity, jurisdiction, license basis), <code>classification</code>, <code>status</code> (record lifecycle: new / updated / scheduled / effective / superseded / withdrawn / corrected / archived), <code>dates</code> (published, effective, retrieved, detected), <code>summary</code>, <code>change_tracking</code> (version, diff, severity), <code>provenance</code> (snapshot hash, retrieval method, parser version, confidence), <code>delivery</code> (canonical URL, RSS guid, calendar UID, webhook event), <code>metrics</code>, <code>raw</code>.</p>

<h2>The six publishing rules</h2>
<ol>
<li><strong>Primary sources, affirmatively licensed.</strong> A source is onboarded only when reuse rights are established: US federal works (17 U.S.C. §105), open government licenses (attribution carried in <code>source.license_note</code>), or explicit dedication. Public <em>access</em> is not public <em>domain</em>.</li>
<li><strong>Every record cites its document.</strong> No record ships without a working primary-source link. No third-party publisher text is reproduced; summaries are our own.</li>
<li><strong>Statuses are evidence, not guesses.</strong> Lifecycle and domain statuses derive only from fields the source carries (document type, dates, explicit notices). Facts the source API lacks may be pinned by exact document identifier — never matched by text.</li>
<li><strong>History is immutable; corrections are events.</strong> Dated snapshots never change after their day. When a source corrects itself, the record updates and the correction is itself a change event.</li>
<li><strong>Freshness is stamped.</strong> Every surface states when its sources were last checked and how often they are polled.</li>
<li><strong>Verify before compliance use.</strong> Feeds are changelogs of public records, not legal advice; every surface carries the disclaimer and a one-click path to the cited source.</li>
</ol>

<h2>Versioning</h2>
<p>Breaking changes to the record shape become <code>FeedItemV2</code> at a new URL; <code>v1</code> URLs keep serving the v1 shape. Additive optional fields may land in v1.</p>`,
	);
}

export function licensingPage(): string {
	return page(
		"Licensing — netm8",
		"How netm8 feeds may be used: free reading with attribution, metered machine access per feed, licensed commercial redistribution.",
		`<h1>Licensing</h1>
<p class="lede">The underlying facts are public records. What netm8 sells is the derived layer: normalized evidence fields, immutable archives, machine interfaces, and alerting.</p>

<h3>Reading is free</h3>
<p>Each feed's human surfaces — changelog pages, latest snapshot, RSS, calendar — are free for personal use, research, and grounding humans or AI agents, with attribution (the feed's name and a link). Bulk redistribution or republication of these surfaces as a dataset is not permitted.</p>

<h3>Machine access is metered per feed</h3>
<p>Structured APIs, MCP tool calls, and dated snapshot archives are sold by the feed that publishes them, priced per call with no subscription floor. Keys are not transferable; reselling raw access is not permitted. See each feed's terms (e.g. <a href="https://tariff.watch/terms">tariff.watch/terms</a>).</p>

<h3>Commercial redistribution is licensed</h3>
<p>Embedding a feed in a product you sell, redistributing records, or white-labeling requires a commercial license from netm8. Write to <a href="mailto:hello@netm8.com">hello@netm8.com</a> with what you are building — licenses are flat, fast, and per feed.</p>

<h3>The disclaimer that applies everywhere</h3>
<p>Feeds are changelogs of public records, not legal, customs, or financial advice. Verify against the cited source before compliance use.</p>`,
	);
}

export function contactPage(): string {
	return page(
		"Contact — netm8",
		"Contact netm8: corrections, commercial licensing, and new feed requests.",
		`<h1>Contact</h1>
<p class="lede">One inbox, read by the operator: <a href="mailto:hello@netm8.com">hello@netm8.com</a></p>
<h3>Corrections</h3>
<p>If a record looks wrong, send the record URL and the primary source that contradicts it. Corrections ship against the source, and the fix is itself a recorded change event.</p>
<h3>Commercial licensing</h3>
<p>Redistribution and embedding licenses per <a href="/licensing">licensing</a> — include the feed and what you are building.</p>
<h3>New feeds</h3>
<p>Suggest a government source you would pay to watch. The bar: primary documents, established reuse rights, and changes that cost someone money when missed.</p>`,
	);
}
