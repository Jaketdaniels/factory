/** Server-rendered pages for tariff-watch. Plain HTML, no client framework. */
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
		'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#0b756f"/><path d="M7 11h18M7 16h13M7 21h16" stroke="#d2a44c" stroke-width="2.6" stroke-linecap="round"/></svg>',
	);

function page(title: string, body: string): string {
	return `<!doctype html>
<html lang="en" data-brand="netm8-feed">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="Daily changelog of US tariff, customs and trade-action changes with legal status, effective dates and primary-source links — from the Federal Register, for humans and AI agents.">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="What changed in US tariffs today: legal status, effective dates, primary sources. Markdown snapshots, feeds and a JSON API for agents.">
<meta property="og:type" content="website">
<link rel="icon" href="${FAVICON}">
<title>${title}</title>
<style>
${brandCss("netm8-feed")}
* { box-sizing: border-box; }
/* No scroll-behavior:smooth — browsers with smooth scrolling disabled
   silently drop the scroll entirely, breaking anchor navigation. */
body { font-family: var(--font-body); background: var(--canvas); color: var(--text); max-width: 44rem; margin: 0 auto; padding: 2.25rem 1.25rem 4rem; line-height: 1.65; }
.site { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin-bottom: 2.75rem; }
.wordmark { font-family: var(--font-code); font-weight: 600; font-size: 1.05rem; color: var(--text); text-decoration: none; }
.wordmark span { color: var(--accent); }
.site nav { display: flex; gap: 1.1rem; flex-wrap: wrap; }
.site nav a { color: var(--muted); text-decoration: none; font-size: 0.85rem; transition: color 0.15s; }
.site nav a:hover { color: var(--text); }
.wordmark { transition: color 0.15s; }
.wordmark:hover { color: var(--accent); }
h1 { font-size: 2.3rem; line-height: 1.12; letter-spacing: 0; margin: 0 0 1.1rem; text-wrap: balance; }
.meta-links { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; margin: 1.25rem 0 0; }
.meta-link { display: inline-flex; align-items: center; gap: 0.45rem; color: var(--muted); font: inherit; font-size: 0.9rem; text-decoration: none; background: none; border: none; padding: 0; cursor: pointer; transition: color 0.15s; }
.meta-link:hover { color: var(--text); }
.meta-link svg { flex: none; }
.meta-sep { width: 1px; height: 1.05rem; background: var(--border); }
h2 { font-family: var(--font-code); font-size: 0.8rem; font-weight: 600; letter-spacing: 0; text-transform: uppercase; color: var(--muted); margin: 3.25rem 0 1rem; }
.lede { font-size: 1.05rem; max-width: 60ch; }
a { color: var(--accent); text-underline-offset: 3px; transition: color 0.15s; }
a:hover { color: var(--link-hover); }
code, pre, .datum, .badge { font-family: var(--font-code); }
code { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-control); padding: 0.1rem 0.35rem; font-size: 0.85em; }
pre { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 1rem; overflow-x: auto; line-height: 1.55; font-size: 0.82rem; }
.tabs { display: flex; margin: 1rem 0 0; border: 1px solid var(--border); border-bottom: none; border-radius: 8px 8px 0 0; background: var(--surface); overflow-x: auto; }
.tabs [role="tab"] { font-family: var(--font-code); font-size: 0.78rem; font-weight: 500; color: var(--muted); background: none; border: none; border-radius: 0; padding: 0.55rem 1rem; cursor: pointer; box-shadow: inset 0 -2px 0 transparent; transition: color 0.15s ease; }
.tabs [role="tab"]:hover { color: var(--text); filter: none; }
.tabs [role="tab"]:active { transform: none; }
.tabs [role="tab"][aria-selected="true"] { color: var(--text); box-shadow: inset 0 -2px 0 var(--accent); }
pre[role="tabpanel"] { margin-top: 0; border-top-left-radius: 0; border-top-right-radius: 0; }
.datum { color: var(--datum); font-variant-numeric: tabular-nums; }
.badge { display: inline-block; font-size: 0.72rem; border: 1px solid var(--border); border-radius: 4px; padding: 0.05rem 0.4rem; color: var(--muted); white-space: nowrap; }
.badge.proposed { color: var(--badge); border-color: color-mix(in srgb, var(--badge) 40%, transparent); }
.badge.effective { color: var(--badge-good); border-color: color-mix(in srgb, var(--badge-good) 40%, transparent); }
.badge.stayed, .badge.enjoined, .badge.expired { color: var(--badge-alert); border-color: color-mix(in srgb, var(--badge-alert) 40%, transparent); }
.badge.doctype { color: var(--badge-info); border-color: color-mix(in srgb, var(--badge-info) 35%, transparent); }
.t-program { color: var(--program); }
.t-agency { color: var(--muted); }
h3 { font-size: 0.95rem; margin: 1.6rem 0 0.45rem; }
.deadline { display: flex; gap: 1rem; align-items: baseline; padding: 0.55rem 0; border-top: 1px solid var(--border); font-size: 0.92rem; }
.deadline:last-of-type { border-bottom: 1px solid var(--border); }
.deadline .datum { color: var(--datum-fresh); flex: none; }
.deadline .kind { color: var(--muted); flex: none; font-size: 0.82rem; }
.deadline a { color: var(--text); text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.deadline a:hover { color: var(--accent); }
.doc { padding: 0.85rem 0; border-top: 1px solid var(--border); transition: padding-left 0.15s; }
.doc:last-of-type { border-bottom: 1px solid var(--border); }
.doc > a { color: var(--text); text-decoration: none; }
.doc > a:hover { color: var(--accent); }
.meta { font-size: 0.8rem; color: var(--muted); margin-top: 0.35rem; display: flex; flex-wrap: wrap; gap: 0.45rem; align-items: baseline; }
.pricing-flow { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.pricing-tabs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border-bottom: 1px solid var(--border); }
.pricing-tabs [role="tab"] { color: var(--muted); background: transparent; border: none; border-right: 1px solid var(--border); border-radius: 0; padding: 0.75rem 0.6rem; box-shadow: inset 0 -2px 0 transparent; }
.pricing-tabs [role="tab"]:last-child { border-right: none; }
.pricing-tabs [role="tab"]:hover { color: var(--text); filter: none; }
.pricing-tabs [role="tab"]:active { transform: none; }
.pricing-tabs [role="tab"][aria-selected="true"] { color: var(--text); box-shadow: inset 0 -2px 0 var(--accent); }
.pricing-panel { padding: 1.05rem 1.2rem; }
.pricing-panel[hidden] { display: none; }
.pricing-price { font-size: 1.04rem; font-weight: 700; margin: 0 0 0.35rem; }
.pricing-price .datum { font-size: 1.32rem; color: var(--datum); margin-right: 0.1rem; }
.pricing-detail { margin: 0; font-size: 0.88rem; color: var(--muted); max-width: 58ch; }
.checkout-step { display: flex; gap: 0.5rem; flex-wrap: wrap; padding: 1.05rem 1.2rem; border-top: 1px solid var(--border); }
.checkout-step label { width: 100%; color: var(--text); font-weight: 700; font-size: 0.92rem; }
.checkout-note { width: 100%; margin: 0.25rem 0 0; color: var(--muted); font-size: 0.86rem; }
.faq { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem 2rem; }
.faq h3 { font-size: 0.95rem; margin: 0 0 0.35rem; }
.faq p { margin: 0; font-size: 0.88rem; color: var(--muted); }
input { font: inherit; background: var(--canvas); color: var(--text); border: 1px solid var(--border); border-radius: var(--radius-control); padding: 0.5rem 0.65rem; flex: 1; min-width: 0; transition: border-color 0.15s; }
input:focus { border-color: var(--accent); outline: none; }
button { font: inherit; font-weight: 600; background: var(--accent); color: var(--accent-contrast); border: none; border-radius: var(--radius-control); padding: 0.5rem 0.95rem; cursor: pointer; transition: filter 0.15s, transform 0.1s; }
button:hover { filter: brightness(1.1); }
button:active { transform: translateY(1px); }
button:disabled { opacity: 0.55; cursor: default; }
input:focus-visible, button:focus-visible, a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.error { color: var(--badge-alert); font-size: 0.88rem; width: 100%; margin: 0.25rem 0 0; }
.confirm { color: var(--badge-good); font-size: 0.88rem; width: 100%; margin: 0.25rem 0 0; }
.inline-form { display: flex; gap: 0.5rem; flex-wrap: wrap; max-width: 30rem; }
.danger { background: var(--badge-alert); color: var(--canvas); }
footer { margin-top: 4rem; padding-top: 1.4rem; border-top: 1px solid var(--border); font-size: 0.84rem; color: var(--muted); }
footer p { margin: 0 0 0.5rem; }
.imprint { font-family: var(--font-code); font-size: 0.76rem; }
@media (max-width: 640px) {
	.faq { grid-template-columns: 1fr; }
	.deadline a { white-space: normal; }
	.pricing-tabs { grid-template-columns: 1fr; }
	.pricing-tabs [role="tab"] { border-right: none; border-bottom: 1px solid var(--border); }
	.pricing-tabs [role="tab"]:last-child { border-bottom: none; }
}
@media (prefers-reduced-motion: reduce) {
	* { transition: none !important; }
}
</style>
</head>
<body>
<header class="site">
<a class="wordmark" href="/">tariff<span>.watch</span></a>
<nav>
<a href="/snapshot/latest.md">snapshot</a>
<a href="/calendar.ics">calendar</a>
<a href="/llms.txt">llms.txt</a>
<a href="#plans">pricing</a>
</nav>
</header>
<main>
${body}
</main>
<footer>
<p>Source: <a href="https://www.federalregister.gov/">Federal Register</a> (US government work, public domain). tariff.watch publishes its own factual summaries and links every primary document. No third-party text is reproduced.</p>
<p class="imprint">a <a href="https://netm8.com" style="color:var(--accent)">netm8</a> feed · facts only, primary sources, immutable snapshots · <a href="/terms">terms</a> · <a href="/account/delete">delete your key &amp; data</a></p>
</footer>
</body>
</html>`;
}

import { agencySlug, type PublicTradeAction } from "./trade-action";

function actionRow(a: PublicTradeAction): string {
	const dates = [
		a.effective_on === null ? null : `takes effect <span class="datum">${escapeHtml(a.effective_on)}</span>`,
		a.comments_close_on === null ? null : `comments due <span class="datum">${escapeHtml(a.comments_close_on)}</span>`,
		a.hearing_on === null ? null : `hearing <span class="datum">${escapeHtml(a.hearing_on)}</span>`,
	].filter((value): value is string => value !== null);
	return `<article class="doc">
<a href="/d/${escapeHtml(a.document_number)}">${escapeHtml(a.title)}</a>
<div class="meta">
<span class="datum">${escapeHtml(a.publication_date)}</span>
<span class="badge doctype">${escapeHtml(a.type)}</span>
${statusBadge(a.legal_status)}
<a class="t-program" href="/program/${escapeHtml(a.program)}">${escapeHtml(programLabel(a.program))}</a>
${a.agencies.map((name) => `<a class="t-agency" href="/agency/${escapeHtml(agencySlug(name))}">${escapeHtml(name)}</a>`).join("")}
${dates.length > 0 ? `<span>${dates.join(" · ")}</span>` : ""}
</div>
</article>`;
}

/** Index page for a program or agency facet — the cron is the content team. */
export function facetPage(title: string, description: string, actions: PublicTradeAction[]): string {
	return page(
		`${title} — tariff.watch`,
		`<h1>${escapeHtml(title)}</h1>
<p class="lede">${escapeHtml(description)}</p>
${actions.map(actionRow).join("\n")}
<p class="meta">Every entry links its primary federalregister.gov document. Structured access: <a href="/llms.txt">llms.txt</a>.</p>`,
	);
}

/** Permanent page for one trade action: the citable record. */
export function documentPage(a: PublicTradeAction): string {
	const rows: [string, string][] = [
		["Published", a.publication_date],
		["Program", programLabel(a.program)],
		["Legal status", a.legal_status],
		["Confidence", a.confidence],
	];
	if (a.effective_on !== null) rows.push(["Takes effect", a.effective_on]);
	if (a.comments_close_on !== null) rows.push(["Comments due", a.comments_close_on]);
	if (a.hearing_on !== null) rows.push(["Hearing", a.hearing_on]);
	return page(
		`${a.title} — tariff.watch`,
		`<h1>${escapeHtml(a.title)}</h1>
<div class="meta" style="margin-bottom:1.2rem">
<span class="badge doctype">${escapeHtml(a.type)}</span>
${statusBadge(a.legal_status)}
${a.agencies.map((name) => `<a class="t-agency" href="/agency/${escapeHtml(agencySlug(name))}">${escapeHtml(name)}</a>`).join("")}
</div>
${rows.map(([k, v]) => `<div class="deadline"><span class="kind">${escapeHtml(k)}</span><span class="datum">${escapeHtml(v)}</span></div>`).join("\n")}
${a.abstract === null || a.abstract.length === 0 ? "" : `<h3>Summary</h3><p>${escapeHtml(a.abstract)}</p>`}
<h3>Primary source</h3>
<p><a href="${escapeHtml(a.url)}" rel="noopener">${escapeHtml(a.url)}</a> — Federal Register document ${escapeHtml(a.document_number)} (US government work, public domain).</p>
<p class="meta">Point-in-time record: <code>/snapshot/${escapeHtml(a.publication_date)}.md</code> (API key required) preserves what was known on publication day. Verify against the cited source before compliance use.</p>`,
	);
}

export interface LandingDoc {
	title: string;
	docType: string;
	publicationDate: string;
	url: string;
	agencies: string[];
	program: string;
	legalStatus: string;
	effectiveOn: string | null;
	commentsCloseOn: string | null;
	hearingOn: string | null;
}

export interface UpcomingDeadline {
	date: string;
	kind: string;
	title: string;
	url: string;
}

export interface LandingInput {
	docs: LandingDoc[];
	latestSnapshotDate: string | null;
	freeQuota: number;
	baseUrl: string;
	upcoming: UpcomingDeadline[];
	fixedMonthlyCalls: number;
	fixedAnnualCalls: number;
	/** SQLite datetime ("YYYY-MM-DD HH:MM:SS", UTC) of the latest ingest run. */
	lastCheckedAt: string | null;
}

const PROGRAM_LABELS: Record<string, string> = {
	section_301: "Section 301",
	section_301_forced_labor: "Section 301 · forced labor",
	section_232: "Section 232",
	trade_remedies: "AD/CVD",
	de_minimis: "De minimis",
	foreign_trade_zones: "Foreign-trade zones",
	trade_action: "Trade action",
};

const DEADLINE_LABELS: Record<string, string> = {
	effective: "Takes effect",
	comment_due: "Comments due",
	hearing: "Hearing",
};

function programLabel(program: string): string {
	return PROGRAM_LABELS[program] ?? program.replaceAll("_", " ");
}

function statusBadge(status: string): string {
	const label = status.charAt(0).toUpperCase() + status.slice(1);
	return `<span class="badge ${escapeHtml(status)}">${escapeHtml(label)}</span>`;
}

export function landingPage(input: LandingInput): string {
	const { docs, latestSnapshotDate, freeQuota, baseUrl, upcoming, lastCheckedAt, fixedMonthlyCalls, fixedAnnualCalls } =
		input;

	const deadlineList =
		upcoming.length === 0
			? ""
			: `<h2 id="deadlines">Upcoming deadlines</h2>
${upcoming
	.map(
		(event) => `<div class="deadline">
<span class="datum">${escapeHtml(event.date)}</span>
<span class="kind">${escapeHtml(DEADLINE_LABELS[event.kind] ?? event.kind)}</span>
<a href="${escapeHtml(event.url)}" rel="noopener">${escapeHtml(event.title)}</a>
</div>`,
	)
	.join("\n")}
<p class="meta">Every date above comes from the linked document. Subscribe to all of them: <a href="/calendar.ics"><code>/calendar.ics</code></a></p>`;

	const docList =
		docs.length === 0
			? `<p class="meta">No documents ingested yet. The first daily snapshot is on its way.</p>`
			: docs
					.map((d) => {
						const dates = [
							d.effectiveOn === null ? null : `takes effect <span class="datum">${escapeHtml(d.effectiveOn)}</span>`,
							d.commentsCloseOn === null
								? null
								: `comments due <span class="datum">${escapeHtml(d.commentsCloseOn)}</span>`,
							d.hearingOn === null ? null : `hearing <span class="datum">${escapeHtml(d.hearingOn)}</span>`,
						].filter((value): value is string => value !== null);
						return `<article class="doc">
<a href="${escapeHtml(d.url)}" rel="noopener">${escapeHtml(d.title)}</a>
<div class="meta">
<span class="datum">${escapeHtml(d.publicationDate)}</span>
<span class="badge doctype">${escapeHtml(d.docType)}</span>
${statusBadge(d.legalStatus)}
<span class="t-program">${escapeHtml(programLabel(d.program))}</span>
${d.agencies.length > 0 ? `<span class="t-agency">${escapeHtml(d.agencies.join(", "))}</span>` : ""}
${dates.length > 0 ? `<span>${dates.join(" · ")}</span>` : ""}
</div>
</article>`;
					})
					.join("\n");

	const snapshotNote =
		latestSnapshotDate === null
			? ""
			: `\n<p class="meta">Latest snapshot: <a href="/snapshot/latest.md"><span class="datum">${escapeHtml(latestSnapshotDate)}</span></a>.</p>`;

	const safeBase = escapeHtml(baseUrl);

	return page(
		"tariff.watch — daily US tariff & trade-action changelog",
		`<h1>What changed in US tariffs today</h1>
<p class="lede">US trade policy changes weekly: Section 232 and 301 actions, de-minimis rules, exclusion lists, antidumping orders, forced-labor measures. tariff.watch reads every trade-relevant Federal Register document daily and records each change with its legal status, effective date, and a link to the primary source. Humans get this changelog; agents get immutable Markdown snapshots, feeds, and a JSON API.</p>
<div class="meta-links">
<button type="button" class="meta-link" id="copy-md">
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>
<span>Copy as markdown</span>
</button>
<span class="meta-sep" aria-hidden="true"></span>
<a class="meta-link" href="#plans">
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="16" r="4"/><path d="m11 13 9-9"/><path d="m16 5 3 3"/></svg>
<span>Get an API key</span>
</a>
${
	lastCheckedAt === null
		? ""
		: `<span class="meta-sep" aria-hidden="true"></span>
<span class="meta-link" style="cursor: default">Last checked <span class="datum">${escapeHtml(lastCheckedAt.slice(0, 16))} UTC</span></span>`
}
</div>

${deadlineList}

<h2 id="latest">Latest trade actions</h2>
${docList}

<h2 id="agents">Built for AI agents</h2>

<h3>Copy this link to your LLM of choice for instant context</h3>
<pre>${safeBase}/snapshot/latest.md   # last 7 days, regenerated daily</pre>${snapshotNote}

<h3>For commercial use we offer a usage-based API</h3>
<div class="tabs" role="tablist" aria-label="API access methods">
<button type="button" role="tab" id="tab-rss" aria-selected="true" aria-controls="panel-rss">RSS</button>
<button type="button" role="tab" id="tab-mcp" aria-selected="false" aria-controls="panel-mcp" tabindex="-1">MCP</button>
<button type="button" role="tab" id="tab-curl" aria-selected="false" aria-controls="panel-curl" tabindex="-1">curl</button>
</div>
<pre role="tabpanel" id="panel-rss" aria-labelledby="tab-rss">${safeBase}/feed.xml   # every change, source-linked, any reader, no key</pre>
<pre role="tabpanel" id="panel-mcp" aria-labelledby="tab-mcp" hidden>claude mcp add --transport http tariff-watch ${safeBase}/mcp \\
  --header "Authorization: Bearer $TARIFF_WATCH_KEY"

# any other MCP client
{ "mcpServers": { "tariff-watch": {
    "type": "http",
    "url": "${safeBase}/mcp",
    "headers": { "Authorization": "Bearer fk_..." } } } }</pre>
<pre role="tabpanel" id="panel-curl" aria-labelledby="tab-curl" hidden>export TARIFF_WATCH_KEY="fk_..."
curl -H "Authorization: Bearer $TARIFF_WATCH_KEY" "${safeBase}/v1/changes?since=2026-06-01"
curl -H "Authorization: Bearer $TARIFF_WATCH_KEY" ${safeBase}/snapshot/2026-06-09.md</pre>
<p class="meta">MCP tools: <code>tariffs_list_changes</code>, <code>tariffs_effective_dates</code>, <code>tariffs_get_source</code>. Listing tools is free; each tool call meters as one request.</p>

<h2 id="plans">Pricing</h2>
<section class="pricing-flow" aria-labelledby="pricing-title">
<h3 id="pricing-title" style="position:absolute;left:-9999px">Pricing plans</h3>
<div class="pricing-tabs" role="tablist" aria-label="Pricing plans">
<button type="button" role="tab" id="plan-tab-payg" aria-selected="true" aria-controls="plan-panel-payg" data-plan="payg">Pay as you go</button>
<button type="button" role="tab" id="plan-tab-fixed-monthly" aria-selected="false" aria-controls="plan-panel-fixed-monthly" data-plan="fixed_monthly" tabindex="-1">Fixed rate - monthly</button>
<button type="button" role="tab" id="plan-tab-fixed-annual" aria-selected="false" aria-controls="plan-panel-fixed-annual" data-plan="fixed_annual" tabindex="-1">Fixed rate - annual</button>
</div>
<div class="pricing-panel" role="tabpanel" id="plan-panel-payg" aria-labelledby="plan-tab-payg" data-cta="Start free">
<p class="pricing-price">Free during launch; then US$0.10 per API call</p>
<p class="pricing-detail">Your first <span class="datum">${freeQuota}</span> API calls are free via signup credit after billing is enabled. Best for trying the API, MCP tools, and dated archive without a subscription floor; cancel anytime.</p>
</div>
<div class="pricing-panel" role="tabpanel" id="plan-panel-fixed-monthly" aria-labelledby="plan-tab-fixed-monthly" data-cta="Start monthly" hidden>
<p class="pricing-price"><span class="datum">$29</span> / month</p>
<p class="pricing-detail">${fixedMonthlyCalls} API calls included every month, plus watchlist alerts by email and HMAC-signed webhook. Overage at US$0.10 per call. Cancel anytime.</p>
</div>
<div class="pricing-panel" role="tabpanel" id="plan-panel-fixed-annual" aria-labelledby="plan-tab-fixed-annual" data-cta="Start annual" hidden>
<p class="pricing-price"><span class="datum">$290</span> / year</p>
<p class="pricing-detail">${fixedAnnualCalls.toLocaleString("en-US")} API calls included for the year at a better effective rate, plus the same watchlist alerts and webhook delivery.</p>
</div>
<form id="checkout" class="checkout-step">
<input type="hidden" name="plan" value="payg">
<label for="checkout-email">Step 2: where should the key receipt go?</label>
<input id="checkout-email" name="email" type="email" required autocomplete="email" placeholder="you@example.com" aria-label="Email for selected plan">
<button type="submit">Start free</button>
<p class="checkout-note">Launch access is free while Stripe billing is verified. Key shown once after checkout, never emailed.</p>
<p class="error" id="checkout-error" role="alert" hidden></p>
</form>
<p class="meta" style="padding:0 1.2rem 1.05rem;margin:0">Manage watchlists with your key: <code>GET/POST /v1/watchlists</code> — never billed.</p>
</section>

<h2 id="faq">Questions</h2>
<div class="faq">
<div>
<h3>Where does the data come from?</h3>
<p>Every entry is an original one-line record of a Federal Register document: USTR, CBP, ITA, ITC, BIS, the Foreign-Trade Zones Board, and presidential tariff documents. US government works are public domain (17 U.S.C. §105).</p>
</div>
<div>
<h3>What do the statuses mean?</h3>
<p>Proposed, final, and effective come from the document type and its stated effective date. Court-driven statuses appear only when pinned to a specific document. The primary source is always one click away.</p>
</div>
<div>
<h3>What does immutable mean here?</h3>
<p>Each day's snapshot freezes when it is generated. <code>/snapshot/2026-06-09.md</code> returns the same bytes next year, so software can prove what was known on a date.</p>
</div>
<div>
<h3>Is this legal advice?</h3>
<p>No. It is a changelog of public records. For decisions with money on the line, read the linked document or ask a licensed professional.</p>
</div>
</div>
<script>
function wireForm(formId, errorId, onSubmit) {
  const form = document.getElementById(formId);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById(errorId);
    errorEl.hidden = true;
    const button = form.querySelector("button");
    const original = button.textContent;
    button.disabled = true;
    button.textContent = "Working…";
    try {
      await onSubmit(form, button);
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.hidden = false;
      button.disabled = false;
      button.textContent = original;
    }
  });
}
const tabs = Array.from(document.querySelectorAll('.tabs [role="tab"]'));
function selectTab(tab) {
  for (const t of tabs) {
    const selected = t === tab;
    t.setAttribute("aria-selected", String(selected));
    t.tabIndex = selected ? 0 : -1;
    document.getElementById(t.getAttribute("aria-controls")).hidden = !selected;
  }
  tab.focus();
}
tabs.forEach((tab, i) => {
  tab.addEventListener("click", () => selectTab(tab));
  tab.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    selectTab(tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length]);
  });
});
const pricingTabs = Array.from(document.querySelectorAll('.pricing-tabs [role="tab"]'));
const checkoutForm = document.getElementById("checkout");
const checkoutButton = checkoutForm.querySelector("button");
function selectPricingTab(tab) {
  for (const current of pricingTabs) {
    const selected = current === tab;
    current.setAttribute("aria-selected", String(selected));
    current.tabIndex = selected ? 0 : -1;
    document.getElementById(current.getAttribute("aria-controls")).hidden = !selected;
  }
  const panel = document.getElementById(tab.getAttribute("aria-controls"));
  checkoutForm.plan.value = tab.dataset.plan;
  checkoutButton.textContent = panel.dataset.cta;
  tab.focus();
}
pricingTabs.forEach((tab, i) => {
  tab.addEventListener("click", () => selectPricingTab(tab));
  tab.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    selectPricingTab(pricingTabs[(i + (e.key === "ArrowRight" ? 1 : pricingTabs.length - 1)) % pricingTabs.length]);
  });
});
const copyBtn = document.getElementById("copy-md");
copyBtn.addEventListener("click", async () => {
  const label = copyBtn.querySelector("span");
  try {
    const res = await fetch("/snapshot/latest.md");
    if (!res.ok) throw new Error();
    await navigator.clipboard.writeText(await res.text());
    label.textContent = "Copied";
  } catch {
    label.textContent = "Copy failed";
  }
  setTimeout(() => { label.textContent = "Copy as markdown"; }, 2000);
});
wireForm("checkout", "checkout-error", async (form, button) => {
  const res = await fetch("/billing/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: form.email.value, plan: form.plan.value }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? "Checkout failed. Please try again.");
  button.textContent = "Redirecting...";
  window.location.href = data.url;
});
</script>`,
	);
}

/** Terms: the OpenSanctions-style license layer that protects the asset. */
export function termsPage(): string {
	return page(
		"Terms — tariff.watch",
		`<h1>Terms</h1>
<p class="lede">Short version: the facts are public domain, our summaries are free to ground on with attribution, machine access is billed as displayed, and you can delete everything we hold about you at any time.</p>

<h3>The data</h3>
<p>Entries summarize US federal government documents, which carry no copyright (17 U.S.C. §105). Every entry links its primary source. The one-line summaries, normalized fields, and snapshots are tariff.watch's own work.</p>

<h3>Free surfaces</h3>
<p>The changelog, latest snapshot, RSS, calendar, and llms.txt are free for personal use, research, and grounding humans or AI agents, with attribution ("tariff.watch" and a link). Bulk redistribution, resale, or republication of these surfaces as a dataset is not permitted. Free surfaces are rate-limited as an abuse brake.</p>

<h3>Keyed access</h3>
<p>The JSON API, MCP tools, and dated snapshot archive are for use inside your own applications, billed exactly as displayed on the <a href="/#plans">pricing section</a>. Keys are not transferable; reselling raw access is not permitted.</p>

<h3>Commercial redistribution</h3>
<p>Embedding the feed in a product you sell, redistributing the data, or white-labeling requires a license — email <a href="mailto:hello@netm8.com">hello@netm8.com</a> with what you are building.</p>

<h3>Not advice</h3>
<p>tariff.watch is a changelog of public records, not legal, customs, or financial advice. Verify against the cited source before compliance use.</p>

<h3>No warranty</h3>
<p>The service is provided as-is. Sources are polled four times daily on reasonable efforts; statuses are inferred only from signals the source carries, and corrections are applied when sources correct themselves.</p>

<h3>Your data</h3>
<p>We hold the email you sign up with (receipts and deletion only), hashed API keys, and usage records for billing. Delete all of it at any time at <a href="/account/delete">/account/delete</a> — the inline confirmation is immediate and your Stripe subscription is cancelled with it.</p>

<p class="meta">Changes to these terms are posted on this page. tariff.watch is a netm8 feed.</p>`,
	);
}

/** Standalone, discreetly linked deletion page (footer + receipt emails). */
export function deletePage(): string {
	return page(
		"Delete your key — tariff.watch",
		`<h1>Delete your key</h1>
<p class="lede">Enter the email you signed up with. Your key, its usage records, and your address are deleted immediately, and your Stripe subscription is cancelled. This works any time, no questions asked.</p>
<form id="delete" class="inline-form">
<input id="delete-email" name="email" type="email" required autocomplete="email" placeholder="you@example.com" aria-label="Email to delete">
<button type="submit" class="danger">Delete key &amp; data</button>
<p class="error" id="delete-error" role="alert" hidden></p>
<p class="confirm" id="delete-result" role="status" hidden></p>
</form>
<p class="meta">Lost your key? Delete it here, then create a fresh one from the <a href="/#plans">pricing section</a>.</p>
<script>
document.getElementById("delete").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const errorEl = document.getElementById("delete-error");
  errorEl.hidden = true;
  const button = form.querySelector("button");
  button.disabled = true;
  button.textContent = "Working…";
  try {
    const res = await fetch("/account/delete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: form.email.value }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message ?? "Deletion failed. Please try again.");
    const confirmEl = document.getElementById("delete-result");
    confirmEl.textContent = data.message;
    confirmEl.hidden = false;
    button.textContent = "Deleted";
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
    button.disabled = false;
    button.textContent = "Delete key & data";
  }
});
</script>`,
	);
}

export type SuccessState =
	| { kind: "pending" }
	| { kind: "ready"; sessionId: string }
	| { kind: "revealed"; rawKey: string }
	| { kind: "claimed-before" }
	| { kind: "revoked" };

export function successPage(state: SuccessState): string {
	switch (state.kind) {
		case "pending":
			return page(
				"Confirming payment…",
				`<h1>Almost there</h1>
<p>We're confirming your payment with Stripe. This usually takes a few seconds — <a href="">refresh this page</a>.</p>`,
			);
		case "ready":
			return page(
				"Reveal your API key",
				`<h1>Payment confirmed</h1>
<p>Your API key is ready. It will be shown <strong>only once</strong>, so have your password manager ready.</p>
<form method="post" action="/billing/claim">
  <input type="hidden" name="session_id" value="${escapeHtml(state.sessionId)}">
  <button type="submit">Reveal my API key</button>
</form>`,
			);
		case "revealed":
			return page(
				"Your API key",
				`<h1>Your API key</h1>
<p>Store it now — for your security it is shown <strong>only once</strong> and never emailed:</p>
<pre>${escapeHtml(state.rawKey)}</pre>
<p>Use it as <code>Authorization: Bearer &lt;key&gt;</code>.</p>
<p>A receipt is on its way to your inbox, including how to delete your key and data at any time.</p>`,
			);
		case "claimed-before":
			return page(
				"Key already revealed",
				`<h1>Key already revealed</h1>
<p>This API key has already been shown once and cannot be displayed again. If you lost it, reply to your receipt email and we'll rotate it.</p>`,
			);
		case "revoked":
			return page(
				"Subscription inactive",
				`<h1>Subscription inactive</h1>
<p>This purchase's subscription is no longer active, so no API key can be issued. If you believe this is a mistake, reply to your receipt email.</p>`,
			);
	}
}
