# Global Venture Strategy Synthesis

Research window: 2026-06-10 UTC / 2026-06-11 AEST
Inputs: evidence ledger, current `STRATEGY.md`, public sources, marketplace pages, community posts, and an Alpaca delayed SIP market snapshot.

## Executive Read

The evidence supports a source-first probe factory, but it changes the center of
gravity. The durable opportunity is not tariffs as a topic. It is structured,
dated, cited government-rule deltas for buyers and agents that cannot afford to
miss effective dates, status changes, or source provenance.

tariff.watch remains a credible flagship because trade policy is changing across
multiple authorities and regions. The US Section 122 surcharge, the CIT decision,
the USTR forced-labor Section 301 investigations, EU parcel duties, and US de
minimis changes create enough churn for a focused product. The counterweight is
competition: TariffDesk already sells the obvious monitoring workflow, and
TariffsAPI sells the obvious developer API. That pushes tariff.watch toward
legal-status, effective-date, and source-evidence workflows instead of generic
alerts or duty calculation.

The best next probe is likely export controls, not sanctions or Shopify. BIS
sources are public, frequently updated, and close to tariff.watch's architecture.
Sanctions is important, but OpenSanctions is strong. Shopify merchant pain is
visible, but it points toward operational duty calculation and fulfillment, which
is too service-heavy for the initial Factory pattern.

## Claim Matrix

| Current memo claim | Verdict | Evidence | Revision |
| --- | --- | --- | --- |
| Tariff volatility creates a useful launch window. | Verify and broaden | E02, E03, E04, E05, E06, E07, E10 | Keep trade as flagship, but frame it as global trade-action churn and legal-status tracking. |
| Section 122 creates a July 24, 2026 cliff. | Revise | E02, E03 | July 24 matters, but litigation turns it into a status-monitoring story, not a single countdown. |
| tariff.watch can win with daily tariff alerts. | Revise | E16, E17 | Generic alerts are crowded. Win through source provenance, effective-date calendar, status fields, RSS, webhooks, and MCP. |
| Shopify is a natural monetization channel. | Uncertain / defer | E18, E19, E20, E21, E22 | Shopify pain exists, but the desired workflow is calculation, checkout, DDP, and logistics, not passive monitoring. |
| A broad LLM wiki or AI search product is attractive. | Remove as wedge | E25, E26, E27, E30, E31 | Avoid horizontal search. Use lawful public primary sources and vertical provenance. |
| netm8 should become the umbrella product. | Revise | E28, E29 | Keep netm8 as shared trust, feed, billing, and MCP conventions after two vertical probes prove repeatability. |
| Sanctions or recalls are obvious next probes. | Revise | E13, E14, E23, E24 | Sanctions has a strong incumbent; recalls are feasible but weaker on willingness to pay. Export controls score better. |

## Opportunity Scoring

Scale: High, Medium, Low. Scores are directional and should be rerun after each
probe's real usage data arrives.

| Opportunity | Urgency | Willingness to pay | Source legality | Data availability | Churn cadence | Distribution advantage | Solo maintainability | Competition | Trust risk | Time to probe | Exit optionality | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tariff.watch as trade-action evidence layer | High | Medium | High | High | High | Medium | Medium | Medium | Medium | Low | Medium | Keep, narrowed |
| exportcontrols.watch / BIS-EAR changefeed | High | Medium-High | High | High | High | Medium | Medium | Medium | Medium | Low-Medium | Medium | Shortlist next |
| global customs / parcel thresholds | High | Medium | High | Medium | Medium-High | Medium | Low-Medium | Medium | Medium | Medium | Medium | Defer until tariff.watch proof |
| sanctions delta feed | High | High | High | High | High | Medium | Low-Medium | High | High | Medium | High | Integrate or narrow |
| recalls feed | Medium | Low-Medium | High | High | Medium | Medium | High | Medium | Medium | Low | Low-Medium | Backlog |
| AI compliance changefeed | Medium-High | Medium | High | Medium | Medium | Medium | Low-Medium | Medium | High | Medium | Medium | Watch |
| Shopify tariff app | Medium-High | Medium | Medium | Medium | Medium | High | Low | High | High | Medium | Medium | Defer |

## Product Design Findings

Operator pain is not "tell me there was a tariff." It is "tell me exactly what
changed, when it becomes effective, whether it is still legally operative, and
what source I can show my client, boss, broker, checkout team, or agent."

Developer and agent-builder pain is provenance. The API or MCP tool should
return dated source IDs, confidence, legal status, and snapshot references. A
model answer without the source is not enough for this category.

Merchant pain is visible in Shopify communities, but it is not cleanly a
tariff.watch first product. Merchants complained about wrong duty calculations,
unclear treatment of MFN and IEEPA stacking, support requiring customs documents,
and sales declines after de minimis changes. Those are serious problems, but the
natural solutions are calculation, landed cost, DDP, carrier accounts, and
checkout fees. Those workflows are more operational and support-heavy than a
solo source-changefeed.

Broker and consultant pain is likely more aligned with Factory. A broker can
turn cited, source-linked deltas into client updates and risk reports without
asking the probe to calculate the whole entry.

## Creative Positioning Routes

These routes use Creative Production as evidence-grounded positioning
exploration, not as visual generation.

| Route | Audience | Promise | Evidence anchor | Avoid |
| --- | --- | --- | --- | --- |
| Courtroom-grade rule changelog | Compliance software, brokers, agent builders | Every change links to the primary source and its status history. | E01, E02, E03, E04 | Legal advice or definitive customs treatment |
| Importer deadline calendar | Importers, ecommerce operators, 3PLs | Know what becomes effective, expires, or changes status next. | E02, E03, E05, E06 | News digests without action dates |
| Broker white-label feed | Customs brokers and trade consultants | Client-ready updates without rewriting government notices by hand. | E16, E20, E21 | Full-service consulting |
| Export-control changefeed | Exporters, SaaS compliance, restricted-party workflow builders | BIS/EAR changes as structured source-linked events. | E12 | Competing with broad sanctions databases |
| Agent trust primitive | AI agent builders | MCP tools that return dated, cited, lawful government-source facts. | E28, E29, E30, E31 | Generic agent search |

## Red-Team Pass

The strongest contrary evidence against tariff.watch is competition. TariffDesk
already validates the watchlist/dollar-impact buyer. TariffsAPI validates the
developer API/MCP buyer. tariff.watch should treat both as proof of market and a
warning against undifferentiated scope.

The strongest contrary evidence against a Section 122-specific launch is legal
instability. The proclamation created a time-boxed event, but the CIT decision
means the product cannot act as if the only question is "what happens on July
24?" Legal status and appeal/stay tracking are more durable.

The strongest contrary evidence against Shopify-first distribution is that
merchant pain is downstream of calculation and fulfillment. The store owner does
not want another alert. They want correct checkout, no surprise duties, and a
logistics plan. A source feed can support vendors serving those merchants, but
it is not necessarily the merchant app.

The strongest contrary evidence against sanctions as the next probe is
OpenSanctions. It demonstrates demand and also sets a high incumbent bar. A
sanctions product needs a narrow delta, jurisdiction, or verification workflow,
not a broad "database, but smaller" promise.

The strongest contrary evidence against agent distribution is registry noise.
Glama listed more than 33,000 MCP servers at access time. A listing is not
distribution unless the tool solves a precise job and has examples that agents
can use.

## Recommended Strategy Moves

1. Keep tariff.watch, but reposition it as a trade-action evidence layer.
2. Add legal-status fields and effective-date outputs before building more UI.
3. Track the June 2026 USTR forced-labor Section 301 investigations immediately.
4. (Superseded 2026-06-11: usage pricing US$0.10/call adopted instead — see
   metered-pricing-intel.md.) Price the first paid tier around $19/month only after watchlists, calendar,
   and webhook value exist.
5. Defer duty calculation, Shopify checkout, and legal interpretation.
6. Prepare exportcontrols.watch as the next stamp if tariff.watch reaches keep
   criteria or if tariff.watch demand proves weak but the pipeline works.
7. Let netm8 emerge as the shared source policy, API shape, MCP contract, and
   billing shell after the second probe.

## Evidence Gaps To Close Next

- Interview or observe at least five brokers, importers, compliance operators,
  or developer-tool builders.
- Test search demand for effective-date and legal-status pages, not just tariff
  keywords.
- Compare TariffDesk and TariffsAPI onboarding by signing up or using trial
  flows where available.
- Map BIS Entity List, Federal Register, and export-control source schemas in a
  technical spike.
- Collect direct evidence from customs broker communities beyond Shopify.
- Re-run Alpaca market snapshots over a 3, 6, and 12-month window for logistics,
  ecommerce, compliance, and software proxies before using market language in
  external copy.
