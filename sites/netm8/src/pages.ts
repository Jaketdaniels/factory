/** Server-rendered pages for netm8.com — the umbrella brand, distinct from feed templates. */
import { brandCss } from "@factory/core";

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
		'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#0b756f"/><path d="M7 22V10l9 9V10M20 22V10h5" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>',
	);

function page(title: string, description: string, body: string): string {
	return `<!doctype html>
<html lang="en" data-brand="netm8-parent">
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
${brandCss("netm8-parent")}
* { box-sizing: border-box; }
body { font-family: var(--font-body); background: var(--canvas); color: var(--text); max-width: 64rem; margin: 0 auto; padding: 1.5rem 2rem 5rem; line-height: 1.55; -webkit-font-smoothing: antialiased; }

/* ── Header ── */
.site { display: flex; align-items: center; justify-content: space-between; gap: 1.5rem; flex-wrap: wrap; margin-bottom: 3rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border); }
.wordmark { font-family: var(--font-code); font-weight: 750; font-size: 1.1rem; color: var(--text); text-decoration: none; letter-spacing: 0; }
.wordmark span { color: var(--link-hover); }
.site nav { display: flex; gap: 1.5rem; flex-wrap: wrap; }
.site nav a { color: var(--muted); text-decoration: none; font-size: 0.875rem; font-weight: 500; transition: color 0.15s; }
.site nav a:hover { color: var(--accent); }

/* ── Ambient hero background ── */
.hero { position: relative; padding: 2rem 0 3.5rem; margin-bottom: 3.5rem; border-bottom: 1px solid var(--border); isolation: isolate; overflow: hidden; }
.hero-bg { position: absolute; inset: -2rem 0 -1px; z-index: -1; overflow: hidden; }
.hero-bg::before { content: ""; position: absolute; inset: 0; background: radial-gradient(800px at 80% 10%, color-mix(in srgb, var(--accent) 10%, transparent), transparent 70%), radial-gradient(600px at 20% 80%, color-mix(in srgb, var(--link-hover) 8%, transparent), transparent 70%), radial-gradient(500px at 50% 50%, color-mix(in srgb, var(--accent) 5%, transparent), transparent 70%); }
.hero-bg::after { content: ""; position: absolute; inset: 0; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.35'/%3E%3C/svg%3E"); background-size: 200px 200px; opacity: 0.6; mix-blend-mode: multiply; pointer-events: none; }
.hero-lines { position: absolute; inset: 0; z-index: -1; width: 100%; height: 100%; pointer-events: none; opacity: 0.08; color: var(--accent); }

/* ── Type ── */
h1 { font-size: 3.3rem; line-height: 1.08; letter-spacing: 0; font-weight: 750; margin: 0; text-wrap: balance; max-width: 14ch; }
h2 { font-family: var(--font-code); font-size: 0.73rem; font-weight: 700; text-transform: uppercase; color: var(--accent); letter-spacing: 0; margin: 4rem 0 1.25rem; }
.hero-sub { font-size: 1.1rem; line-height: 1.5; color: var(--muted-strong); max-width: 42rem; margin: 1rem 0 1.5rem; }
.hero-cta { display: inline-flex; align-items: center; gap: 0.4rem; background: var(--accent); color: var(--accent-contrast); border: none; border-radius: var(--radius-panel); padding: 0.7rem 1.3rem; font-weight: 600; font-size: 0.9rem; text-decoration: none; transition: background 0.15s, transform 0.1s; cursor: pointer; }
.hero-cta:hover { background: var(--accent-hover); color: var(--accent-contrast); transform: translateY(-1px); }
.kicker { font-family: var(--font-code); font-size: 0.7rem; text-transform: uppercase; color: var(--accent); font-weight: 600; letter-spacing: 0; margin: 0 0 1rem; display: flex; align-items: center; flex-wrap: wrap; gap: 0.4rem; max-width: 100%; }
.kicker::before { content: ""; display: inline-block; width: 0.4rem; height: 0.4rem; border-radius: 50%; background: var(--accent); }
a { color: var(--accent); text-underline-offset: 3px; transition: color 0.15s; }
a:hover { color: var(--link-hover); }

/* ── Problem ── */
.problem-text { font-size: 1rem; line-height: 1.6; color: var(--muted); max-width: 40rem; margin: 0; }

/* ── Benefits grid ── */
.benefits { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.25rem; }
.benefit-tile { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-panel); padding: 1.3rem 1.4rem; transition: transform 0.15s, box-shadow 0.15s; }
.benefit-tile:hover { transform: translateY(-2px); box-shadow: 0 4px 16px var(--shadow); }
.benefit-icon { display: inline-flex; width: 2rem; height: 2rem; align-items: center; justify-content: center; background: var(--accent-wash); border-radius: 7px; margin-bottom: 0.7rem; color: var(--accent); }
.benefit-tile h3 { font-size: 0.9375rem; font-weight: 650; margin: 0 0 0.3rem; }
.benefit-tile p { color: var(--muted); margin: 0; font-size: 0.875rem; line-height: 1.5; }

/* ── Live feeds ── */
.feed-cards { display: grid; gap: 0.75rem; }
.feed-card { display: flex; align-items: center; gap: 1rem; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-panel); padding: 1rem 1.3rem; transition: transform 0.15s, box-shadow 0.15s; }
.feed-card:hover { transform: translateY(-1px); box-shadow: 0 4px 12px var(--shadow); }
.feed-dot { width: 0.55rem; height: 0.55rem; border-radius: 50%; background: var(--datum-fresh); flex: none; }
.feed-card h3 { font-size: 0.9375rem; font-weight: 650; margin: 0; }
.feed-card h3 a { color: var(--text); text-decoration: none; }
.feed-card h3 a:hover { color: var(--accent); }
.feed-card p { margin: 0.15rem 0 0; color: var(--muted); font-size: 0.8125rem; line-height: 1.4; }
.feed-card .feed-cta { margin-left: auto; flex: none; font-size: 0.85rem; font-weight: 600; color: var(--accent); text-decoration: none; white-space: nowrap; }
.feed-card .feed-cta::after { content: " →"; }
.feed-card .feed-cta:hover { color: var(--link-hover); }

/* ── Closing CTA ── */
.closing-cta { margin-top: 4rem; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-panel); padding: 2rem; text-align: center; }
.closing-cta p { margin: 0 0 1rem; font-size: 0.9375rem; color: var(--muted); }
.closing-cta .big { font-size: 1.1rem; color: var(--text); font-weight: 650; }

/* ── Foot ── */
ol, ul { padding-left: 1.2rem; }
li { margin: 0.45rem 0; }
footer { margin-top: 4rem; padding-top: 1.5rem; border-top: 1px solid var(--border); font-size: 0.84rem; color: var(--muted); display: flex; flex-wrap: wrap; gap: 0.25rem 1.5rem; }
footer p { margin: 0; }
.imprint { font-family: var(--font-code); font-size: 0.76rem; color: var(--muted-strong); }

/* ── Responsive ── */
@media (max-width: 700px) {
	.benefits { grid-template-columns: 1fr; }
	body { padding: 1rem 1.25rem 4rem; }
	h1 { font-size: 2.25rem; }
	.hero-sub { font-size: 1rem; }
	.hero { padding: 1.5rem 0 2.5rem; }
	.feed-card { flex-wrap: wrap; }
	.feed-card .feed-cta { margin-left: 0; }
}
@media (max-width: 480px) {
	.site { align-items: flex-start; }
	.site nav { width: 100%; }
	h1 { max-width: 100%; }
}
</style>
</head>
<body>
<header class="site">
<a class="wordmark" href="/">net<span>m8</span></a>
<nav><a href="/standards">Standards</a><a href="/licensing">Licensing</a><a href="/contact">Contact</a></nav>
</header>
${body}
<footer>
<p class="imprint">netm8</p>
<p>specialist context kept current</p>
<p><a href="/standards">Feed contract</a></p>
</footer>
</body>
</html>`;
}

export function homePage(): string {
	return page(
		"netm8 — current context APIs for specialist domains",
		"Government registers, regulatory filings, and agency sources delivered as clean, source-linked APIs for AI agents and developers.",
		`<section class="hero">
<div class="hero-bg">
<svg class="hero-lines" viewBox="0 0 800 400" preserveAspectRatio="none" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M0 250 Q 200 80, 400 220 T 800 180" stroke="currentColor" stroke-width="0.6"/><path d="M0 300 Q 250 150, 450 280 T 800 120" stroke="currentColor" stroke-width="0.4"/><path d="M0 200 Q 180 50, 380 200 T 800 280" stroke="currentColor" stroke-width="0.3"/></svg>
</div>
<p class="kicker">For AI agents that answer about what's new</p>
<h1>Current specialist context for your stack.</h1>
<p class="hero-sub">Government registers, regulatory filings, and agency sources — delivered as clean, source-linked APIs. Your agents get fresh facts without building scrapers.</p>
<a class="hero-cta" href="https://tariff.watch">Start free →</a>
</section>

<h2>Why netm8</h2>
<p class="problem-text">Your AI's training data froze months ago. One tariff change or recall notice and your agent's answer is wrong. netm8 polls primary sources daily so your context stays current — without you maintaining ingest pipelines.</p>

<h2>What you get</h2>
<div class="benefits">
<div class="benefit-tile">
<div class="benefit-icon">
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
</div>
<h3>Source-linked records</h3>
<p>Every fact carries its government URL. Verify any answer in one click.</p>
</div>
<div class="benefit-tile">
<div class="benefit-icon">
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
</div>
<h3>Immutable snapshots</h3>
<p>Dated archives that never change. Audit trails your team can actually rely on.</p>
</div>
<div class="benefit-tile">
<div class="benefit-icon">
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
</div>
<h3>Drop-in protocols</h3>
<p>llms.txt, MCP, JSON API, RSS. Adapters your agents already know how to use.</p>
</div>
<div class="benefit-tile">
<div class="benefit-icon">
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
</div>
<h3>One schema</h3>
<p>FeedItemV1 across every feed. Integrate once, use every domain.</p>
</div>
</div>

<h2>Live feeds</h2>
<div class="feed-cards">
<div class="feed-card">
<span class="feed-dot"></span>
<div>
<h3><a href="https://tariff.watch">tariff.watch</a></h3>
<p>US tariff changes from the Federal Register — programs, legal status, effective dates, comment deadlines.</p>
</div>
<a class="feed-cta" href="https://tariff.watch">Start free</a>
</div>
<div class="feed-card">
<span class="feed-dot"></span>
<div>
<h3><a href="https://recalls.netm8.com">recalls.netm8.com</a></h3>
<p>FDA recalls as structured events — severity, lifecycle status, provenance, source hashes.</p>
</div>
<a class="feed-cta" href="https://recalls.netm8.com">Start free</a>
</div>
</div>

<div class="closing-cta">
<p class="big">Free during launch. Metered pay-as-you-go after. No subscription floor.</p>
<p>Your first API key in under a minute.</p>
<a class="hero-cta" href="https://tariff.watch">Get your API key →</a>
</div>`,
	);
}

export function standardsPage(): string {
	return page(
		"Standards — netm8",
		"The netm8 feed contract: FeedItemV1 record schema and the six publishing rules every feed follows.",
		`<h1>Standards</h1>
<p class="hero-sub" style="margin-bottom:2rem">Every netm8 feed publishes the same record shape under the same rules. The contract is versioned and public; if a feed violates it, that is a bug.</p>

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
		"How netm8 feeds may be used: free reading with attribution, launch-free API keys, metered machine access after billing launch, and licensed commercial redistribution.",
		`<h1>Licensing</h1>
<p class="hero-sub" style="margin-bottom:2rem">The underlying facts are public records. netm8 sells the useful layer: current normalization, source-linked context, immutable archives, machine interfaces, and alerting.</p>

<h3>Reading is free</h3>
<p>Each feed's human surfaces — latest records, snapshots, RSS, calendar, and source links — are free for personal use, research, and grounding humans or AI agents, with attribution (the feed's name and a link). Bulk redistribution or republication of these surfaces as a dataset is not permitted.</p>

<h3>Machine access is metered per feed</h3>
<p>During launch, feeds may issue free API keys while Stripe billing is verified. After launch, structured APIs, MCP tool calls, and dated snapshot archives are sold by the feed that publishes them: Pay as you go, Fixed rate - monthly, or Fixed rate - annual. Keys are not transferable; reselling raw access is not permitted. See each feed's terms (e.g. <a href="https://tariff.watch/terms">tariff.watch/terms</a>).</p>

<h3>Commercial redistribution is licensed</h3>
<p>Embedding a feed in a product you sell, redistributing records, or white-labeling requires a commercial license from netm8. Write to <a href="mailto:hello@netm8.com">hello@netm8.com</a> with what you are building — licenses are flat, fast, and per feed.</p>

<h3>The disclaimer that applies everywhere</h3>
<p>Feeds are source-linked context APIs, not legal, customs, medical, financial, or professional advice. Verify against the cited source before compliance use.</p>`,
	);
}

export function contactPage(): string {
	return page(
		"Contact — netm8",
		"Contact netm8: corrections, commercial licensing, and new feed requests.",
		`<h1>Contact</h1>
<p class="hero-sub" style="margin-bottom:2rem">One inbox, read by the operator: <a href="mailto:hello@netm8.com">hello@netm8.com</a></p>
<h3>Corrections</h3>
<p>If a record looks wrong, send the record URL and the primary source that contradicts it. Corrections ship against the source, and the fix is itself a recorded change event.</p>
<h3>Commercial licensing</h3>
<p>Redistribution and embedding licenses per <a href="/licensing">licensing</a> — include the feed and what you are building.</p>
<h3>New feeds</h3>
<p>Suggest a source category you would pay to keep current. The bar: reliable source material, established reuse rights, a domain where stale context causes mistakes, and changes that cost someone money when missed.</p>`,
	);
}
