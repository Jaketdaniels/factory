# tariff.watch

**Live: https://tariff.watch** — a source-first evidence layer for US tariff,
customs, and trade-action changes, built for both humans and AI agents.

US trade policy now changes weekly — Section 232/301 actions, de-minimis
rules, exclusion lists, antidumping orders. Language models answer with stale
data, and reading the Federal Register yourself takes hours. tariff.watch
ingests every trade-relevant federal publication daily (USTR, CBP, the
International Trade Administration, the International Trade Commission, the
Bureau of Industry and Security, the Foreign-Trade Zones Board, plus
presidential tariff documents) and publishes:

- a human-readable changelog at [tariff.watch](https://tariff.watch)
- **immutable, dated Markdown snapshots** for LLM/agent grounding
- **RSS and calendar feeds** for source-linked changes and deadlines
- a **minimal MCP surface** for agent tool calls
- a **structured JSON API** with API keys and monthly quotas

Every entry links to its primary federalregister.gov document. No third-party
text is reproduced: US government works are public domain (17 U.S.C. §105),
and all summaries are our own. Rows carry program, legal status, effective
dates, comment deadlines, hearing dates, source identity, and confidence.

## Using it

### Markdown snapshots (free, no key)

```sh
curl https://tariff.watch/snapshot/latest.md     # last 7 days, regenerated daily
curl https://tariff.watch/snapshot/2026-06-09.md # immutable point-in-time snapshot
curl https://tariff.watch/llms.txt               # agent-facing index
curl https://tariff.watch/feed.xml               # RSS
curl https://tariff.watch/calendar.ics           # effective dates, comments, hearings
```

Dated snapshots never change once their day has passed — useful when an agent
needs to prove what was known on a given date.

Free surfaces are rate-limited to ~120 requests/minute per IP (per Cloudflare
location) as an abuse brake; normal browsing, feed readers, and calendar
clients never approach it. Keyed API traffic is governed by billing, not
rate limits.

### JSON API

```sh
# Get a key: choose a plan at https://tariff.watch/#plans.
# Launch access is free while Stripe billing is verified.
# The key is shown once in the browser and never emailed.

# Query structured changes
curl -H "Authorization: Bearer <your-key>" \
  "https://tariff.watch/v1/changes?since=2026-06-01&limit=50"

# Delete your key and its data (also cancels the Stripe subscription)
curl -X POST -H "Content-Type: application/json" \
  -d '{"email":"you@example.com"}' https://tariff.watch/account/delete
```

Response fields: `document_number`, `title`, `type`, `abstract`,
`publication_date`, `agencies[]`, `program`, `legal_status`, `effective_on`,
`comments_close_on`, `hearing_on`, `confidence`, and the primary-source `url`.
Launch API access is free while Stripe billing is verified. After launch, the
pricing flow has three public offers:

- `Pay as you go`: first 30 API calls free via signup credit, then US$0.10
  per call.
- `Fixed rate - monthly`: $29/month, 500 calls/month included, then
  US$0.10/call overage.
- `Fixed rate - annual`: $290/year, 7,500 calls/year included, then
  US$0.10/call overage.

### Watchlists + fixed-rate plans

Fixed-rate keys include watchlist alerts. Use
`{"email":"...","plan":"fixed_monthly"}` or
`{"email":"...","plan":"fixed_annual"}` when `BILLING_MODE=paid`.
Watchlists are keyed and never billed:

```sh
curl -X POST -H "Authorization: Bearer <key>" -H "Content-Type: application/json" \
  -d '{"kind":"program","value":"section_232","webhook_url":"https://yours.example/hook"}' \
  https://tariff.watch/v1/watchlists
```

Alerts arrive by email and an HMAC-signed webhook (`tariff-watch-signature`,
Stripe-style `t=...,v1=...` over `${t}.${body}`; the signing secret is
returned once at creation).

### MCP

`POST /mcp` exposes a minimal stateless JSON-RPC MCP surface:

- `tariffs_list_changes`
- `tariffs_effective_dates`
- `tariffs_get_source`

## How it works

A Cloudflare Worker (Hono + D1) polling four times daily (02/08/14/20 UTC,
bracketing the Federal Register's morning publication):

1. **Ingest** — query the [Federal Register API](https://www.federalregister.gov/developers/documentation/api/v1)
   for the trade agencies + presidential tariff documents (3-day look-back so
   missed runs self-heal; inserts are idempotent). The June 2026 USTR forced-labor
   Section 301 notice is also pinned as a tracked source program.
2. **Snapshot** — regenerate today's Markdown digest over a 7-day window;
   past snapshots are immutable.
3. **Serve** — landing page, snapshots, RSS, calendar, MCP, and the metered JSON API. API keys
   are stored as SHA-256 hashes; raw keys are shown exactly once.

## Development

This probe lives in a small monorepo ("factory") of metered Workers products
sharing [`@factory/core`](../../core) (auth, metering, Stripe billing,
analytics). From the repo root:

```sh
npm install
npm run verify          # biome + tsc + vitest (workers pool) + dry-run deploy
```

Probe-specific (from `probes/tariff-watch/`):

```sh
npm run dev             # local dev server
npm run migrate:local   # apply D1 migrations locally
npx vitest run          # this probe's test suite
npm run deploy
```

### Configuration

Vars (public, in [wrangler.jsonc](wrangler.jsonc)): `APP_BASE_URL`,
`BILLING_MODE`, `STRIPE_PRICE_ID`, `STRIPE_FIXED_MONTHLY_PRICE_ID`,
`STRIPE_FIXED_MONTHLY_METERED_PRICE_ID`, `STRIPE_FIXED_ANNUAL_PRICE_ID`,
`STRIPE_FIXED_ANNUAL_METERED_PRICE_ID`, `PRO_MONTHLY_QUOTA`,
`FREE_CALL_ALLOWANCE` + `SIGNUP_CREDIT_CENTS`, and the display counts
`FIXED_MONTHLY_INCLUDED_CALLS` / `FIXED_ANNUAL_INCLUDED_CALLS`.

`BILLING_MODE=free_launch` provisions keys without Stripe while billing is
being verified. `BILLING_MODE=paid` sends the same plan ids through Stripe
Checkout. In paid mode, the "first 30 calls free" offer is a US$3 promotional
credit grant issued at key claim; every call still reports to the meter.

Secrets (via `.dev.vars` locally, `wrangler secret put` in production):

| Secret | Purpose |
| --- | --- |
| `ADMIN_TOKEN` | authorizes `POST /admin/ingest` (manual ingest trigger) |
| `STRIPE_SECRET_KEY` | restricted (`rk_`) key scoped to Checkout Sessions + Billing meter events + **Credit grants (write)** before switching `BILLING_MODE` to `paid` |
| `STRIPE_WEBHOOK_SECRET` | signing secret for the `/webhooks/stripe` endpoint (events: `checkout.session.completed`, `customer.subscription.deleted`) |

In `free_launch`, `/billing/checkout` works without Stripe secrets. In `paid`,
missing Stripe secrets return a structured `missing_configuration` error and
every other surface works normally.

## Status

This is probe #1 of an experiment factory: it earns its keep through real
usage by 2026-07-25 or gets archived with a public post-mortem. If it's
useful to you, the best way to keep it alive is to use it — and say so.
