# fda-recalls — recalls.netm8.com

**Live: https://recalls.netm8.com** — every FDA food, drug, and device recall
as a structured change event with severity, lifecycle status, dates, and
provenance. Probe #2 of the netm8 factory (scored 90/100 in
[docs/probe-scoring.md](../../docs/probe-scoring.md)).

Source: openFDA enforcement reports (US federal work, public domain;
official JSON API — tier-1 collection). Polled four times daily
(03/09/15/21:17 UTC). Records follow the published
[FeedItemV1 contract](https://netm8.com/standards/feed-item-v1.schema.json);
raw source responses are archived in R2 keyed by SHA-256
(`provenance.snapshot_hash`). Event identity is recall × lifecycle state, so
a recall moving Ongoing → Terminated records a second event instead of
mutating history.

Free: landing changelog, `/feed.xml` (RSS), `/llms.txt`.
Keyed: `GET /v1/changes?category=fda_recall_food|fda_recall_drug|fda_recall_device`.

Billing: live checkout is in `free_launch` mode while Stripe prices and
secrets are verified. The pricing flow already exposes `Pay as you go`,
`Fixed rate - monthly`, and `Fixed rate - annual`; switching
`BILLING_MODE=paid` reuses the same plan ids with Stripe Checkout.

## KILL CRITERIA (fill in BEFORE deploying — non-negotiable)

> A probe without pre-committed kill criteria is a zombie, not an experiment.

- **Hypothesis:** Food/drug/device importers, QA and compliance teams pay per call for normalized FDA recall change events with provenance, found via MCP registries and recall SEO pages
- **Success signal by day 30:** >=200 organic visits/week OR >=5 keys OR >=1 paying key by day 30
- **Kill date:** 2026-07-31 — if the signal is not met, archive the probe and write a 5-line post-mortem below.
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
