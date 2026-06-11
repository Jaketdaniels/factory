# Sale Playbook

How a plateaued-but-profitable probe becomes a listed asset (Acquire.com or
direct). The product of a probe sale is the *system*: domain, Worker, data,
billing, and a runbook a stranger can operate. Target: listing draft in under
a day; close logistics in under two weeks.

## 1. The listing needs (gather first)

| Item | Source |
| --- | --- |
| 12-week dial history | `docs/dials/dial-pack.sql` weekly rows from the decision log + the export query below |
| Revenue | Stripe: Billing → revenue by product; subscription count; churn |
| Cost base | Cloudflare plan share (~$5/probe-month), domain renewal, $0 marginal per call |
| Traffic provenance | `analytics_events` pageviews by ref; Search Console export |
| Asset inventory | domain, Worker, D1, R2 bucket, Stripe product/prices/meter, MCP registry listing, email sender |

Dials export (12-week weekly series, run once for the listing):

```sh
npx wrangler d1 execute <probe-db> --remote --json --command "
SELECT strftime('%Y-%W', created_at) AS week,
  SUM(CASE WHEN name = 'pageview' THEN 1 ELSE 0 END) AS visits,
  SUM(CASE WHEN name = 'checkout_started' THEN 1 ELSE 0 END) AS checkouts
FROM analytics_events GROUP BY week ORDER BY week" | jq -r '.[0].results[]'
```

## 2. Runbook template (ships with the asset)

For the buyer, one page per probe:

1. **What runs**: Worker name, custom domain, cron schedule, bindings (D1,
   R2, rate limit, email).
2. **Daily operation**: nothing — crons ingest; check `wrangler tail` or the
   observability dashboard if alerts fire.
3. **Common incidents**: source API down (self-heals via look-back); Stripe
   webhook secret rotation; email sender domain.
4. **Deploy**: `npm run verify && npm run deploy` from the probe directory.
5. **Kill criteria history** and the decision log rows for this probe.

## 3. Transfer mechanics

**Domain** — Cloudflare Registrar: unlock → auth code → buyer initiates at
their registrar; or move the zone to the buyer's Cloudflare account
(Cloudflare-to-Cloudflare keeps DNS intact). Custom-domain Worker routes are
recreated on the buyer's account after zone transfer.

**Cloudflare resources** — Workers/D1/R2 do not transfer between accounts:
the buyer redeploys from the repo (`wrangler deploy`), imports D1
(`wrangler d1 export` → `import`), and syncs R2 (`rclone` between buckets).
Schedule a cutover window: export → import → deploy on buyer account → move
DNS/domain → retire seller Worker.

**Stripe** — products/prices/meters do not transfer. Buyer creates the
product, prices (PAYG metered + Standing licensed), and the billing meter on
their account from the repo's documented ids; existing subscribers must
re-checkout (the key-claim flow makes this a one-link email); the seller
cancels remaining subscriptions at cutover. Small subscriber counts make
this a non-event; document it honestly in the listing.

**The repo** — `core/` is shared by other probes, so the buyer gets a
**vendored snapshot**: run the vendoring procedure below, which produces a
standalone repository with core inlined.

## 4. Core vendoring procedure

```sh
# from the monorepo root
mkdir -p /tmp/<probe>-standalone && cp -R probes/<probe>/ /tmp/<probe>-standalone/
cp -R core /tmp/<probe>-standalone/core
cd /tmp/<probe>-standalone
# point the workspace dependency at the local copy
python3 - <<'PY'
import json
pkg = json.load(open("package.json"))
pkg["dependencies"]["@factory/core"] = "file:./core"
json.dump(pkg, open("package.json", "w"), indent="\t")
PY
npm install && npm run typecheck && npx vitest run && npx wrangler deploy --dry-run
git init && git add -A && git commit -m "standalone snapshot for transfer"
```

The buyer receives: this repo, the runbook, `.dev.vars.example`, and a list
of secrets to set (`wrangler secret put` — never the seller's values).

## 5. Listing structure (Acquire.com fields)

Headline (what it is + the moat), asking price (24–36× monthly profit for
metered B2B data assets; adjust to dial trend), TTM revenue/profit, traffic,
tech stack, what's included (domain, repo, data, runbook, 30 days support),
growth levers (the unposted launch drafts, SEO surface, registry listings),
reason for sale ("portfolio focus" — true: the factory builds the next probe).

## 6. Dry run

The dry run against tariff.watch lives at
[sale/tariff-watch-listing-draft.md](sale/tariff-watch-listing-draft.md)
(unpublished; produced 2026-06-12 in well under a day — criterion met).
