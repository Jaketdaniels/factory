# Factory

Monorepo for shipping small, self-serve, metered products ("probes") on
Cloudflare Workers. Strategy: many cheap experiments with pre-committed kill
criteria; keep or sell the survivors. Build is never the bottleneck —
distribution is, so probes are only built for surfaces with native discovery
(app stores, marketplaces, transactional SEO, agent registries).

## Execution roadmap

The phased plan with anti-drift rules, exit criteria, and the probe formula
lives in [docs/development-plan.md](docs/development-plan.md). Work outside
the current phase needs a scored justification logged there.

## Layout

- `core/` — `@factory/core`: API-key auth + metering middleware, Stripe
  (Checkout, webhooks, billing meters; fetch-based, no SDK), self-hosted D1
  analytics, structured errors. Shared by every probe.
- `templates/probe/` — the stamp: a complete runnable Worker (landing, metered
  `/v1` API, Stripe billing, webhook provisioning, cron stub, migrations,
  tests). Kept green at all times; it is itself a workspace member.
- `probes/<name>/` — live experiments, stamped via `npm run new-probe -- <name>`.
- `scripts/new-probe.mjs` — copies the template and rewrites `probe-template`.

## Commands (Definition of Done — all must pass)

```sh
npm run lint        # biome check --write .
npm run typecheck   # tsc --noEmit in every workspace
npm test            # vitest run (workers pool) in every workspace
npm run dry-run     # wrangler deploy --dry-run in deployable workspaces
npm run verify      # all of the above
```

## Conventions

- Web APIs only (Workers runtime); D1 relational, KV config, R2 objects.
- Zod at every boundary: request bodies (`@hono/zod-validator`), D1 rows,
  Stripe payloads, env secrets. Infer TS types from schemas.
- Secrets via `.dev.vars` (gitignored) locally and `wrangler secret put` in
  production — never in `wrangler.jsonc` or source. Stripe keys must be
  restricted (`rk_`) keys.
- Stripe: Checkout Sessions (subscription mode), never `payment_method_types`,
  webhooks always signature-verified, API version pinned in `core/src/stripe.ts`.
- Every Hono app exports `AppType`; mutating routes validated; errors are
  structured JSON via `onApiError`.
- `wrangler types --include-runtime=false` regenerates each probe's Env after
  editing wrangler.jsonc (`npm run types` in the probe).
- Each probe's README must contain filled-in KILL CRITERIA before deploy.

## Probe lifecycle

1. `npm run new-probe -- <name>` → fill KILL CRITERIA → build the one thing.
2. Ship to a surface with native discovery + billing.
3. Read dials from D1 `analytics_events` / `usage_events` only.
4. On kill date: archive + 5-line post-mortem, or double down.
5. Plateaued but profitable → list on Acquire.com; the asset is the product.
