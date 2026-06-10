# factory

Small, metered API products on Cloudflare Workers — plus the shared machinery
to ship more of them fast.

The flagship product is **[tariff.watch](https://tariff.watch)**: a
source-first evidence layer for US tariff, customs, and trade-action changes,
built for both humans and AI agents.

## tariff.watch

US trade policy changes weekly — Section 232/301 actions, de-minimis rules,
exclusion lists, antidumping orders. LLMs answer with stale data, and reading
the Federal Register takes hours. tariff.watch ingests every trade-relevant
federal publication daily (USTR, CBP, ITA, ITC, BIS, the Foreign-Trade Zones
Board, and presidential tariff documents) and republishes it through source
pages, snapshots, feeds, API, and MCP:

| Surface | URL | Auth |
| --- | --- | --- |
| Human changelog | [tariff.watch](https://tariff.watch) | none |
| Markdown snapshots for agents | [/snapshot/latest.md](https://tariff.watch/snapshot/latest.md), `/snapshot/YYYY-MM-DD.md`, [/llms.txt](https://tariff.watch/llms.txt) | none |
| RSS and calendar | [/feed.xml](https://tariff.watch/feed.xml), [/calendar.ics](https://tariff.watch/calendar.ics) | none |
| MCP | `/mcp` | none |
| Structured JSON API | `/v1/changes` | API key |

Everything links to its primary federalregister.gov document. No third-party
text is reproduced — US government works are public domain (17 U.S.C. §105),
and all summaries are original. Rows include program, legal status, effective
dates, comment deadlines, hearing dates, source identity, and confidence.

### API quickstart

```sh
# Free Markdown for agents — the last 7 days, regenerated daily
curl https://tariff.watch/snapshot/latest.md

# Source-first public feeds
curl https://tariff.watch/feed.xml
curl https://tariff.watch/calendar.ics

# Dated snapshots are immutable once their day passes (point-in-time grounding)
curl https://tariff.watch/snapshot/2026-06-09.md

# Get an API key: add a card at https://tariff.watch/#plans
# ($0 due today; first 30 requests/month free, then US$2 per 1,000)

# Structured changes since a date
curl -H "Authorization: Bearer <your-key>" \
  "https://tariff.watch/v1/changes?since=2026-06-01&limit=50"

# Delete your key and its data at any time
curl -X POST -H "Content-Type: application/json" \
  -d '{"email":"you@example.com"}' https://tariff.watch/account/delete
```

`GET /v1/changes` returns `{ since, count, results[], usage.remaining }`,
where each result has `document_number`, `title`, `type`, `abstract`,
`publication_date`, `agencies[]`, `program`, `legal_status`, `effective_on`,
`comments_close_on`, `hearing_on`, `confidence`, and the primary-source `url`.
Errors are structured JSON (`{ "error": { "code": "...", "message": "..." } }`);
quota exhaustion on free keys is a `429 quota_exceeded`. Pay as you go is
available from the landing page: first 30 requests/month free, then US$2 per
1,000, billed monthly for actual usage.

Full product documentation: [probes/tariff-watch](probes/tariff-watch/README.md).

## Repository layout

```
core/             @factory/core — shared library used by every product:
                  API-key auth + quota metering (Hono middleware), fetch-based
                  Stripe client (Checkout subscriptions, signature-verified
                  webhooks, billing meter events), self-hosted D1 analytics,
                  structured errors. Zod-validated at every boundary.
templates/probe/  A complete, runnable product template: landing page, metered
                  /v1 API, Stripe billing with one-time key reveal, cron stub,
                  D1 migrations, integration tests. Kept green in CI.
probes/           Live products stamped from the template.
scripts/          new-probe.mjs — stamps templates/probe into probes/<name>.
```

Design notes worth stealing:

- **Keys are never stored raw.** SHA-256 at rest; on purchase, the key is
  minted lazily at claim time behind an atomic one-time reveal (a webhook race
  or page refresh can't leak it twice).
- **Webhooks are idempotent and order-tolerant** — a `subscription.deleted`
  arriving before its `checkout.session.completed` tombstones the reservation.
- **Validators run before metering**, so malformed requests are never billed.
- **Tests run in the real Workers runtime** (`@cloudflare/vitest-pool-workers`)
  with MSW mocking the external boundaries (Stripe, Federal Register).

## Development

Requires Node 20+ and a Cloudflare account (for deploys).

```sh
npm install
npm run verify     # biome + tsc --noEmit + vitest (workers pool) + dry-run deploy
```

Ship a new product:

```sh
npm run new-probe -- my-probe
cd probes/my-probe
# create the D1 database, paste its id into wrangler.jsonc, then:
npm run migrate:local && npm run dev
```

Per-probe configuration (vars vs secrets, Stripe setup, deploy) is documented
in [templates/probe/README.md](templates/probe/README.md).

## Status

Active experiment. tariff.watch ingests daily at 14:00 UTC; if it's useful to
you, the best way to keep it alive is to use it — and open an issue with what
you'd want next.
