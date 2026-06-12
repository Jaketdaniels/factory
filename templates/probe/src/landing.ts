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
button, input { font: inherit; }
button { padding: 0.5rem 1rem; cursor: pointer; transition: opacity 0.15s; }
button:disabled { cursor: default; opacity: 0.6; }
input { padding: 0.48rem 0.6rem; min-width: 0; transition: border-color 0.15s; }
input:focus { border-color: var(--accent, currentColor); outline: none; }
.pricing-flow { border: 1px solid rgba(127, 127, 127, 0.25); border-radius: 8px; overflow: hidden; }
.pricing-tabs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border-bottom: 1px solid rgba(127, 127, 127, 0.25); }
.pricing-tabs [role="tab"] { border: 0; border-right: 1px solid rgba(127, 127, 127, 0.2); background: transparent; padding: 0.75rem 0.5rem; }
.pricing-tabs [role="tab"]:last-child { border-right: 0; }
.pricing-tabs [aria-selected="true"] { background: rgba(127, 127, 127, 0.15); font-weight: 700; }
.pricing-panel { padding: 1rem; }
.pricing-panel[hidden] { display: none; }
.pricing-price { margin: 0 0 0.35rem; font-weight: 700; }
.pricing-detail { margin: 0; color: color-mix(in srgb, currentColor 72%, transparent); }
.checkout-step { display: flex; gap: 0.5rem; flex-wrap: wrap; padding: 1rem; border-top: 1px solid rgba(127, 127, 127, 0.25); }
.checkout-step label { width: 100%; font-weight: 700; }
.checkout-note { width: 100%; margin: 0.25rem 0 0; font-size: 0.9rem; }
.error { color: #b91c1c; }
@media (max-width: 520px) {
  .pricing-tabs { grid-template-columns: 1fr; }
  .pricing-tabs [role="tab"] { border-right: 0; border-bottom: 1px solid rgba(127, 127, 127, 0.2); }
  .pricing-tabs [role="tab"]:last-child { border-bottom: 0; }
}
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
<section class="pricing-flow" aria-labelledby="pricing-title">
  <h3 id="pricing-title" style="position:absolute;left:-9999px">Pricing plans</h3>
  <div class="pricing-tabs" role="tablist" aria-label="Pricing plans">
    <button type="button" role="tab" id="plan-tab-payg" aria-selected="true" aria-controls="plan-panel-payg" data-plan="payg">Pay as you go</button>
    <button type="button" role="tab" id="plan-tab-fixed-monthly" aria-selected="false" aria-controls="plan-panel-fixed-monthly" data-plan="fixed_monthly" tabindex="-1">Fixed rate - monthly</button>
    <button type="button" role="tab" id="plan-tab-fixed-annual" aria-selected="false" aria-controls="plan-panel-fixed-annual" data-plan="fixed_annual" tabindex="-1">Fixed rate - annual</button>
  </div>
  <div class="pricing-panel" role="tabpanel" id="plan-panel-payg" aria-labelledby="plan-tab-payg" data-cta="Start free">
    <p class="pricing-price">Free during launch; then US$0.10 per API call</p>
    <p class="pricing-detail">Your first 30 calls are covered by signup credit after billing is enabled. Best for testing or occasional automation.</p>
  </div>
  <div class="pricing-panel" role="tabpanel" id="plan-panel-fixed-monthly" aria-labelledby="plan-tab-fixed-monthly" data-cta="Start monthly" hidden>
    <p class="pricing-price">Fixed rate - monthly</p>
    <p class="pricing-detail">500 API calls included every month, then usage overage at US$0.10 per call. Built for recurring workflows.</p>
  </div>
  <div class="pricing-panel" role="tabpanel" id="plan-panel-fixed-annual" aria-labelledby="plan-tab-fixed-annual" data-cta="Start annual" hidden>
    <p class="pricing-price">Fixed rate - annual</p>
    <p class="pricing-detail">7,500 API calls included for the year at a better effective rate. Built for teams that already know the feed is staying.</p>
  </div>
  <form id="checkout" class="checkout-step">
    <input type="hidden" name="plan" value="payg">
    <label for="email">Step 2: where should the key receipt go?</label>
    <input id="email" name="email" type="email" required autocomplete="email" aria-label="Email for selected plan" placeholder="you@example.com">
    <button type="submit">Start free</button>
    <p class="checkout-note">Launch access is free while Stripe billing is verified. The same flow switches to Checkout when billing mode is paid.</p>
    <p class="error" id="checkout-error" role="alert" hidden></p>
  </form>
</section>
<script>
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
pricingTabs.forEach((tab, index) => {
  tab.addEventListener("click", () => selectPricingTab(tab));
  tab.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const offset = event.key === "ArrowRight" ? 1 : pricingTabs.length - 1;
    selectPricingTab(pricingTabs[(index + offset) % pricingTabs.length]);
  });
});
checkoutForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById("checkout-error");
  errorEl.hidden = true;
  const button = checkoutButton;
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "Working...";
  try {
    const res = await fetch("/billing/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: checkoutForm.email.value, plan: checkoutForm.plan.value }),
    });
    const data = await res.json();
    if (!res.ok || !data.url) throw new Error(data.error?.message ?? "Checkout failed");
    location.href = data.url;
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
