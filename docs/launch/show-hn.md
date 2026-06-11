# Show HN draft — post on the §122 sunset day (~2026-07-24)

Post URL: https://tariff.watch/?ref=hn

## Title

Show HN: Tariff.watch – source-linked changelog of US tariff changes

## Body

US trade rules have changed faster this year than anything I've built
against: the Supreme Court struck the IEEPA tariffs in February, the
Section 122 surcharge sunsets today, de minimis is gone, and USTR opened a
forced-labor Section 301 docket across 60 economies in June. Every LLM I
asked about current tariff rules was confidently out of date.

tariff.watch reads every trade-relevant Federal Register document four
times a day (USTR, CBP, ITA, ITC, BIS, FTZ Board, presidential documents)
and publishes the changes as structured records: program, legal status,
effective date, comment deadline, and a link to the primary document.

Free, no key: the daily snapshot (/snapshot/latest.md — one click copies
the whole thing as markdown for an agent's context), RSS, and a
subscribable .ics calendar of every effective date and comment deadline.

Keyed: a JSON API, an MCP server (tools/list is open; calls use the key),
and the dated snapshot archive — point-in-time records that never change
after their day passes, so software can prove what was known on a date.
First 30 calls are free, then $0.10 per call. No subscription floor.

Design choices that might interest HN: only public-domain primary sources
(17 U.S.C. §105 — no publisher text, so nothing to license or get sued
over); legal statuses are inferred only from fields the source actually
carries (document type, effective date) — never keyword-guessed from
abstracts; docket facts the API lacks are pinned by exact document number
so a future document can never inherit another notice's dates. Stack is a
single Cloudflare Worker + D1 + Stripe Billing Meters; the whole thing is
a monorepo template I stamp new feeds from.

Solo project, first of a planned family of primary-source changefeeds.
Honest limits: US only, Federal Register fields only, statuses are
records of documents rather than legal advice. I'd value feedback on the
evidence fields — what would your agent need that isn't there?

## Checklist

- [ ] Post between 8–10am US Eastern on the sunset day
- [ ] First comment: the calendar link + one real changelog entry
- [ ] Log first-week dials (pageview ref=hn) in the decision log
