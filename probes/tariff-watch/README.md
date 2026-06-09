# tariff-watch

**Live:** https://tariff-watch.jaketdaniels95.workers.dev — daily facts-only
changelog of US tariff/customs/trade actions from the Federal Register (public
domain), served as HTML, immutable Markdown snapshots, and a metered JSON API.

Surfaces: `/` (SEO landing) · `/llms.txt` · `/snapshot/latest.md` ·
`/snapshot/YYYY-MM-DD.md` · `POST /v1/keys` (free key) · `GET /v1/changes`
(metered) · `POST /admin/ingest` (ADMIN_TOKEN) · cron `0 14 * * *` UTC.

Stripe billing routes exist but are dormant until STRIPE_SECRET_KEY /
STRIPE_WEBHOOK_SECRET are set and a Price is created (do this when the free
tier shows demand).

## KILL CRITERIA (fill in BEFORE deploying — non-negotiable)

> A probe without pre-committed kill criteria is a zombie, not an experiment.

- **Hypothesis:** Developers building commerce/logistics agents — and tooling vendors serving small importers — will pay for a dated, immutable, machine-readable changelog of US tariff/customs state (Section 232/301 actions, de-minimis rules, Federal Register notices), because the post-2026 regime changes weekly, models answer it stale, and the sources are public-domain (.gov) so the data is legally clean. Discovered via transactional SEO ("what changed in US tariffs this week", "is de minimis back") and MCP registry listings.
- **Success signal by day 30 of launch:** ≥200 organic landing visits/week OR ≥5 free API keys created OR ≥1 paid key.
- **Kill date:** **2026-07-25** (deployed 2026-06-10). If the signal is not met, archive the probe and write a 5-line post-mortem below.
- **Post-mortem:** _(empty until killed or graduated)_

## What's included

- `GET /` landing page (replace with the probe's pitch) with self-hosted analytics
- `POST /v1/echo` example metered endpoint — API-key auth, monthly quota, 429s, usage events
  (validators run before metering, so rejected requests are never billed)
- `POST /billing/checkout` Stripe Checkout (subscription mode) → `GET /billing/success`
  → explicit `POST /billing/claim` one-time key reveal (atomic claim; the raw key is
  never stored — it is minted at claim time and rendered straight from memory)
- `POST /webhooks/stripe` signature-verified, idempotent reservation + revocation,
  safe against out-of-order delivery (deletion tombstones unclaimed reservations)
- `scheduled` stub for daily cron work (snapshots, digests)
- D1 migrations, vitest-pool-workers integration tests, typed end-to-end (`AppType` exported for Hono RPC)

## Before going live

- Add a Cloudflare WAF rate-limiting rule for `POST /billing/checkout` (and
  consider Turnstile on the landing form): it is unauthenticated and each call
  creates a Stripe Checkout Session.
- Note: `session_id` appears in the `/billing/success` URL (Stripe injects it),
  so it lands in Workers Logs. The key reveal itself requires the POST claim,
  and log access is privileged — accepted residual risk; revisit if your threat
  model includes log readers.

## Setup

```sh
# 1. Create the database and paste its id into wrangler.jsonc
wrangler d1 create <probe-name>
npm run migrate:local        # and migrate:remote before deploy

# 2. Secrets (local: copy .dev.vars.example → .dev.vars)
wrangler secret put STRIPE_SECRET_KEY      # use a restricted rk_ key
wrangler secret put STRIPE_WEBHOOK_SECRET

# 3. Stripe dashboard: create a Product + recurring Price, paste the price id
#    into wrangler.jsonc vars.STRIPE_PRICE_ID; add a webhook endpoint for
#    https://<worker-url>/webhooks/stripe with events:
#    checkout.session.completed, customer.subscription.deleted

# 4. Develop / verify / ship
npm run dev
npm run typecheck && npm test && npm run dry-run
npm run deploy
```

## Reading the dials

Usage and funnel live in D1 — no third-party analytics:

```sh
wrangler d1 execute <probe-name> --remote --command \
  "SELECT name, COUNT(*) n FROM analytics_events WHERE created_at >= datetime('now','-30 days') GROUP BY name ORDER BY n DESC"
wrangler d1 execute <probe-name> --remote --command \
  "SELECT k.key_hint, k.plan, COUNT(u.id) calls FROM api_keys k LEFT JOIN usage_events u ON u.key_id = k.id GROUP BY k.id"
```
