# Review: Bright Data Architecture Proposal

Reviewed 2026-06-11 against the factory strategy (STRATEGY.md) and the
metered-pricing evidence base (E33–E43). Source document:
[brightdata-architecture-proposal.md](brightdata-architecture-proposal.md)
(vendor-provided; treat product mappings as sales-informed and the
architecture/process content on its merits).

## Verdict

Pursue most of it. The schema, scoring rubric, policy templates, and 30-day
process are genuinely strong and fill real factory gaps — they turn probe
selection and feed quality into auditable process instead of judgment calls.
Two corrections are required where the vendor framing diverges from our legal
moat and our cost structure: the license gate must be stricter than "public
access", and collection must be API-first with scraping as the fallback, not
the default.

## Adopt as-is

| Item | Why | Where it lands |
| --- | --- | --- |
| **FeedItemV1 canonical schema** (Parts 7, 10) | A better-specified superset of what tariff.watch already stores (program/status/dates/source/confidence). The `change_tracking` (version, diff, severity), `provenance` (snapshot_hash, parser_version, retrieval_method), and `delivery` (rss_guid, calendar_uid, webhook_event) blocks formalize exactly what we ship informally. This becomes the basis of the **netm8 feed spec** — the thing STRATEGY.md already says netm8 must define. | netm8.com `/standards` spec; next migration generalizes tariff_documents toward it; required verbatim for probe #2. |
| **Scoring rubric + hard filters + sheet format** (Parts 8, 11) | Probe selection is currently taste. A 100-point auditable rubric with hard filters operationalizes the "probe eligibility" list in STRATEGY.md. | `docs/probe-scoring.md` + a scored candidate table before any probe #2 work. |
| **Citation / license / buyer-promise policies** (Part 4) | Matches our drafted netm8 standards page almost clause for clause; the "verify against cited source before compliance use" disclaimer line is good and we don't currently print one. | netm8 standards + tariff.watch footer/FAQ disclaimer. |
| **Record-lifecycle state machine** (status.state: new/updated/scheduled/effective/superseded/withdrawn/corrected/archived) | Complementary to our *legal* status enum — ours says what the law is, theirs says what the record did. Corrections/withdrawals are real Federal Register events we currently under-model. | Schema v1; the upsert pipeline already detects changes, it just doesn't classify them. |
| **Raw snapshot retention + snapshot_hash** | Cheap auditability (R2 object storage) and the provenance backbone the strategy sells. | Ingest writes raw responses to R2 keyed by hash; FeedItem carries the ref. |

## Adapt (corrections applied)

**1. License gate: "public" is not "public domain".** The proposal's hard
filter is public *access* with license notes "where available". Our moat —
and the litigation environment in evidence [E30, E31] — demands reuse rights
be *affirmatively established*: US federal works (17 U.S.C. §105), open
government licenses (UK OGL, EU reuse decision — attribution required), or
explicit public-domain dedication. Consequences for their shortlist:

- **FINRA (Week 2 #7): rejected.** Private SRO; its notices are copyrighted.
  Fails our gate regardless of rubric score.
- UK/EU sources: eligible but attribution-licensed — feed records must carry
  the license note field, which FeedItemV1 conveniently has.
- State portals (CA/NY): mixed copyright regimes; per-source legal check is
  part of Week-1 validation, not an afterthought.

**2. Collection is API-first; Bright Data is the fallback tier.** Nearly every
Week-1/2 federal source has an official structured API or feed: Federal
Register (in production already), SEC EDGAR, openFDA, USITC, FCC ECFS,
regulations.gov, CBP CSMS via GovDelivery/RSS. Where an official API exists,
scraping infrastructure adds cost and fragility for nothing. The collection
ladder is:

1. Official API / bulk data / RSS (free, stable, lawful by construction).
2. Bright Data Web Scraper API / Unlocker / Browser API — only for public
   sources with no machine interface (some state portals, CBP CROSS rulings
   UI, odd PDF-only agencies).
3. Bright Data MCP free tier (5k req/mo) — fine for *candidate discovery*
   scouting, zero commitment.

This also keeps probe unit economics intact: our $2/1k floor price works
because marginal cost is ~zero; per-request unlocker fees on the hot path
would eat it.

**3. Billing dimensions.** Their "per source monitored / per change event"
dimensions don't replace our evidence-locked pricing (hold $2/1k + 30 free;
$29 Standing tier gated on watchlists — R1/R2). But "per source monitored"
is noted as the natural meter for the future Standing tier's watchlists.

## Decline

- **Default-scraping architecture** for sources with official APIs (above).
- **Week-by-week 10-domain blitz.** The factory rule is one probe at a time
  with kill criteria; tariff.watch's kill date is 2026-07-25. The 30-day plan
  is adopted as the *template for probe #2's* build month, not as a mandate
  to stand up ten pipelines in parallel.

## Shortlist triage (provisional rubric pass)

To be formally scored in `docs/probe-scoring.md`; first-pass reading of the
proposal's candidates against our gate and the existing evidence base:

- **Strong**: CBP rulings/CSMS, Commerce AD/CVD + BIS export controls (both
  deepen/adjoin tariff.watch and reuse its machinery; export-controls.watch
  was already the strategy's preferred probe #2 [STRATEGY.md]); FDA recalls
  (openFDA, public domain, *structural* churn that hedges the tariff
  news-cycle risk).
- **Possible but crowded**: SEC/CFTC (free EDGAR wrappers monetize at zero —
  the thin-wrapper lesson; needs the evidence-layer treatment to clear the
  commercial-value bar).
- **Validate first**: FCC, EPA, DOL/OSHA (buyer-paid-to-be-right test
  unproven), CA/NY (license + parsing cost), EU/UK (attribution licensing,
  jurisdiction expansion cost).
- **Rejected**: FINRA (license gate).

## Sequencing

1. Now: this review + STRATEGY.md integration (done in same commit).
2. Before probe #2: formal scoring sheet; FeedItemV1 → netm8 feed spec v1;
   raw-snapshot R2 retention added to tariff.watch ingest.
3. Probe #2 build month: run the adapted 30-day plan against the top-scored
   candidate (current favorites: export-controls or FDA recalls).
