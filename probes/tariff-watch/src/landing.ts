/** Server-rendered pages for tariff-watch. Plain HTML, no client framework. */

export function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

function page(title: string, body: string): string {
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="Daily facts-only changelog of US tariff, customs and trade-action changes — USTR, CBP, ITA, ITC, BIS and presidential tariff documents — as token-efficient Markdown and a JSON API for AI agents.">
<title>${title}</title>
<style>
:root { color-scheme: light dark; }
body { font-family: system-ui, sans-serif; max-width: 46rem; margin: 3rem auto; padding: 0 1rem; line-height: 1.6; }
code, pre { background: rgba(127, 127, 127, 0.15); border-radius: 4px; padding: 0.1rem 0.3rem; }
pre { padding: 0.75rem; overflow-x: auto; }
button { font: inherit; padding: 0.5rem 1rem; cursor: pointer; }
input { font: inherit; padding: 0.4rem; }
.error { color: #b91c1c; }
.doc { margin-bottom: 0.75rem; }
.meta { font-size: 0.85rem; opacity: 0.75; }
footer { margin-top: 3rem; font-size: 0.85rem; opacity: 0.75; }
</style>
</head>
<body>
${body}
<footer>
<p>Source: <a href="https://www.federalregister.gov/">Federal Register</a> (US government work, public domain). tariff-watch publishes its own factual summaries with links to every primary document — no third-party text is reproduced.</p>
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

export function landingPage(latestDocs: LandingDoc[], latestSnapshotDate: string | null, freeQuota: number): string {
	const docList =
		latestDocs.length === 0
			? `<p class="meta">No documents ingested yet — the first daily snapshot is on its way.</p>`
			: latestDocs
					.map((d) => {
						const dates = [
							d.effectiveOn === null ? null : `effective ${escapeHtml(d.effectiveOn)}`,
							d.commentsCloseOn === null ? null : `comments due ${escapeHtml(d.commentsCloseOn)}`,
							d.hearingOn === null ? null : `hearing ${escapeHtml(d.hearingOn)}`,
						]
							.filter((value): value is string => value !== null)
							.join(" · ");
						const dateLine = dates.length > 0 ? `<div class="meta">${dates}</div>` : "";
						return `<div class="doc">
<strong>[${escapeHtml(d.docType)}]</strong> <a href="${escapeHtml(d.url)}" rel="noopener">${escapeHtml(d.title)}</a>
<div class="meta">${escapeHtml(d.publicationDate)} · ${escapeHtml(d.program)} · ${escapeHtml(d.legalStatus)}${d.agencies.length > 0 ? ` · ${escapeHtml(d.agencies.join(", "))}` : ""}</div>
${dateLine}
</div>`;
					})
					.join("\n");

	const snapshotLink =
		latestSnapshotDate === null
			? ""
			: `<p>Latest snapshot: <a href="/snapshot/latest.md"><code>/snapshot/latest.md</code></a> (${escapeHtml(latestSnapshotDate)}) — token-efficient Markdown for LLMs and agents. Index: <a href="/llms.txt"><code>/llms.txt</code></a>. Feeds: <a href="/feed.xml"><code>/feed.xml</code></a>, <a href="/calendar.ics"><code>/calendar.ics</code></a>, <code>POST /mcp</code>.</p>`;

	return page(
		"tariff-watch — daily US tariff & trade-action changelog",
		`<h1>What changed in US tariffs — today</h1>
<p>US trade policy now changes weekly: Section 232/301 actions, de-minimis rules, exclusion lists, antidumping orders, and forced-labor trade actions. Language models answer with stale data; reading the Federal Register yourself takes hours. <strong>tariff-watch</strong> publishes a source-first trade-action evidence layer with legal status, effective dates, primary-source links, immutable Markdown snapshots, RSS, calendar output, MCP, and a JSON API built for agents.</p>
${snapshotLink}
<h2>Latest trade actions</h2>
${docList}
<h2>API</h2>
<pre># Free Markdown for agents
curl https://&lt;this-domain&gt;/snapshot/latest.md
curl https://&lt;this-domain&gt;/feed.xml
curl https://&lt;this-domain&gt;/calendar.ics

# Structured JSON (free key, ${freeQuota} requests/month)
curl -X POST -H "Content-Type: application/json" -d '{"email":"you@example.com"}' https://&lt;this-domain&gt;/v1/keys
curl -H "Authorization: Bearer &lt;your-key&gt;" "https://&lt;this-domain&gt;/v1/changes?since=2026-06-01"</pre>
<form id="freekey">
  <label for="email">Get a free API key:</label>
  <input id="email" name="email" type="email" required autocomplete="email" placeholder="you@example.com">
  <button type="submit">Create key</button>
  <p class="error" id="freekey-error" role="alert" hidden></p>
  <pre id="freekey-result" hidden></pre>
</form>
<script>
document.getElementById("freekey").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById("freekey-error");
  const resultEl = document.getElementById("freekey-result");
  errorEl.hidden = true;
  const button = e.target.querySelector("button");
  button.disabled = true;
  button.textContent = "Creating…";
  try {
    const res = await fetch("/v1/keys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: e.target.email.value }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message ?? "Key creation failed");
    resultEl.textContent = "Your key (shown once, store it now):\\n" + data.key;
    resultEl.hidden = false;
    button.textContent = "Done";
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
    button.disabled = false;
    button.textContent = "Create key";
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
