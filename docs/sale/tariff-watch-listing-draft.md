# DRY RUN — Acquire.com listing draft: tariff.watch (UNPUBLISHED)

Produced 2026-06-12 as the S14 playbook dry run. Numbers are real as of the
first weekly dial review; this draft is the template a real listing would
update from the dial history at decision time. **Not for publication** —
tariff.watch's kill-date review is 2026-07-25.

---

**Headline**: tariff.watch — metered API + MCP server for US tariff &
trade-action changes, on the official MCP registry, $0 marginal cost

**One-liner**: A Cloudflare Worker that reads the Federal Register four times
a day and sells the derived evidence layer (normalized legal status, effective
dates, immutable dated snapshots) to AI agents at US$0.10/call + a $29/mo
alerting tier. Facts are public domain; the product is the pipeline, archive,
and distribution.

**Asking**: structured as 30× monthly profit at listing time (pre-revenue at
dry-run date — a real listing waits for ≥3 months of dial history).

**Metrics (2026-06-12 dial row)**: 251 visits/7d (pre-launch, mostly
operator verification), 3 keys, 0 paying, launch posts intentionally gated
to the §122-sunset news window (drafts included in the sale).

**What's included**:
- tariff.watch domain (Cloudflare Registrar)
- Standalone vendored repo (Worker, D1 schema + data, R2, tests green, CI)
- Stripe blueprint: metered PAYG price + Standing $29/mo + billing meter (ids documented)
- Official MCP registry listing (io.github namespace transfers with repo ownership)
- Email receipts/alerts pipeline (Cloudflare Email Service)
- Operator runbook + 30 days of answer-anything support
- Unposted, timed launch drafts (Show HN + importer-community)

**Costs**: ~$5/mo infra share + domain renewal; zero marginal cost per call.

**Tech**: Cloudflare Workers/D1/R2, Hono, Stripe Billing Meters, vitest
(51 tests), GitHub Actions CI/CD, zero servers.

**Growth levers the buyer inherits**: programmatic SEO surface (sitemap of
program/agency/document pages), MCP registry distribution, the launch window,
watchlist tier upsell, and the §301 forced-labor docket news cycle through 2027.

**Reason for sale**: portfolio focus — the operator runs a probe factory and
sells plateaued assets to fund the next probe.
