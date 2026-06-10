# tariff.watch

**Live: https://tariff.watch** — a daily, facts-only changelog of US tariff,
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
- a **structured JSON API** with API keys and monthly quotas

Every entry links to its primary federalregister.gov document. No third-party
text is reproduced: US government works are public domain (17 U.S.C. §105),
and all summaries are our own.

## Using it

### Markdown snapshots (free, no key)

```sh
curl https://tariff.watch/snapshot/latest.md     # last 7 days, regenerated daily
curl https://tariff.watch/snapshot/2026-06-09.md # immutable point-in-time snapshot
curl https://tariff.watch/llms.txt               # agent-facing index
```

Dated snapshots never change once their day has passed — useful when an agent
needs to prove what was known on a given date.

### JSON API

```sh
# Get a key (shown once) — free tier: 250 requests/month
curl -X POST -H "Content-Type: application/json" \
  -d '{"email":"you@example.com"}' https://tariff.watch/v1/keys

# Query structured changes
curl -H "Authorization: Bearer <your-key>" \
  "https://tariff.watch/v1/changes?since=2026-06-01&limit=50"
```

Response fields: `document_number`, `title`, `type`, `abstract`,
`publication_date`, `agencies[]`, and the primary-source `url`. A Pro tier
(10,000 requests/month, $19/mo) is available from the landing page.

## How it works

A Cloudflare Worker (Hono + D1) with a daily cron (14:00 UTC, after the
Federal Register's morning publication):

1. **Ingest** — query the [Federal Register API](https://www.federalregister.gov/developers/documentation/api/v1)
   for the trade agencies + presidential tariff documents (3-day look-back so
   missed runs self-heal; inserts are idempotent).
2. **Snapshot** — regenerate today's Markdown digest over a 7-day window;
   past snapshots are immutable.
3. **Serve** — landing page, snapshots, and the metered JSON API. API keys
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
`STRIPE_PRICE_ID`, `PRO_MONTHLY_QUOTA`, `FREE_MONTHLY_QUOTA`.

Secrets (via `.dev.vars` locally, `wrangler secret put` in production):

| Secret | Purpose |
| --- | --- |
| `ADMIN_TOKEN` | authorizes `POST /admin/ingest` (manual ingest trigger) |
| `STRIPE_SECRET_KEY` | restricted (`rk_`) key scoped to Checkout Sessions + Billing meter events |
| `STRIPE_WEBHOOK_SECRET` | signing secret for the `/webhooks/stripe` endpoint (events: `checkout.session.completed`, `customer.subscription.deleted`) |

Until the two Stripe secrets are set, `/billing/checkout` returns a structured
`missing_configuration` error and every other surface works normally.

## Status

This is probe #1 of an experiment factory: it earns its keep through real
usage by 2026-07-25 or gets archived with a public post-mortem. If it's
useful to you, the best way to keep it alive is to use it — and say so.
