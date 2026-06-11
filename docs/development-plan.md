# Factory Development Plan

The single execution roadmap. Work outside the current phase is drift unless
it passes the same gate as everything else (scored, evidenced, or a
production incident). Strategy and evidence live in [STRATEGY.md](../STRATEGY.md)
and [docs/research/](research/); this file says what gets built, in what
order, and when each phase is done.

## Operating rules (anti-drift)

1. **One phase at a time.** A new phase opens only when the previous phase's
   exit criteria are checked off or explicitly waived with a dated note here.
2. **Pricing is locked** by the evidence rules (STRATEGY.md): US$2/1k + 30
   free; the $29 Standing tier ships with watchlists, not before; never
   compete on price.
3. **Dials over opinions.** Decisions read from D1 `analytics_events` /
   `usage_events` and Stripe — weekly, same query, logged in the decision
   log below.
4. **Every probe carries pre-committed kill criteria before deploy.** No
   probe gets a second build-month without passing its dials.
5. **The template stays green.** Improvements to shared machinery land in
   `core/` or `templates/probe/` first, then propagate — never patched into
   one probe alone.

---

## Phase 1 — Finalize tariff.watch (the pilot)

Goal: a complete, self-running reference product that proves the formula and
sets the pattern every future probe stamps.

Shipped: evidence layer (programs, legal status, dates), free/metered
boundary, usage pricing on Stripe Billing Meters, key receipts by email,
self-serve deletion, MCP server (metered tools), RSS/calendar/snapshots,
agent setup docs.

Remaining (in order):

- [ ] **Freshness escalation**: ingest cron 4×/day; "last checked" timestamp
      on landing and snapshots. (Strategy R6 — claim the freshness position.)
- [ ] **Rate limits** on free surfaces via Cloudflare rules — generous human
      thresholds, per-IP. (R5.)
- [ ] **Terms page**: free surfaces for grounding/personal use with
      attribution; no bulk redistribution; commercial licensing via netm8.
      (R7 — the OpenSanctions move.)
- [ ] **MCP registry submissions**: official registry, Claude Connectors
      Directory, Smithery, PulseMCP, Glama + `.well-known` server card.
- [ ] **Programmatic SEO pages** from D1: per-program, per-agency,
      per-document pages; the cron is the content team.
- [ ] **§122-sunset launch posts** (one Show HN, one importer-community
      post), timed to the late-July docket.
- [ ] **Watchlists + email/webhook alerts** → ship the **$29/mo Standing
      tier** with them (R2). This is the revenue floor.

Exit criteria: all boxes above checked; kill-date review (2026-07-25) passed
with keep decision — dials: ≥200 organic visits/week OR ≥5 keys OR ≥1 paying
key. If the dials fail: archive per probe lifecycle (snapshots stay up), and
Phase 3's formula still proceeds with the next-scored domain — the pilot's
purpose is the machinery either way.

## Phase 2 — netm8.com (the umbrella)

Goal: the publisher layer that makes feed #2 cheaper than feed #1.
Umbrella-light: ≤5 pages, ≤1 week. Copy already drafted and approved in
session; email (hello@/keys@netm8.com) already live.

- [ ] **Home/catalog**: "Changelogs of government rules." — method block,
      catalog (tariff.watch as feed #1), three-ways-in.
- [ ] **/standards**: the feed contract — publish **FeedItemV1** (adopted
      from the Bright Data proposal, see
      [research/brightdata-proposal-review.md](research/brightdata-proposal-review.md))
      plus the six publishing rules (primary sources, original one-line
      summaries, dates carried, write-once snapshots, corrections append,
      feeds archive — never disappear).
- [ ] **/licensing**: free reading; metered API per feed; commercial/
      redistribution licensed (inbound). The legal hook for asset protection.
- [ ] **/contact**: one person, on purpose; data corrections beat everything.
- [ ] **Seams**: tariff.watch footer/llms.txt already carry the imprint; the
      netm8 MCP server name reserves multi-feed tools (`tariffs_*` today,
      `<feed>_*` tomorrow).

Exit criteria: four pages live on netm8.com (Workers, same design system),
tariff.watch links resolve to them, FeedItemV1 published as the spec.

## Phase 3 — Mass production (the formula)

Goal: stamping a new feed is a scored decision plus ~one build-month, not a
project. High churn by design: **scaffold quick → validate appetite → kill,
keep, or sell.**

### The reusable formula (per probe)

1. **Score** — rubric ≥70/100 + all hard filters, including the license gate
   (reuse rights affirmatively established — public domain or open license).
   Recorded in `docs/probe-scoring.md`. No code before a passing score.
2. **Scaffold (target: 1 day)** — `npm run new-probe -- <name>`: stamped
   Worker with billing, metering, email, deletion, MCP, tests; create D1;
   buy the sharp domain only if the SEO surface is transactional, else
   `netm8.com/feeds/<name>`.
3. **Build (target: ≤30 days)** — the adapted Bright Data 30-day template:
   week 1 source confirmation + FeedItemV1 mapping; week 2 ingest +
   normalization + provenance; week 3 delta detection + quality; week 4
   launch + runbook. Collection is API-first; managed scraping only for
   API-less public sources; scraping fees never on the metered hot path.
4. **Validate (30–45 days live)** — pre-committed dials, same as the pilot's
   shape: organic visits, keys created, first paid usage, MCP installs.
   Weekly dial review; no feature work on a probe that isn't moving dials.
5. **Decide** — exactly one of:
   - **Kill**: archive with a 5-line public post-mortem; snapshots stay up
     forever (netm8 never deletes — the brand survives the churn).
   - **Keep**: compounds into the catalog; Standing-tier features next.
   - **Sell**: plateaued-but-profitable → Acquire.com listing. Probes are
     built separable for exactly this: own domain, own D1, own Stripe
     price, shared core vendored at sale time.

### Automation backlog (what makes the formula cheap)

- [ ] `new-probe.mjs` v2: FeedItemV1 schema + migration scaffold, D1
      create + id injection, KILL-CRITERIA template gate, checklist output.
- [ ] Generalize `tariff_documents` → FeedItemV1-shaped storage in the
      template (the pilot migrates last, not first).
- [ ] Raw-snapshot retention to R2 (snapshot_hash provenance) in the
      template ingest.
- [ ] `docs/probe-scoring.md` seeded with the Bright Data shortlist triage
      (strong: BIS export controls, CBP rulings/CSMS, FDA recalls; rejected:
      FINRA — license gate).
- [ ] Sale playbook: what an Acquire listing needs (dials export, runbook,
      domain transfer, Stripe product migration), written once.

### Candidate queue (scored before build, in this order)

1. **export-controls.watch** (BIS/EAR) — reuses tariff.watch's exact
   machinery and buyer; strategy's standing favorite.
2. **FDA recalls** — openFDA, public domain, *structural* churn (hedges the
   tariff news cycle).
3. **CBP rulings/CSMS deepening** — expands the pilot rather than a new
   probe; candidate for the Standing tier's value.

Exit criteria (the factory is "working"): two consecutive probes from score
to live in ≤35 days each; one decide-event executed end-to-end (a kill with
post-mortem, or a sale listing) proving the churn loop, not just the build
loop.

---

## Decision log

| Date | Decision | Basis |
| --- | --- | --- |
| 2026-06-10 | Probe factory adopted; tariff.watch is probe #1 | session strategy review |
| 2026-06-11 | Usage pricing: $2/1k + 30 free; no card-less keys | E33–E43 |
| 2026-06-11 | Free/paid boundary: today free, history + machines metered | E33, E34, E38, E40 |
| 2026-06-11 | FeedItemV1 adopted as feed contract; license gate strengthened; API-first collection | brightdata-proposal-review.md |
| 2026-06-11 | This plan codified; phases 1→3 sequenced | this document |
