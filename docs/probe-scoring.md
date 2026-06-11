# Probe Scoring Sheet

No code before a passing score. Rubric adopted from the Bright Data
architecture proposal (Part 8) with the factory's stricter license gate;
see [research/brightdata-proposal-review.md](research/brightdata-proposal-review.md).
Scored 2026-06-12 against the evidence base (E01–E43) and the shortlist
triage in the review.

## Rubric (100 points)

| Criterion | Range |
| --- | --- |
| A. Authority (primary issuing authority = 16–20) | 0–20 |
| B. Update frequency (daily/near-real-time = 12–15) | 0–15 |
| C. Public accessibility (public and stable = 7–10) | 0–10 |
| D. Structure clarity (clear records/IDs = 12–15) | 0–15 |
| E. Provenance strength (versioning, timestamps = 12–15) | 0–15 |
| F. Commercial value (strong recurring = 12–15) | 0–15 |
| G. Extraction difficulty (very easy = 9–10) | 0–10 |

Tiers: **A** 85–100 (build), **B** 70–84 (validate first), **C** 50–69
(strategic only), reject below 50.

**Hard filters** (any one rejects): login required; low public relevance; no
stable identifiers; no clear primary source; mostly static; **license gate —
reuse rights not affirmatively established** (US federal works under
17 U.S.C. §105, open government license with attribution, or explicit
dedication; public *access* is not public *domain*); blocking risk with no
workaround.

## Scored queue

| Candidate | A | B | C | D | E | F | G | Total | Tier | Basis (one line) |
| --- | - | - | - | - | - | - | - | --- | --- | --- |
| **BIS export controls + Commerce AD/CVD** (export-controls.watch) | 20 | 12 | 9 | 13 | 13 | 14 | 8 | **89** | **A** | Primary federal sources (BIS/ITA, §105); weekly-to-daily churn with real penalty exposure (denied-party lists, duty rates); Federal Register + bis.gov structured; reuses the entire tariff.watch pipeline and adjacent buyer. |
| **FDA recalls/enforcement** (openFDA) | 20 | 13 | 10 | 14 | 12 | 12 | 9 | **90** | **A** | openFDA is a documented public-domain JSON API with stable record IDs and weekly enforcement reports; structural churn hedges the trade-news cycle; buyers (food/device importers, QA) pay to not miss recalls. |
| CBP rulings/CSMS | 19 | 12 | 7 | 9 | 10 | 13 | 5 | 75 | B | Primary and high-value to brokers, but CROSS rulings are a search UI (scrape tier) and CSMS sits behind GovDelivery — validate extraction cost in week 1. |
| SEC/CFTC filings layer | 20 | 15 | 9 | 13 | 14 | 6 | 8 | 85 | B* | EDGAR is superb infrastructure but free wrappers monetize at ~zero (thin-wrapper lesson, E-ledger); capped F until an evidence-layer angle proves a paying gap — tier B despite the number. |
| FCC ECFS/orders | 18 | 11 | 8 | 10 | 10 | 7 | 7 | 71 | B | Public API exists; buyer-paid-to-be-right unproven outside telecom counsel — needs the validation week before any build. |
| EPA regs/enforcement | 18 | 10 | 8 | 9 | 9 | 8 | 6 | 68 | C | Sprawling sources, mixed structure; compliance buyers exist but discovery surface is weak. |
| DOL/OSHA | 18 | 9 | 8 | 9 | 9 | 7 | 6 | 66 | C | Same shape as EPA with slower churn. |
| CA/NY state portals | 16 | 11 | 7 | 7 | 8 | 9 | 4 | 62 | C | Mixed copyright regimes (license check per source), inconsistent markup, scrape-tier extraction — strategic only. |
| EU/UK (OJ EU, legislation.gov.uk) | 20 | 12 | 8 | 12 | 13 | 9 | 6 | 80 | B | Open licenses with attribution (license_note required); strong provenance; jurisdiction expansion cost and crowded EU-regtech field — validate buyer first. |
| FINRA notices | — | — | — | — | — | — | — | — | **Rejected** | Hard filter: private SRO, notices copyrighted — fails the license gate regardless of score. |

\* SEC/CFTC numeric total is Tier-A range but is held at B by the commercial-value
evidence (free EDGAR wrappers set the price floor at $0).

## Decision

**Probe #2 committed: FDA recalls (openFDA), 90/100 Tier A.**
export-controls.watch (89) is a half-point behind and remains the strategic
favorite for pipeline reuse, but FDA recalls wins on the gate that matters
for a *second* probe: it proves the factory generalizes beyond trade data,
on a documented public-domain JSON API (lowest extraction risk in the
queue), with churn that does not share tariff.watch's news-cycle risk.
Export controls becomes probe #3 if the formula holds.

Per the formula: week 1 of the build month is source confirmation + FeedItemV1
mapping; kill criteria are written at scaffold time by `new-probe` v2.
