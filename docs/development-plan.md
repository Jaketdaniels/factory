# Factory Development Plan

The single execution roadmap. Every task below is a **complete vertical
slice**: it ships end to end (data → API → UI → docs → tests → deploy →
live verification) and leaves the product releasable. No slice depends on a
half-finished neighbor; if a slice stops mid-way, nothing is broken.
Strategy and evidence live in [STRATEGY.md](../STRATEGY.md) and
[docs/research/](research/).

## Operating rules (anti-drift)

1. **Slices run in order, one at a time.** Reordering requires a dated note
   in the decision log. Starting slice N+1 before N's "done when" is checked
   is drift.
2. **Pricing is locked** by the evidence rules: US$0.10/call + 30 free; the
   $29 Standing tier ships inside the watchlists slice, not before; never
   compete on price.
3. **Dials over opinions.** Decisions read from D1 `analytics_events` /
   `usage_events` and Stripe — weekly, same query, logged below.
4. **Every probe carries pre-committed kill criteria before deploy.**
5. **The template stays green.** Shared machinery lands in `core/` or
   `templates/probe/` first, then propagates — never patched into one probe.
6. **A slice is done when its "done when" passes live**, not when the code
   merges. DoD (`npm run verify`) is implicit in every slice.

---

## Milestone A — Finalize tariff.watch (the pilot)

Shipped already: evidence layer (programs, legal status, dates), free/metered
boundary (today free; history + machines metered), usage billing on Stripe
Billing Meters, key receipts by email, self-serve deletion, metered MCP
tools, RSS/calendar/snapshots, agent setup docs.

### S1 — Reprice production to US$0.10/call — ✅ done 2026-06-11

Shipped via abc8349: live graduated price `price_1Th3caRtNOtWEuKv0aut9dUz`
(30 @ $0, then US$0.10/call) on the production meter; prior prices archived;
copy swept across landing, llms.txt, receipt email, and READMEs; tests assert
the old rate is absent.

- Ship: new graduated metered price on the live meter (tier 1: 30 @ $0;
  tier 2: $0.10/call), archive the old price, `STRIPE_PRICE_ID` var swap,
  landing pricing card + quickstart copy, llms.txt, receipt email copy, both
  READMEs, tests that assert the displayed rate.
- Done when: live `POST /billing/checkout` session resolves to the new
  price; the landing, llms.txt, and receipt email all state $0.10/call and
  30 free; old price is inactive in Stripe.

### S2 — Freshness: 4×/day ingest with visible timestamps

- Ship: cron `triggers` to four daily runs; "last checked" timestamp (from
  the latest `ingest_run` analytics event) rendered on the landing header
  and snapshot footers; ingest stays idempotent (upsert guard already
  proves zero-write re-runs); tests for the timestamp surface; deploy.
- Done when: production shows a fresh "last checked" under 6 hours old at
  any time of day; cron history shows 4 runs/day; snapshots carry the stamp.

### S3 — Free-surface rate limits

- Ship: Cloudflare rate-limiting rules (per-IP, generous human thresholds)
  on `/`, `/snapshot/latest.md`, `/feed.xml`, `/calendar.ics`, `/llms.txt`;
  thresholds documented in the probe README; a smoke check that normal
  curl cadence is unaffected.
- Done when: a burst test from one IP receives 429s at the documented
  threshold while the verification suite still passes live.

### S4 — Terms page

- Ship: `/terms` on tariff.watch — free surfaces licensed for grounding and
  personal use with attribution; no bulk redistribution or resale;
  commercial redistribution licensed via netm8 (inbound); the
  "verify against the cited source before compliance use" disclaimer;
  footer + llms.txt links; test.
- Done when: page live, linked from footer, llms.txt, and the receipt email.

### S5 — MCP registry presence

- Ship: `.well-known/mcp.json` server card on tariff.watch; submissions to
  the official MCP registry, Claude Connectors Directory, Smithery,
  PulseMCP, Glama; listing copy (one paragraph + tool list + auth note).
- Done when: server card live; five submissions filed with confirmation
  records (acceptance lag is theirs, not ours); at least one registry shows
  the listing.

### S6 — Programmatic SEO pages

- Ship: server-rendered index routes from D1 — `/program/<slug>`,
  `/agency/<slug>`, `/d/<document_number>` — using the existing design
  system, each page linking its primary sources; sitemap.xml; cache
  headers; tests for routes, escaping, and sitemap; deploy.
- Done when: every program and agency in D1 resolves to a live page, the
  sitemap lists them, and Search Console accepts the sitemap.

### S7 — §122-sunset launch

- Ship: one Show HN draft + one importer-community post draft (stop-slopped,
  artifact-led: the calendar and a real changelog entry), timed against the
  late-July docket; posted on the day; links tracked via `analytics_events`
  referrer dials.
- Done when: both posts published; first-week dial review logged.

### S8 — Watchlists + alerts + the $29 Standing tier

The revenue floor. One slice, shipped whole:

- Ship: watchlist schema (per-key program/agency/chapter subscriptions),
  watchlist CRUD on a small keyed settings page, daily alert evaluation in
  the cron, email delivery (existing Email Service binding) and HMAC-signed
  webhooks, the `Standing` flat price in Stripe ($29/mo incl. ~300 calls,
  PAYG overage beyond — flat + graduated on the same meter), landing tier
  card, README/llms.txt, receipt email update, full test coverage of the
  alert evaluator and webhook signatures.
- Done when: a real watchlist on a real key receives a real alert from a
  production ingest run; a Standing checkout completes live; both tiers
  visible on the landing.

### S9 — Kill-date review (2026-07-25)

- Ship: the dial query pack (one SQL file + one Stripe export), run weekly
  from now and on the kill date; decision logged here with the numbers.
- Done when: the 2026-07-25 row exists in the decision log with keep /
  archive / sell and the dial values that justified it. Dials: ≥200 organic
  visits/week OR ≥5 keys OR ≥1 paying key.

## Milestone B — netm8.com (the umbrella)

### S10 — The netm8.com site, whole

One Worker, four pages, shipped as a single slice (copy already approved):
home/catalog ("Changelogs of government rules." + method block + catalog),
`/standards` (the published feed contract: **FeedItemV1** plus the six
publishing rules — see
[research/brightdata-proposal-review.md](research/brightdata-proposal-review.md)),
`/licensing` (free reading; metered API per feed; commercial redistribution
licensed), `/contact`.

- Ship: the Worker on the netm8.com zone (same design system), FeedItemV1
  JSON Schema served at a stable URL, tariff.watch footer/terms links
  updated to resolve to netm8.com, tests, deploy.
- Done when: all four pages live; the spec URL returns the schema;
  tariff.watch's imprint line links through; lighthouse-basics pass at
  375/768/1280.

## Milestone C — Mass production (the factory)

### The per-probe formula (every probe is one slice of these five steps)

1. **Score** — rubric ≥70/100 + all hard filters including the license gate
   (reuse rights affirmatively established). Recorded in
   `docs/probe-scoring.md`. No code before a passing score.
2. **Scaffold (1 day)** — `npm run new-probe -- <name>`; D1 created; domain
   bought only if the SEO surface is transactional, else
   `netm8.com/feeds/<name>`; KILL CRITERIA filled before deploy.
3. **Build (≤30 days)** — week 1 source confirmation + FeedItemV1 mapping;
   week 2 ingest/normalization/provenance; week 3 delta detection +
   quality; week 4 launch + runbook. API-first collection; managed scraping
   only for API-less public sources; scraping fees never on the metered hot
   path.
4. **Validate (30–45 days live)** — pre-committed dials; weekly review; no
   feature work on a probe that isn't moving dials.
5. **Decide** — kill (archive + 5-line public post-mortem; snapshots stay up
   forever) / keep (compounds into the catalog) / sell (Acquire.com; probes
   are separable by construction: own domain, D1, Stripe price).

### S11 — `new-probe` v2 (scaffold automation)

- Ship: FeedItemV1 schema + migration scaffold in the template, D1
  create-and-inject, KILL-CRITERIA gate (script refuses to finish without
  it), post-scaffold checklist output; a scratch probe stamped, verified
  green, then deleted as the test.
- Done when: scaffold-to-green on a throwaway probe takes under one hour,
  measured.

### S12 — FeedItemV1 storage + raw snapshot provenance in the template

- Ship: template storage generalized to FeedItemV1 shape (lifecycle state
  machine included); ingest writes raw source responses to R2 keyed by
  `snapshot_hash`; provenance block populated; template tests; the pilot
  migrates **last**, behind its own slice, not first.
- Done when: template verify green with FeedItemV1 rows and R2 refs; spec
  URL on netm8.com matches what the template emits.

### S13 — Probe scoring sheet, seeded

- Ship: `docs/probe-scoring.md` with the rubric columns and hard filters;
  scored rows for the queue: BIS export controls, FDA recalls, CBP
  rulings/CSMS, SEC/CFTC, FCC, EPA, DOL/OSHA, CA/NY, EU/UK; FINRA recorded
  as rejected (license gate).
- Done when: every queued candidate has a total score, tier, and a
  one-line basis; the top score is the committed probe #2.

### S14 — Sale playbook

- Ship: `docs/sale-playbook.md` — what an Acquire listing needs: dials
  export query, runbook template, domain transfer steps, Stripe
  product/price migration, core vendoring procedure for the buyer.
- Done when: a dry run against tariff.watch produces a complete listing
  draft (unpublished) in under a day.

### S15 — Probe #2, end to end

- Ship: the full five-step formula against the top-scored candidate
  (current favorites: export-controls.watch, FDA recalls).
- Done when: live with kill criteria; first dial review logged.

Factory exit criteria: two consecutive probes score-to-live in ≤35 days
each, and one decide-event (kill with post-mortem, or sale listing) executed
end to end — the churn loop proven, not just the build loop.

---

## Decision log

| Date | Decision | Basis |
| --- | --- | --- |
| 2026-06-10 | Probe factory adopted; tariff.watch is probe #1 | session strategy review |
| 2026-06-11 | Usage pricing: $0.10/call + 30 free; no card-less keys | E33–E43 |
| 2026-06-11 | Free/paid boundary: today free, history + machines metered | E33, E34, E38, E40 |
| 2026-06-11 | FeedItemV1 adopted as feed contract; license gate strengthened; API-first collection | brightdata-proposal-review.md |
| 2026-06-11 | Plan restructured: one complete vertical slice per task (S1–S15); repricing to $0.10/call is S1 since production still charges the launch rate | this document |
| 2026-06-11 | Pricing corrected to a lifetime allowance: first 30 calls free ever (not per month), then $0.10/call flat — Stripe period tiers reset monthly, so the allowance is enforced app-side | JD decision; S1 redone on price_1Th6ra… |
| 2026-06-12 | First weekly dial review (S1–S8 shipped; pre-launch): visits_7d 251, keys 3, paying 0, watchlists 0, checkouts_started_7d 7, calls_7d 1. Read: traffic is mostly own verification; no launch posts yet (gated to the §122 sunset window). No action — dials become meaningful after S7 posting day. | docs/dials/dial-pack.sql run 2026-06-11 UTC |
