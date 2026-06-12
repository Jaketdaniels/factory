/** Server-rendered pages for recalls.netm8.com — netm8 design system. */
import { brandCss } from "@factory/core";
import type { FeedItemV1 } from "./feed-item";

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
		'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#0b756f"/><path d="M16 8v9M16 21.5v.5" stroke="#d2a44c" stroke-width="3" stroke-linecap="round"/></svg>',
	);

function page(title: string, body: string): string {
	return `<!doctype html>
<html lang="en" data-brand="netm8-feed">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="Changelog of FDA food, drug, and device recalls with severity, status, and provenance — structured for AI agents and compliance software. From openFDA enforcement reports.">
<link rel="icon" href="${FAVICON}">
<title>${escapeHtml(title)}</title>
<style>
${brandCss("netm8-feed")}
* { box-sizing: border-box; }
body { font-family: var(--font-body); background: var(--canvas); color: var(--text); max-width: 44rem; margin: 0 auto; padding: 2.25rem 1.25rem 4rem; line-height: 1.65; }
.site { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin-bottom: 2.75rem; }
.wordmark { font-family: var(--font-code); font-weight: 600; font-size: 1.05rem; color: var(--text); text-decoration: none; }
.wordmark span { color: var(--accent); }
h1 { font-size: 2.3rem; line-height: 1.12; letter-spacing: 0; margin: 0 0 1.1rem; text-wrap: balance; }
h2 { font-family: var(--font-code); font-size: 0.8rem; font-weight: 600; letter-spacing: 0; text-transform: uppercase; color: var(--muted); margin: 3.25rem 0 1rem; }
.lede { font-size: 1.05rem; max-width: 60ch; }
a { color: var(--accent); text-underline-offset: 3px; transition: color 0.15s; }
code, pre, .badge, .datum { font-family: var(--font-code); }
.datum { color: var(--datum); font-variant-numeric: tabular-nums; }
code { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-control); padding: 0.1rem 0.35rem; font-size: 0.85em; }
pre { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 1rem; overflow-x: auto; line-height: 1.55; font-size: 0.82rem; }
.badge { display: inline-block; font-size: 0.72rem; border: 1px solid var(--border); border-radius: 4px; padding: 0.05rem 0.4rem; color: var(--muted); white-space: nowrap; }
.badge.critical { color: var(--badge-alert); border-color: color-mix(in srgb, var(--badge-alert) 50%, transparent); }
.badge.major { color: var(--accent); border-color: color-mix(in srgb, var(--accent) 40%, transparent); }
.doc { padding: 0.85rem 0; border-top: 1px solid var(--border); }
.doc:last-of-type { border-bottom: 1px solid var(--border); }
.doc .title { color: var(--text); }
.doc:hover .title { color: var(--accent); }
.meta { font-size: 0.8rem; color: var(--muted); margin-top: 0.35rem; display: flex; flex-wrap: wrap; gap: 0.45rem; align-items: baseline; }
input { font: inherit; background: var(--canvas); color: var(--text); border: 1px solid var(--border); border-radius: var(--radius-control); padding: 0.5rem 0.65rem; transition: border-color 0.15s; }
input:focus { border-color: var(--accent); outline: none; }
button { font: inherit; font-weight: 600; background: var(--accent); color: var(--accent-contrast); border: none; border-radius: var(--radius-control); padding: 0.5rem 0.95rem; cursor: pointer; transition: filter 0.15s; }
button:hover { filter: brightness(1.1); }
button:disabled { opacity: 0.55; cursor: default; }
.pricing-flow { border: 1px solid var(--border); border-radius: 8px; overflow: hidden; background: var(--surface); }
.pricing-tabs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border-bottom: 1px solid var(--border); }
.pricing-tabs [role="tab"] { color: var(--muted); background: transparent; border: 0; border-right: 1px solid var(--border); border-radius: 0; padding: 0.72rem 0.55rem; }
.pricing-tabs [role="tab"]:last-child { border-right: 0; }
.pricing-tabs [aria-selected="true"] { color: var(--text); box-shadow: inset 0 -2px 0 var(--accent); }
.pricing-panel { padding: 1rem 1.1rem; }
.pricing-panel[hidden] { display: none; }
.pricing-price { margin: 0 0 0.35rem; font-weight: 700; }
.pricing-detail { margin: 0; color: var(--muted); font-size: 0.9rem; }
.checkout-step { display: flex; gap: 0.5rem; flex-wrap: wrap; padding: 1rem 1.1rem; border-top: 1px solid var(--border); }
.checkout-step label { width: 100%; color: var(--text); font-weight: 700; }
.checkout-note { width: 100%; margin: 0.25rem 0 0; color: var(--muted); font-size: 0.86rem; }
.error { color: var(--badge-alert); font-size: 0.88rem; }
footer { margin-top: 4rem; padding-top: 1.4rem; border-top: 1px solid var(--border); font-size: 0.84rem; color: var(--muted); }
.imprint { font-family: var(--font-code); font-size: 0.76rem; }
@media (max-width: 560px) {
	.pricing-tabs { grid-template-columns: 1fr; }
	.pricing-tabs [role="tab"] { border-right: 0; border-bottom: 1px solid var(--border); }
	.pricing-tabs [role="tab"]:last-child { border-bottom: 0; }
}
</style>
</head>
<body>
<header class="site">
<a class="wordmark" href="/">recalls<span>.netm8</span></a>
</header>
${body}
<footer>
<p>Source: FDA enforcement reports via openFDA (US federal work, public domain). Not medical or legal advice — verify against the cited source before compliance use.</p>
<p class="imprint">a <a href="https://netm8.com">netm8</a> feed · records follow the <a href="https://netm8.com/standards">FeedItemV1 contract</a></p>
</footer>
</body>
</html>`;
}

function recallRow(item: FeedItemV1): string {
	const severity = item.change_tracking?.change_severity ?? "major";
	return `<article class="doc">
<span class="title">${escapeHtml(item.summary.title)}</span>
<div class="meta">
<span class="datum">${escapeHtml(item.dates.published_at.slice(0, 10))}</span>
<span class="badge ${escapeHtml(severity)}">${escapeHtml(item.classification.subtype ?? "")}</span>
<span class="badge">${escapeHtml(item.status.state)}</span>
<span>${escapeHtml(item.summary.short_summary ?? "")}</span>
<a href="${escapeHtml(item.provenance.primary_source_url)}" rel="noopener">source</a>
</div>
</article>`;
}

export function landingPage(items: FeedItemV1[]): string {
	const rows =
		items.length === 0 ? "<p>No recalls ingested yet — first cron run pending.</p>" : items.map(recallRow).join("\n");
	return page(
		"FDA recall changelog — recalls.netm8",
		`<h1>Every FDA recall, as a structured change event.</h1>
<p class="lede">Food, drug, and device enforcement reports from openFDA, normalized into change events with severity, lifecycle status, dates, and provenance — checked four times daily, built for AI agents and compliance software.</p>

<h2>Latest recalls</h2>
${rows}

<h2>Machine access</h2>
<pre>curl https://recalls.netm8.com/feed.xml        # RSS, free
curl https://recalls.netm8.com/llms.txt        # agent index, free

# structured change events (API key):
curl -H "Authorization: Bearer &lt;key&gt;" \\
  "https://recalls.netm8.com/v1/changes?category=fda_recall_food&limit=50"</pre>
<p class="meta">Records follow the published <a href="https://netm8.com/standards">FeedItemV1 contract</a>: same shape as every netm8 feed.</p>

<h2>Get a key</h2>
<section class="pricing-flow" aria-labelledby="pricing-title">
<h3 id="pricing-title" style="position:absolute;left:-9999px">Pricing plans</h3>
<div class="pricing-tabs" role="tablist" aria-label="Pricing plans">
<button type="button" role="tab" id="plan-tab-payg" aria-selected="true" aria-controls="plan-panel-payg" data-plan="payg">Pay as you go</button>
<button type="button" role="tab" id="plan-tab-fixed-monthly" aria-selected="false" aria-controls="plan-panel-fixed-monthly" data-plan="fixed_monthly" tabindex="-1">Fixed rate - monthly</button>
<button type="button" role="tab" id="plan-tab-fixed-annual" aria-selected="false" aria-controls="plan-panel-fixed-annual" data-plan="fixed_annual" tabindex="-1">Fixed rate - annual</button>
</div>
<div class="pricing-panel" role="tabpanel" id="plan-panel-payg" aria-labelledby="plan-tab-payg" data-cta="Start free">
<p class="pricing-price">Free during launch; then US$0.10 per API call</p>
<p class="pricing-detail">Your first 30 calls are covered by signup credit after billing is enabled. Best for occasional recall checks and agent experiments.</p>
</div>
<div class="pricing-panel" role="tabpanel" id="plan-panel-fixed-monthly" aria-labelledby="plan-tab-fixed-monthly" data-cta="Start monthly" hidden>
<p class="pricing-price">Fixed rate - monthly</p>
<p class="pricing-detail">500 API calls included every month, then usage overage at US$0.10 per call. Built for scheduled compliance pulls.</p>
</div>
<div class="pricing-panel" role="tabpanel" id="plan-panel-fixed-annual" aria-labelledby="plan-tab-fixed-annual" data-cta="Start annual" hidden>
<p class="pricing-price">Fixed rate - annual</p>
<p class="pricing-detail">7,500 API calls included for the year at a better effective rate. Built for teams embedding recall monitoring.</p>
</div>
<form id="checkout" class="checkout-step">
<input type="hidden" name="plan" value="payg">
<label for="email">Step 2: where should the key receipt go?</label>
<input id="email" name="email" type="email" required autocomplete="email" placeholder="you@example.com" aria-label="Email for selected plan">
<button type="submit">Start free</button>
<p class="checkout-note">Launch access is free while Stripe billing is verified. The same flow switches to Checkout when billing mode is paid.</p>
<p class="error" id="checkout-error" role="alert" hidden></p>
</form>
</section>
<script>
const form = document.getElementById("checkout");
const errorEl = document.getElementById("checkout-error");
const button = form.querySelector("button");
const pricingTabs = Array.from(document.querySelectorAll('.pricing-tabs [role="tab"]'));
function selectPricingTab(tab) {
	for (const current of pricingTabs) {
		const selected = current === tab;
		current.setAttribute("aria-selected", String(selected));
		current.tabIndex = selected ? 0 : -1;
		document.getElementById(current.getAttribute("aria-controls")).hidden = !selected;
	}
	const panel = document.getElementById(tab.getAttribute("aria-controls"));
	form.plan.value = tab.dataset.plan;
	button.textContent = panel.dataset.cta;
	tab.focus();
}
pricingTabs.forEach((tab, index) => {
	tab.addEventListener("click", () => selectPricingTab(tab));
	tab.addEventListener("keydown", (event) => {
		if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
		event.preventDefault();
		const offset = event.key === "ArrowRight" ? 1 : pricingTabs.length - 1;
		selectPricingTab(pricingTabs[(index + offset) % pricingTabs.length]);
	});
});
form.addEventListener("submit", async (event) => {
	event.preventDefault();
	errorEl.hidden = true;
	const originalText = button.textContent;
	button.disabled = true;
	button.textContent = "Working...";
	try {
		const res = await fetch("/billing/checkout", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ email: form.email.value, plan: form.plan.value }),
		});
		const data = await res.json();
		if (!res.ok) throw new Error(data.error?.message ?? "Checkout failed.");
		window.location.href = data.url;
	} catch (err) {
		errorEl.textContent = err.message;
		errorEl.hidden = false;
		button.disabled = false;
		button.textContent = originalText;
	}
});
</script>`,
	);
}

export type SuccessView =
	| { kind: "pending" }
	| { kind: "ready"; sessionId: string }
	| { kind: "revealed"; rawKey: string }
	| { kind: "claimed-before" }
	| { kind: "revoked" };

export function successPage(view: SuccessView): string {
	switch (view.kind) {
		case "pending":
			return page(
				"Almost there",
				"<h1>Payment received</h1><p>We're confirming your payment and provisioning your key. Refresh in a few seconds.</p>",
			);
		case "ready":
			return page(
				"Reveal your key",
				`<h1>Your key is ready</h1>
<p>It will be shown exactly once.</p>
<form method="post" action="/billing/claim">
<input type="hidden" name="session_id" value="${escapeHtml(view.sessionId)}">
<button type="submit">Reveal my API key</button>
</form>`,
			);
		case "revealed":
			return page(
				"Your API key",
				`<h1>Save this key now</h1>
<p>It is shown only once:</p>
<pre>${escapeHtml(view.rawKey)}</pre>
<p><a href="/">Back to the changelog</a></p>`,
			);
		case "claimed-before":
			return page(
				"Already claimed",
				"<h1>This key has already been shown</h1><p>If that wasn't you, reply to your receipt email immediately.</p>",
			);
		case "revoked":
			return page(
				"Subscription ended",
				"<h1>This subscription is no longer active</h1><p>Start a new checkout from the <a href='/'>changelog</a> for a fresh key.</p>",
			);
	}
}
