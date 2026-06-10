/** Server-rendered pages for tariff-watch. Plain HTML, no client framework. */

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
		'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#16140f"/><path d="M7 11h18M7 16h13M7 21h16" stroke="#d2a44c" stroke-width="2.6" stroke-linecap="round"/></svg>',
	);

function page(title: string, body: string): string {
	return `<!doctype html>
<html lang="en">
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
:root {
	color-scheme: dark;
	--bg: #131210; --surface: #1b1916; --border: #2c2822;
	--text: #eae6de; --muted: #a59c8d; --accent: #d2a44c;
	--good: #8fb284; --bad: #c4806f;
	--mono: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace;
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; background: var(--bg); color: var(--text); max-width: 44rem; margin: 0 auto; padding: 2.25rem 1.25rem 4rem; line-height: 1.65; }
.site { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin-bottom: 2.75rem; }
.wordmark { font-family: var(--mono); font-weight: 600; font-size: 1.05rem; color: var(--text); text-decoration: none; }
.wordmark span { color: var(--accent); }
.site nav { display: flex; gap: 1.1rem; flex-wrap: wrap; }
.site nav a { color: var(--muted); text-decoration: none; font-size: 0.85rem; }
.site nav a:hover { color: var(--text); }
h1 { font-size: clamp(1.8rem, 5vw, 2.3rem); line-height: 1.12; letter-spacing: -0.02em; margin: 0 0 1.1rem; text-wrap: balance; }
h2 { font-family: var(--mono); font-size: 0.8rem; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); margin: 3.25rem 0 1rem; }
.lede { font-size: 1.05rem; max-width: 60ch; }
a { color: var(--accent); text-underline-offset: 3px; transition: color 0.15s ease; }
a:hover { color: #e5c078; }
code, pre, .datum, .badge { font-family: var(--mono); }
code { background: var(--surface); border: 1px solid var(--border); border-radius: 4px; padding: 0.1rem 0.35rem; font-size: 0.85em; }
pre { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 1rem; overflow-x: auto; line-height: 1.55; font-size: 0.82rem; }
.datum { font-variant-numeric: tabular-nums; }
.badge { display: inline-block; font-size: 0.72rem; border: 1px solid var(--border); border-radius: 4px; padding: 0.05rem 0.4rem; color: var(--muted); white-space: nowrap; }
.badge.proposed { color: var(--accent); border-color: rgba(210, 164, 76, 0.4); }
.badge.effective { color: var(--good); border-color: rgba(143, 178, 132, 0.4); }
.badge.stayed, .badge.enjoined, .badge.expired { color: var(--bad); border-color: rgba(196, 128, 111, 0.4); }
.deadline { display: flex; gap: 1rem; align-items: baseline; padding: 0.55rem 0; border-top: 1px solid var(--border); font-size: 0.92rem; }
.deadline:last-of-type { border-bottom: 1px solid var(--border); }
.deadline .datum { color: var(--accent); flex: none; }
.deadline .kind { color: var(--muted); flex: none; font-size: 0.82rem; }
.deadline a { color: var(--text); text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.deadline a:hover { color: var(--accent); }
.doc { padding: 0.85rem 0; border-top: 1px solid var(--border); }
.doc:last-of-type { border-bottom: 1px solid var(--border); }
.doc > a { color: var(--text); text-decoration: none; }
.doc > a:hover { color: var(--accent); }
.meta { font-size: 0.8rem; color: var(--muted); margin-top: 0.35rem; display: flex; flex-wrap: wrap; gap: 0.45rem; align-items: baseline; }
.plans { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.plan { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 1.25rem; display: flex; flex-direction: column; gap: 0.65rem; }
.plan.pro { border-color: rgba(210, 164, 76, 0.55); }
.plan h3 { margin: 0; font-size: 1rem; }
.plan .price { font-family: var(--mono); font-size: 1.25rem; margin: 0; }
.plan .price small { font-size: 0.8rem; color: var(--muted); }
.plan ul { margin: 0; padding-left: 1.1rem; color: var(--muted); font-size: 0.88rem; }
.plan form { margin-top: auto; display: flex; gap: 0.5rem; flex-wrap: wrap; }
.faq { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem 2rem; }
.faq h3 { font-size: 0.95rem; margin: 0 0 0.35rem; }
.faq p { margin: 0; font-size: 0.88rem; color: var(--muted); }
input { font: inherit; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 6px; padding: 0.5rem 0.65rem; flex: 1; min-width: 0; }
button { font: inherit; font-weight: 600; background: var(--accent); color: #1b1607; border: none; border-radius: 6px; padding: 0.5rem 0.95rem; cursor: pointer; transition: filter 0.15s ease, transform 0.1s ease; }
button:hover { filter: brightness(1.1); }
button:active { transform: translateY(1px); }
button:disabled { opacity: 0.55; cursor: default; }
input:focus-visible, button:focus-visible, a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.error { color: var(--bad); font-size: 0.88rem; width: 100%; margin: 0.25rem 0 0; }
.result { width: 100%; margin: 0.5rem 0 0; }
footer { margin-top: 4rem; padding-top: 1.4rem; border-top: 1px solid var(--border); font-size: 0.84rem; color: var(--muted); }
footer p { margin: 0 0 0.5rem; }
.imprint { font-family: var(--mono); font-size: 0.76rem; }
@media (max-width: 640px) {
	.plans, .faq { grid-template-columns: 1fr; }
	.deadline a { white-space: normal; }
}
@media (prefers-reduced-motion: reduce) {
	* { transition: none !important; }
	html { scroll-behavior: auto; }
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
<p class="imprint">a netm8 feed · facts only, primary sources, immutable snapshots</p>
</footer>
</body>
</html>`;
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
	const { docs, latestSnapshotDate, freeQuota, baseUrl, upcoming } = input;

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
<span class="badge">${escapeHtml(d.docType)}</span>
${statusBadge(d.legalStatus)}
<span>${escapeHtml(programLabel(d.program))}</span>
${d.agencies.length > 0 ? `<span>${escapeHtml(d.agencies.join(", "))}</span>` : ""}
${dates.length > 0 ? `<span>${dates.join(" · ")}</span>` : ""}
</div>
</article>`;
					})
					.join("\n");

	const snapshotNote =
		latestSnapshotDate === null
			? ""
			: ` The latest snapshot is <a href="/snapshot/latest.md"><code>/snapshot/latest.md</code></a> (<span class="datum">${escapeHtml(latestSnapshotDate)}</span>).`;

	const safeBase = escapeHtml(baseUrl);

	return page(
		"tariff.watch — daily US tariff & trade-action changelog",
		`<h1>What changed in US tariffs today</h1>
<p class="lede">US trade policy changes weekly: Section 232 and 301 actions, de-minimis rules, exclusion lists, antidumping orders, forced-labor measures. tariff.watch reads every trade-relevant Federal Register document daily and records each change with its legal status, effective date, and a link to the primary source. Humans get this changelog; agents get immutable Markdown snapshots, feeds, and a JSON API.</p>

${deadlineList}

<h2 id="latest">Latest trade actions</h2>
${docList}

<h2 id="agents">Built for AI agents</h2>
<p>Dated snapshots never change once their day has passed, so an agent can cite what was known on a date.${snapshotNote} The MCP endpoint (<code>POST /mcp</code>) exposes <code>tariffs_list_changes</code>, <code>tariffs_effective_dates</code>, and <code>tariffs_get_source</code>.</p>
<pre># Free Markdown for agents
curl ${safeBase}/snapshot/latest.md
curl ${safeBase}/feed.xml
curl ${safeBase}/calendar.ics

# Structured JSON
curl -X POST -H "Content-Type: application/json" -d '{"email":"you@example.com"}' ${safeBase}/v1/keys
curl -H "Authorization: Bearer &lt;your-key&gt;" "${safeBase}/v1/changes?since=2026-06-01"</pre>

<h2 id="plans">Pricing</h2>
<div class="plans">
<section class="plan">
<h3>Free</h3>
<p class="price">A$0 <small>forever</small></p>
<ul>
<li>Changelog, snapshots, RSS, calendar, MCP: no key needed</li>
<li>JSON API: ${freeQuota} requests/month</li>
<li>Key shown once at creation</li>
</ul>
<form id="freekey">
<input id="email" name="email" type="email" required autocomplete="email" placeholder="you@example.com" aria-label="Email for free API key">
<button type="submit">Create key</button>
<p class="error" id="freekey-error" role="alert" hidden></p>
<pre class="result" id="freekey-result" hidden></pre>
</form>
</section>
<section class="plan pro">
<h3>Pro</h3>
<p class="price">A$3 <small>/ month</small></p>
<ul>
<li>10,000 JSON API requests/month</li>
<li>Same data, same endpoints, more headroom</li>
<li>Cancel anytime in Stripe; the key deactivates with the subscription</li>
</ul>
<form id="pro">
<input id="pro-email" name="email" type="email" required autocomplete="email" placeholder="you@example.com" aria-label="Email for Pro checkout">
<button type="submit">Upgrade</button>
<p class="error" id="pro-error" role="alert" hidden></p>
</form>
</section>
</div>

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
wireForm("freekey", "freekey-error", async (form, button) => {
  const res = await fetch("/v1/keys", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: form.email.value }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? "Key creation failed. Please try again.");
  const resultEl = document.getElementById("freekey-result");
  resultEl.textContent = "Your key (shown once, store it now):\\n" + data.key;
  resultEl.hidden = false;
  button.textContent = "Done";
});
wireForm("pro", "pro-error", async (form) => {
  const res = await fetch("/billing/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: form.email.value }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? "Checkout failed. Please try again.");
  window.location.href = data.url;
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
<p>Store it now — for your security it is shown <strong>only once</strong>:</p>
<pre>${escapeHtml(state.rawKey)}</pre>
<p>Use it as <code>Authorization: Bearer &lt;key&gt;</code>.</p>`,
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
