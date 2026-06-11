# Metered-Pricing & Positioning Intelligence — tariff.watch

Data collected 2026-06-11 (AEST) / 2026-06-10–11 UTC, live pages via direct
fetch and Exa retrieval (Bright Data CLI unavailable: `cli_unlocker` zone
inactive on the account). Every claim cites its source URL. Gaps are stated,
not filled from training data. Ledger references: E33–E43 in
[evidence-ledger.md](evidence-ledger.md).

## 1. The competitive set, normalized

Effective marginal price is computed as (tier price ÷ included calls) where a
cap exists; "—" means the surface is not sold.

| Player | Model | Free tier | Entry paid | Effective $/1k calls | MCP | Source |
| --- | --- | --- | --- | --- | --- | --- |
| **tariff.watch** (us) | $0-base pay-as-you-go | 30 req/mo | usage only | **$100.00 marginal after free allowance** | metered | — |
| TariffsAPI | flat tiers + caps | calculator only, **no API** | $29 alerts; $49 Basic API | $4.90 (Basic, 10k); $1.99 (Pro, 100k) | only at $199 Pro | tariffsapi.com/pricing [E33] |
| TradeFacts.io | flat, **unlimited calls** | 30-day trial | $199 | n/a (flat) — sells SLA/diffs/webhooks | — | tradefacts.io/pricing.html [E34] |
| TariffDesk | flat, human alerts | 5 HTS codes | $29 (15 codes) | — (no API at any tier) | — | tariffdesk.com/pricing [E35] |
| Legiseye | flat, human feeds | browse index | $29; $49 full feed | — (API enterprise-only) | — | legiseye.com/trade [E36] |
| BITE Data | per-seat + credits | — | $5/user lookups | credit-metered bulk ops | — | bitedata.io/pricing [E37] |
| Signal Congress | dashboard + API/MCP tiers | $0 dashboard | $49 PRO; **$99 API+MCP** | ~$3.30 (1k/day at $99) | gated at $99+ | signalcongress.com/pricing [E38] |
| Apogee (apog.ai) | flat + AI credits | $20/mo credits incl. | $300 team | — | included all tiers | apog.ai/pricing [E39] |
| MakeGov Tango | free raw + paid enrichments | full raw data, 100/day | paid tiers by rate limit | — (quota ladder) | — | docs.makegov.com [E40] |
| Exa | usage | 1,000 req/mo | usage | $7 search; $15 monitors; $1 contents | — | exa.ai/pricing [E41] |
| Tavily | credits | 1,000 credits/mo | $0.008/credit PAYG | $8.00 | — | tavily.com/pricing [E41] |
| Valyu | usage, source-tiered | — | usage | $0.50 (open) – $1.50 (web) – $8 (financial) – $30–50 (proprietary) | — | valyu.ai/pricing [E42] |
| Context7 | freemium seats + overage | 1,000 calls/mo (+20/day at limit) | $10/seat (5k calls) | $10 overage | is the product | context7.com/plans [E43] |
| OpenSanctions | license layer on free data | CC-BY-NC (attribution, non-commercial) | flat commercial licenses | — | — | opensanctions.org/licensing [E11/E23] |

Gap: AskNews pricing page is cookie-walled/relocated (docs.asknews.app
returned a consent wall on 2026-06-11); prior ledger figures (E25-era,
$250–$1,000/mo tiers) were not re-verified this pass.

## 2. Findings

**F1 — Commodity agent-call APIs cluster around $2–$15 per 1,000; tariff.watch
prices the evidence call, not raw retrieval.** Exa $7, Tavily $8, Context7
overage $10, Exa Monitors $15, Valyu web $1.50, TariffsAPI effective
$1.99–4.90. The tariff.watch unit is a source-linked legal-status/archive
lookup with MCP and point-in-time grounding, so the paid marginal rate should
protect the evidence layer rather than chase commodity search usage.

**F2 — Nobody in the trade vertical sells $0-base pay-as-you-go.** Every
trade competitor monetizes through flat monthly tiers ($29–$499). We are the
only zero-commitment metered entrant — a real wedge for agent builders — but
also the only player with **no recurring revenue floor**. The market evidence
says floors work: TariffsAPI, TariffDesk, and Legiseye all price entry at
exactly $29/mo.

**F3 — MCP access is monetized as a premium in this market.** Signal Congress
gates API+MCP at $99/mo above its $49 dashboard; TariffsAPI includes MCP only
at $199; Context7 converts free MCP usage into $10/seat teams. Metering our
MCP `tools/call` behind the API key is market-conforming, not over-protective.
Discovery methods (`initialize`, `tools/list`) stay open, matching Context7's
free-distribution pattern.

**F4 — "Free data, paid product" is the proven model on public-domain data.**
MakeGov gives away complete raw federal procurement data and sells
*enrichments + rate limits*. TradeFacts' entire pitch against the free USITC
API is "it's a file dump, not a product" — they sell nightly diffs, schema
stability, webhooks, and an SLA at $199–499 flat. OpenSanctions licenses
commercial use of data that is free for non-commercial use. The asset to
protect is never the facts (they are public domain); it is the **derived
layer**: normalized status/program/date fields, the immutable archive, machine
interfaces, and alerting.

**F5 — Historical/point-in-time access is a paid feature across the set.**
TariffsAPI sells `as_of` historical rates from $29 and "custom `as_of` at
scale" at $199; TradeFacts sells nightly diff history. Gating our dated
snapshot archive (latest stays free) matches the market's revealed boundary.

**F6 — Rate limits are the standard free-tier protection.** MakeGov: 100/day
+ 25/min on free; Context7: 60/hr free; Signal Congress: RPM ladders per
tier. Our free surfaces currently have cache headers but no rate limiting —
an operational gap (R5).

**F7 — Freshness is an active battleground, and the incumbent is wobbling.**
Legiseye claims 2-hour update cycles across 6 jurisdictions; TradeFacts
updates nightly with "within hours" IEEPA overlays and webhook push;
TariffsAPI is currently displaying a public stale-data apology banner
("rates shown may be temporarily incomplete", observed 2026-06-11). Our
single daily 14:00 UTC cron is mid-pack. Freshness is the cheapest visible
differentiator available to us right now (R6).

**F8 — A licensing layer is how free-data publishers protect assets legally.**
OpenSanctions (CC-BY-NC + flat commercial tiers) and Valyu (publisher
licensing with usage tracking) both formalize who may redistribute. We
currently publish no terms at all (R7).

## 3. Strategy (decision rules, not vibes)

**Positioning statement.** tariff.watch is the only zero-commitment,
usage-priced, primary-source evidence API for US trade actions. The facts are
public domain and stay free at human pace; the product — normalized evidence
fields, the immutable archive, machine interfaces, and alerts — is metered.
Competitors charge $29–$499/mo before an agent can make its first structured
call; here the first 30 calls each month cost nothing and paid calls are
US$0.10 each.

**R1 — Hold $0.10/call + 30 free.** Validated by F1/F2/F3/F5. The free
allowance supports a month of daily update checks; the paid rate protects the
machine-ready evidence fields, MCP tools, and dated archive. Do not discount
into commodity search pricing; capture recurring revenue with R2.

**R2 — Add a flat tier only when watchlists ship, at $29/mo.** Trigger
condition, not a date: when per-user alerting exists (watchlists, webhooks,
digests), introduce "Standing" at $29/mo including ~300 calls (≈ the tier
price in PAYG value at $0.10/call) + alerting,
PAYG overage beyond. $29 is the empirically dominant entry price in this
vertical (TariffsAPI, TariffDesk, Legiseye — F2). This creates the recurring
floor the PAYG model lacks while keeping the PAYG wedge intact.

**R3 — The protection boundary is "today free, history and machines
metered."** Free: landing, latest snapshot (7-day window), RSS (recent
headlines), calendar, MCP discovery. Metered behind the key: `/v1/changes`,
MCP `tools/call`, dated snapshot archive. Justified by F3/F4/F5. This is the
line the whole market draws; we were the outlier in giving machine surfaces
away.

**R4 — Never compete on data exclusivity.** The facts are public domain and
USITC/Federal Register give them away (F4). Differentiation budget goes to:
evidence fields (status/program/dates), archive depth (compounds daily and
cannot be back-filled by a new entrant), freshness, and distribution (MCP
registries, GEO citations).

**R5 — Operational protection (this week).** Cloudflare rate-limit rules on
free surfaces (per-IP, generous human thresholds); keep cache headers; the
30-call free key allowance already self-limits the API.

**R6 — Freshness escalation (cheap, visible).** Move ingest from 1×/day to
4×/day (same idempotent pipeline, ~zero cost) and surface "last checked"
timestamps on the landing page and snapshots. Claim the freshness position
while TariffsAPI's banner is up (F7).

**R7 — Publish terms (the OpenSanctions move).** Free surfaces: personal and
agent grounding use with attribution; no bulk redistribution or resale.
Commercial redistribution/embedding: licensed (inbound via the netm8
licensing page already drafted). Costs an afternoon; creates the legal hook
that makes the asset defensible (F8).

**R8 — Watch items.** TariffsAPI recovering its data quality (their $199 Pro
is our closest substitute at scale); Legiseye expanding from human feeds to
an API; any trade player adopting $0-base PAYG (erases our wedge — respond
with archive depth + freshness, not price).

## 4. Revenue reference points (at current pricing)

| Usage profile | Monthly bill | Competitor equivalent |
| --- | --- | --- |
| Evaluation agent, 30/mo | $0 | TariffsAPI: no API at $0 |
| Indie agent, 1k/mo | $97.00 | TariffsAPI Basic $49; Signal Congress API+MCP $99 |
| Production agent, 10k/mo | $997.00 | Custom usage / Standing tier candidate |
| Broker/ERP, 100k/mo | $9,997.00 | Enterprise / licensed redistribution candidate |

At evaluation scale we are the only free machine entry point in the vertical.
Sustained high-volume usage should graduate into a flat Standing tier or a
licensed redistribution deal rather than silently turning the raw PAYG price
into the only commercial path.
