# probe-template

A factory probe: a small, self-serve, metered product on Cloudflare Workers.
Stamped from `templates/probe` by `npm run new-probe -- <name>`.

## KILL CRITERIA (fill in BEFORE deploying — non-negotiable)

> A probe without pre-committed kill criteria is a zombie, not an experiment.

- **Hypothesis:** _who pays, for what, found how?_
- **Success signal by day 30:** _e.g. ≥200 organic landing visits/week OR ≥1 paid key_
- **Kill date:** _YYYY-MM-DD_ — if the signal is not met, archive the probe and write a 5-line post-mortem below.
- **Post-mortem:** _(empty until killed or graduated)_

## What's included

- `GET /` landing page (replace with the probe's pitch) with self-hosted analytics
- `POST /v1/echo` example metered endpoint — API-key auth, monthly quota, 429s, usage events
  (validators run before metering, so rejected requests are never billed)
- Shared pricing flow: `Pay as you go`, `Fixed rate - monthly`, and
  `Fixed rate - annual`. With `BILLING_MODE=free_launch`, `POST
  /billing/checkout` creates a local reservation and returns `GET
  /billing/success`; with `BILLING_MODE=paid`, it creates a Stripe Checkout
  Session. `POST /billing/claim` reveals the key once.
- `POST /webhooks/stripe` signature-verified, idempotent reservation + revocation,
  safe against out-of-order delivery (deletion tombstones unclaimed reservations)
- `scheduled` stub for daily cron work (snapshots, digests)
- D1 migrations, vitest-pool-workers integration tests, typed end-to-end (`AppType` exported for Hono RPC)

## Before going live

- Add a Cloudflare WAF rate-limiting rule for `POST /billing/checkout` (and
  consider Turnstile on the landing form): it is unauthenticated. In
  `free_launch` it creates local reservations; in `paid` it creates Stripe
  Checkout Sessions.
- Note: `session_id` appears in the `/billing/success` URL. The key reveal
  itself requires the POST claim, and log access is privileged. Revisit if
  your threat model includes log readers.

## Setup

```sh
# 1. Create the database and paste its id into wrangler.jsonc
wrangler d1 create <probe-name>
npm run migrate:local        # and migrate:remote before deploy

# 2. Secrets (local: copy .dev.vars.example → .dev.vars)
wrangler secret put STRIPE_SECRET_KEY      # use a restricted rk_ key
wrangler secret put STRIPE_WEBHOOK_SECRET

# 3. Stripe dashboard, before switching BILLING_MODE to paid:
#    create metered Pay as you go, fixed monthly, and fixed annual prices.
#    Paste their ids into the STRIPE_* vars in wrangler.jsonc; add a webhook
#    endpoint for https://<worker-url>/webhooks/stripe with events:
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
