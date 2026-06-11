# Factory Strategy Memo

Status: revised draft from global evidence pass
Research window: 2026-06-10 UTC / 2026-06-11 AEST
Primary evidence pack: [docs/research/global-venture-strategy-2026/evidence-ledger.md](docs/research/global-venture-strategy-2026/evidence-ledger.md)
Synthesis note: [docs/research/global-venture-strategy-2026/synthesis.md](docs/research/global-venture-strategy-2026/synthesis.md)

This memo separates observed evidence from inference. Evidence references use the
ledger IDs in brackets.

## Executive Read

The research pass did not invalidate the Factory model. It narrowed it. The
strongest opportunity is not "tariffs" by itself, and it is not a generic AI
search layer. It is dated, citable government-rule changefeeds for buyers,
software systems, and agents that are paid to be right.

Trade remains the flagship domain because policy churn is unusually high and
global. The United States issued a temporary Section 122 import surcharge in
February 2026, the Court of International Trade enjoined that surcharge for
specific importer plaintiffs in May 2026, USTR opened a new forced-labor Section
301 front across 60 economies in June 2026, the EU plans a low-value parcel duty
from July 1, 2026, and the United States ended broad de minimis treatment in
August 2025 [E02, E03, E04, E05, E06].

That supports tariff.watch as a probe, but it also raises the bar. Direct
competitors now sell tariff watchlists, dollar-impact tools, and developer tariff
APIs [E16, E17]. tariff.watch should therefore avoid duty calculation, customs
filing, legal advice, and "we monitor the news" positioning. Its defensible lane
is a source-first, effective-date and legal-status evidence layer: original
summaries, primary-source links, immutable snapshots, RSS, webhooks, calendar
feeds, and MCP tools.

The next probe should probably not be sanctions, generic recalls, or a Shopify
app. Sanctions is attractive but has a strong public-data incumbent in
OpenSanctions [E23, E24]. Recalls are technically easy because CPSC exposes a
public API, but the willingness-to-pay signal is weaker [E14]. Shopify merchant
pain is real, but the pain is action-heavy: duty calculation, checkout display,
DDP, carrier workflows, and tariff surcharges [E18, E19, E20, E21, E22]. The
strongest next adjacent feed is export-controls.watch or a comparable BIS/EAR
changefeed, because the source base is public, the consequences are high, the
buyer is paid to stay current, and the same Factory machinery applies [E12].

## What Changed

### Strengthened

- Public-source volatility is the right hunting ground. WTO, UNCTAD, IMF, and
  central-bank evidence all point to a trade and policy environment shaped by
  tariff uncertainty, fragmentation, war risk, AI hardware flows, and regulatory
  churn [E07, E08, E09, E10].
- A public-domain primary-source strategy is a real moat. Recent AI copyright
  litigation against search and RAG products raises the risk of building on
  publisher content, while government primary sources remain safer raw material
  when summaries are original and citations are preserved [E30, E31].
- Agents are a valid distribution and product surface. Official and third-party
  MCP registries exist, and the agentic-search market is heavily funded [E25,
  E26, E27, E28, E29].

### Revised

- The Section 122 story is no longer a simple countdown to July 24, 2026. It is a
  legal-status and appeals-monitoring story because the Court of International
  Trade granted relief to importer plaintiffs and entered a permanent injunction
  against the challenged Section 122 tariffs for those parties [E02, E03].
- A tariff product cannot rely on "daily tariff alerts" as unique positioning.
  TariffDesk already sells daily alerts, HTS watchlists, dollar impact, country
  comparison, bulk checking, and a low-priced entry plan [E16].
- A developer API alone is also not empty space. TariffsAPI sells a $199/month
  developer plan with tariff stacking, historical `as_of`, confidence fields,
  and MCP access [E17].
- Shopify is a later channel, not the first strategic proof point. Merchant pain
  is visible, but the pain pulls toward calculation and fulfillment, which are
  operationally heavy and already served by duty-and-tax products [E18, E20,
  E21].

### Removed Or Deferred

- Do not pitch a broad "LLM wiki" as the venture wedge. Horizontal agent search
  and research infrastructure is funded by companies with large teams and large
  balance sheets [E25, E26, E27].
- Do not make sanctions.watch the immediate second probe. It is a legitimate
  market, but OpenSanctions already sets a high bar for source breadth, licensing,
  and update cadence [E23, E24].
- Do not ship a Shopify tariff app until tariff.watch proves that merchants, not
  only developers and compliance operators, are the right first buyer.

## Venture Thesis

Factory stamps small, metered, source-first rule-change probes.

Each probe watches a volatile public-source domain, normalizes effective dates
and status changes, preserves source provenance, and exposes the result through
small products that can distribute themselves: programmatic pages, RSS, calendar
feeds, API keys, webhooks, Slack or Teams alerts, GitHub examples, and MCP
servers.

netm8 is the trust and distribution layer, not the first product by itself. It
should define the feed contract, citation policy, source license policy, MCP
tool conventions, billing shape, and reusable buyer promises. Vertical domains
remain the demand-capturing assets. The feed contract baseline is
**FeedItemV1** (canonical change-event schema with source, classification,
lifecycle status, dates, change tracking, provenance, and delivery blocks) —
adopted from the Bright Data architecture proposal with corrections; see
[docs/research/brightdata-proposal-review.md](docs/research/brightdata-proposal-review.md).

Collection policy is API-first: official APIs, bulk data, and RSS are tier 1;
managed scraping (Bright Data Unlocker/Scraper/Browser APIs) is the fallback
for public sources with no machine interface; the Bright Data MCP free tier is
for candidate discovery only. Scraping fees never sit on the metered hot path
— the US$0.10/call price depends on near-zero marginal cost.

A Factory probe is eligible only when all of these are true:

- Reuse rights are affirmatively established — public domain (17 U.S.C. §105)
  or an explicit open license with attribution carried in the feed record.
  Public *access* alone is not eligibility (this gate rejects, for example,
  FINRA notices).
- The domain changes often enough that static search is inadequate.
- The changes have dates, status, parties, thresholds, or jurisdictional scope
  that can be structured.
- A buyer or system is paid to notice the change.
- Distribution has native surfaces: search pages, registries, marketplaces,
  directories, docs, app stores, or agent ecosystems.
- The product can run without custom services, bespoke legal advice, or manual
  classification decisions.

## tariff.watch

Observed evidence: Trade policy churn is live and global, but tariff alerting is
now competitive [E02, E03, E04, E05, E06, E16, E17]. The product should narrow
to primary-source evidence and effective-date status rather than tariff
calculation.

### Positioning

tariff.watch is the source-linked changefeed for US trade actions and the
effective dates that operators and agents need to track.

It should answer:

- What changed?
- Which legal program changed?
- What is the effective date?
- Is the action proposed, final, stayed, enjoined, appealed, expired, or replaced?
- Which source proves it?
- What changed since the last snapshot?

### Product Ladder

The free/paid boundary follows the market's revealed line — "today is free;
history and machine access are metered" [E33, E34, E38, E40; full analysis in
metered-pricing-intel.md].

Free (the funnel: SEO, GEO citations, feed readers):

- Landing changelog and the latest daily snapshot (7-day window).
- Primary-source links and original summaries.
- RSS feed of recent headlines; effective-date calendar and `.ics` feed.
- MCP discovery (`initialize`, `tools/list`) — the Context7 distribution
  pattern [E43].

Metered behind the API key:

- `GET /v1/changes` (structured evidence fields).
- MCP `tools/call` — the market gates MCP as a premium: Signal Congress at
  $99/mo, TariffsAPI at $199/mo [E38, E33].
- Dated snapshot archive (point-in-time records) — historical/`as_of` access
  is a paid feature across the vertical [E33, E34]; the archive compounds
  daily and cannot be back-filled by a new entrant.

Pay as you go (adopted June 2026, replacing the flat Pro tier):

- $0/month base on a card-on-file subscription. The first 30 API calls
  each month are free (a month of daily updates), then US$0.10 per API call.
  Implemented as one Stripe graduated tiered price on a Billing Meter — the
  free allowance is tier one at $0, so Stripe computes every invoice and no
  quota repricing ever recurs.
- Paying users never hit a hard 429; Stripe bills actual usage monthly.
- No card-less keys: every key is provisioned through Stripe Checkout, so
  every key is billable, receipted by email, and self-serve deletable
  (key, usage records, and address) from the site or POST /account/delete.

Pricing decision rules (evidence: metered-pricing-intel.md, E33–E43):

- Hold US$0.10/call + 30 free. The free allowance gives one month of daily
  update checks, while the paid rate preserves the value of source-linked
  status fields, MCP tools, and dated archives [E33, E38, E40, E43].
  We are the only $0-base usage-priced entrant in the trade vertical [E33–E37].
- Add a flat "Standing" tier at US$29/mo only when watchlists/alerts ship:
  ~15,000 included calls + alerting, PAYG overage beyond. $29 is the
  empirically dominant entry price in this vertical (TariffsAPI, TariffDesk,
  Legiseye) and creates the recurring floor PAYG lacks [E33, E35, E36].
- Never compete on data exclusivity — the facts are public domain and the
  free-data/paid-product model is proven (MakeGov sells enrichments + rate
  limits over free data; TradeFacts sells SLA/diffs/webhooks against the free
  USITC API) [E40, E34]. Differentiation budget: evidence fields, archive
  depth, freshness, distribution.
- Asset protection: per-IP rate limits on free surfaces (MakeGov/Context7
  pattern [E40, E43]); a published terms/licensing page — free surfaces for
  grounding with attribution, redistribution licensed (the OpenSanctions
  move [E11, E23]).
- Freshness escalation: move ingest to 4×/day and surface "last checked"
  timestamps — Legiseye claims 2-hour cycles, TradeFacts ships overnight
  webhooks, and TariffsAPI is publicly apologizing for stale data right now
  [E36, E34, E33].
- Watch items: TariffsAPI data-quality recovery; Legiseye shipping an API;
  any trade player adopting $0-base PAYG (respond with archive depth and
  freshness, never price cuts).

Team or reseller later:

- HMAC webhooks.
- White-label digest links.
- Broker or 3PL client-report exports.
- Higher API quotas.
- Source snapshot archive.

### Do Not Build

- Duty calculation.
- Customs filing.
- Legal advice.
- Ten-digit HTS classification claims.
- A generic AI chat interface.
- News summarization that relies on publisher text.
- Shopify checkout workflows before merchant willingness to pay is proven.

### Near-Term Roadmap

1. Resolve public pricing and promise mismatches across project docs before any
   external launch.
2. Add legal-status fields to the feed: proposed, final, effective, stayed,
   enjoined, expired, replaced, appealed.
3. Add an effective-date calendar and `.ics` export.
4. Add the June 2026 USTR forced-labor Section 301 investigations as a tracked
   program.
5. Add RSS and a minimal MCP server.
6. Add watchlists only after the feed has enough repeat usage to justify paid
   conversion.
7. Keep July 24, 2026 as a monitoring event for Section 122, not as the only
   launch thesis.

### Keep Criteria

By the first post-launch decision date, keep tariff.watch only if at least one
of these is true:

- Five strangers create API keys.
- One buyer pays for watchlists, calendar export, webhooks, or a broker-facing
  export.
- One broker, consultant, compliance operator, developer, or merchant asks for a
  recurring workflow, not a one-off answer.
- Programmatic source pages begin to receive qualified search traffic for
  effective-date and legal-status queries.

Otherwise, preserve the source pipeline, write a short post-mortem, and move the
Factory stamp to the next scored feed.

## Opportunity Map

### 1. Export Controls / BIS Changefeed

Status: strongest next probe candidate.

Evidence: BIS exposes current Federal Register notices, refreshed as of the
access date and exportable as CSV, covering rules, proposed rules, notices, EAR,
Section 232, and ICTS [E12].

Inference: This domain has high urgency, business consequences, public sources,
global buyer relevance, and a natural developer/compliance audience. It is close
enough to tariff.watch to reuse the pipeline while testing a different buyer.

Initial product: exportcontrols.watch with source-linked rule changes,
effective dates, Entity List and EAR watchlists, RSS, API, webhooks, and MCP.

### 2. Global Customs And Low-Value Parcel Rules

Status: promising but source-fragmented.

Evidence: The EU plans a fixed customs duty on sub-EUR150 parcels from July 1,
2026, and the United States removed broad duty-free de minimis treatment in
August 2025 [E05, E06].

Inference: Ecommerce operators need a global low-value parcel rule map, but
country-by-country source normalization may be heavier than the first probe can
support.

### 3. Sanctions

Status: integrate or narrow, do not compete head-on first.

Evidence: OFAC updates frequently and OpenSanctions demonstrates a commercial
market for auditable sanctions and PEP data, with collection cycles measured in
hours [E13, E23, E24].

Inference: A sanctions probe only makes sense if it is a status monitor,
jurisdiction-specific delta feed, or source-verification companion. A broad
database is not the right solo wedge.

### 4. Recalls

Status: useful but probably lower willingness to pay.

Evidence: CPSC provides public machine-readable recall data in XML and JSON
[E14].

Inference: The source is attractive, but the buyer pain is less clearly urgent
unless tied to a specific marketplace, inventory system, or insurance workflow.

### 5. AI Compliance

Status: watch, do not start yet.

Evidence: The EU AI Act entered into force in 2024, with obligations phasing in
through 2025, 2026, 2027, and 2028 [E15].

Inference: The domain is visible and important, but it is legally complex,
consulting-heavy, and less obviously suited to a small source-delta feed today.

## Distribution

Use distribution surfaces that fit the product instead of forcing all probes
through the same channel.

- Programmatic search pages: agency, program, country, source, effective date,
  and legal status pages.
- RSS, `.ics`, webhook, and CSV outputs that users can forward or embed.
- GitHub examples and typed SDK snippets for developers.
- MCP registry listings, but only with useful tools and example prompts. MCP is
  crowded, so registry presence is not enough [E28, E29].
- Broker, compliance, and consultant exports that make the buyer look prepared
  in front of clients.
- Shopify only when the product has an action workflow that belongs in Shopify.

## Creative Positioning Routes

These routes are options grounded in the evidence, not final brand decisions.

1. Courtroom-grade rule changelog
   Buyer: compliance software teams, brokers, and agent builders.
   Promise: every change links to the primary source and status history.

2. Importer deadline calendar
   Buyer: importers, ecommerce operators, and 3PLs.
   Promise: know what becomes effective, expires, or changes status next.

3. Broker white-label feed
   Buyer: customs brokers and trade consultants.
   Promise: client-ready updates without rewriting government notices by hand.

4. Export-control changefeed
   Buyer: exporters, SaaS compliance teams, and restricted-party workflow
   builders.
   Promise: BIS/EAR changes as structured source-linked events.

5. Agent trust primitive
   Buyer: AI agent builders.
   Promise: an MCP endpoint that returns dated, cited, lawful government-source
   facts instead of generic web snippets.

## Risks And Red-Team Notes

- Competitor risk is real. TariffDesk and TariffsAPI already cover obvious
  tariff watchlist and calculation workflows [E16, E17].
- Demand may decay if a specific tariff program expires. The product must track
  recurring trade-action machinery, not one proclamation [E02, E03, E04].
- Accuracy liability is the core operational risk. Use status fields,
  confidence, source links, and explicit non-advice language.
- MCP distribution is noisy. Third-party registry counts show many servers, so
  useful workflows and examples matter more than presence alone [E28].
- Community evidence is directional, not proof. Shopify forum posts reveal pain,
  but they do not by themselves prove willingness to pay for tariff.watch [E20,
  E21, E22].

## Current Sequence

1. Finish tariff.watch as a source-first trade-action evidence layer.
2. Add legal status, effective dates, RSS, `.ics`, MCP, and forced-labor Section
   301 tracking before expanding scope.
3. Validate buyer surface through API keys, recurring watchlists, and qualified
   inbound workflows.
4. If tariff.watch reaches keep criteria, stamp exportcontrols.watch next.
5. If it misses, keep the reusable pipeline, write the post-mortem, and test the
   export-controls probe anyway.
6. Build netm8 as the shared feed contract, billing shell, trust policy, and MCP
   convention only after two probes expose repeated needs.
