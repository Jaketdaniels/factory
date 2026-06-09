/** Server-rendered pages. Plain HTML, no client framework — probes replace these. */

const PRODUCT_NAME = "probe-template";

function page(title: string, body: string): string {
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
:root { color-scheme: light dark; }
body { font-family: system-ui, sans-serif; max-width: 42rem; margin: 3rem auto; padding: 0 1rem; line-height: 1.6; }
code, pre { background: rgba(127, 127, 127, 0.15); border-radius: 4px; padding: 0.1rem 0.3rem; }
pre { padding: 0.75rem; overflow-x: auto; }
button { font: inherit; padding: 0.5rem 1rem; cursor: pointer; }
.error { color: #b91c1c; }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

export function landingPage(): string {
	return page(
		PRODUCT_NAME,
		`<h1>${PRODUCT_NAME}</h1>
<p>Replace this landing page with the probe's actual pitch: what it does, who it is for, and the one action to take.</p>
<h2>Try the API</h2>
<pre>curl -X POST -H "Authorization: Bearer &lt;your-key&gt;" -H "Content-Type: application/json" \\
  -d '{"message":"hello"}' https://&lt;your-domain&gt;/v1/echo</pre>
<h2>Get a key</h2>
<form id="checkout">
  <label for="email">Email</label>
  <input id="email" name="email" type="email" required autocomplete="email">
  <button type="submit">Subscribe</button>
  <p class="error" id="checkout-error" role="alert" hidden></p>
</form>
<script>
document.getElementById("checkout").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById("checkout-error");
  errorEl.hidden = true;
  const button = e.target.querySelector("button");
  button.disabled = true;
  button.textContent = "Redirecting…";
  try {
    const res = await fetch("/billing/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: e.target.email.value }),
    });
    const data = await res.json();
    if (!res.ok || !data.url) throw new Error(data.error?.message ?? "Checkout failed");
    location.href = data.url;
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
    button.disabled = false;
    button.textContent = "Subscribe";
  }
});
</script>`,
	);
}

export function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
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
