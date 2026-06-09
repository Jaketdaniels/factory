# Factory

Ship small, self-serve, metered Cloudflare Workers products fast — with
API-key auth, usage metering, Stripe billing, and analytics already wired.

**Philosophy:** in 2026 building is nearly free, so ideas are worthless and
distribution is everything. This repo industrializes the only strategy that
survives that math: many cheap probes, each with pre-committed kill criteria,
launched only onto surfaces with native discovery. Kill fast, keep winners,
sell plateaued-but-profitable probes on Acquire.com.

## Quickstart

```sh
npm install
npm run verify                  # lint + typecheck + tests + dry-run deploy

npm run new-probe -- my-probe   # stamp a new probe from the template
```

Each probe is a standalone Worker: own D1 database, own Stripe product, own
domain, own kill criteria. See [templates/probe/README.md](templates/probe/README.md)
for per-probe setup (D1, secrets, Stripe webhook) and
[CLAUDE.md](CLAUDE.md) for conventions and the probe lifecycle.

## What the template gives every probe on day zero

| Concern | Implementation |
| --- | --- |
| Auth | Bearer API keys, SHA-256 hashed at rest, one-time reveal |
| Metering | Monthly quotas, 429s, per-route usage events in D1 |
| Billing | Stripe Checkout (subscription), signature-verified webhooks, idempotent provisioning, auto-revocation, optional usage-based meter events |
| Analytics | Self-hosted D1 events (pageview → checkout → claim funnel) |
| Ops | `wrangler dev`, migrations, cron stub, observability on, ~$5/mo runtime |
| Quality | Biome, strict TS, vitest-pool-workers integration tests, zod at every boundary |
