  

---
  
title: Best-Fit Bright Data Products and Architecture for the netm8 / Factory Probe Use Case   
description: Product selection, ingestion architecture, canonical schema, validation, scoring, and a 30-day execution plan for building primary-source change-tracking feeds.   
tags:  
- bright-data  
- web-scraping  
- data-feeds  
- provenance  
- change-tracking  
- mcp   
- schema_version: FeedItemV1   
- last_updated: 2026-06-11  

---
  
# Best-Fit Bright Data Products and Architecture  
  
This document covers two things: (1) which Bright Data products fit this use case, and (2) the architecture, canonical schema, validation, scoring rubric, and rollout plan for building primary-source, change-tracking feeds for **netm8** and **Factory probes**.  
  
## Table of Contents  
  
- [Part 1: Bright Data Product Selection](#part-1-bright-data-product-selection)  
- [Part 2: Recommended Architecture for netm8](#part-2-recommended-architecture-for-netm8)  
- [Part 3: Feed Contract for netm8](#part-3-feed-contract-for-netm8)  
- [Part 4: Citation, License, and Buyer Policies](#part-4-citation-license-and-buyer-policies)  
- [Part 5: MCP Tool and Billing Conventions](#part-5-mcp-tool-and-billing-conventions)  
- [Part 6: Domain Eligibility and Verticals](#part-6-domain-eligibility-and-verticals)  
- [Part 7: Canonical Schema — FeedItemV1](#part-7-canonical-schema--feeditemv1)  
- [Part 8: Scoring Rubric for Candidate Domains](#part-8-scoring-rubric-for-candidate-domains)  
- [Part 9: 30-Day Shortlist of First Probe Domains](#part-9-30-day-shortlist-of-first-probe-domains)  
- [Part 10: JSON Schema for FeedItemV1](#part-10-json-schema-for-feeditemv1)  
- [Part 11: Scoring Spreadsheet Format](#part-11-scoring-spreadsheet-format)  
- [Part 12: 30-Day Execution Plan](#part-12-30-day-execution-plan)  

---
  
# Part 1: Bright Data Product Selection  
  
## 1. Bright Data MCP Server  
  
Use this when you want AI agents to access public web data in real time through standardized tools.  
  
- **Remote MCP:** fully managed, no setup.  
- **Local MCP:** self-hosted.  
- **Free tier:** 5,000 requests/month shared at the account level.  
- Enable only the tool groups you need to reduce token usage.  
- Best use case is for discovery of potential candidates so that we can then develop our own proprietary MCPs.  
  
**Docs**  
  
- [MCP Server Overview](https://docs.brightdata.com/ai/mcp-server/overview)  
- [MCP tools](https://docs.brightdata.com/ai/mcp-server/tools)  
- [MCP usage examples](https://docs.brightdata.com/ai/mcp-server/usage-examples)  
- [MCP integrations](https://docs.brightdata.com/ai/mcp-server/integrations)  
- [Remote MCP quickstart](https://docs.brightdata.com/ai/mcp-server/remote/quickstart)  
- [Local MCP quickstart](https://docs.brightdata.com/ai/mcp-server/local/quickstart)  
  
## 2. Web Scraper API  
  
Use this when you need structured output from supported sites with minimal maintenance.  
  
- Pre-built, maintained scrapers.  
- Structured JSON output.  
- Better fit for repeatable feeds on known sources.  
- Good for high-volume normalized extraction.  
  
**Docs**  
  
- [Web Scraper API vs DIY scraping](https://docs.brightdata.com/datasets/scrapers/concepts/web-scraper-api-vs-diy)  
- [Scrapers Library overview](https://docs.brightdata.com/datasets/scrapers/scrapers-library/overview)  
- [Quickstart](https://docs.brightdata.com/datasets/scrapers/scrapers-library/quickstart)  
  
## 3. Web Unlocker / Browser API  
  
Use these when a source is public but difficult to extract reliably.  
  
**Docs**  
  
- [Web Unlocker best practices](https://docs.brightdata.com/scraping-automation/web-unlocker/bestpractices)  
- [Browser API introduction](https://docs.brightdata.com/scraping-automation/scraping-browser/introduction)  
  
## 4. Web Archive  
  
Use this for historical backfill and provenance checks.  
  
**Docs**  
  
- [Web Archive overview](https://docs.brightdata.com/datasets/archive/overview)  

---
  
# Part 2: Recommended Architecture for netm8  
  
## Ingestion  
  
Build a source-first pipeline with three tiers.  
  
### Tier 1: Discovery layer  
  
- Identify candidate public sources.  
- Filter by update frequency, authority, and parsing difficulty.  
  
### Tier 2: Collection layer  
  
- Use **Web Scraper API** for supported sites.  
- Use **Browser API** or **Web Unlocker** for hard-to-navigate public pages.  
- Use propriatary **MCP Server** for agent-facing access and retrieval workflows.  
  
### Tier 3: Normalization layer  
  
Convert each source into a canonical record with these fields:  
  
- ==source_url==  
- ==source_name==  
- ==published_at==  
- ==effective_at==  
- ==status==  
- ==change_type==  
- ==summary==  
- ==jurisdiction==  
- ==provenance==  
- ==retrieved_at==  
- ==hash==  
  
Keep raw source snapshots for auditability.  
  
## Change Tracking  
  
For volatile public-source domains like the Federal Register:  
  
- Poll on a schedule based on source volatility.  
- Detect deltas between versions.  
- Record:  
    - rule text changes  
    - status changes  
    - effective date changes  
    - withdrawal / correction / notice transitions  
- Store provenance at the paragraph, section, or document level if possible.  
  
## Provenance Policy  
  
Every output should include:  
  
- primary source citation  
- retrieval timestamp  
- version or snapshot reference  
- exact source URL  
- normalization status  
- confidence or validation state  

---
  
# Part 3: Feed Contract for netm8  
  
Use a strict contract so buyers can automate on top of it.  
  
## Required Fields  
  
- ==id==  
- ==title==  
- ==source_name==  
- ==source_url==  
- ==jurisdiction==  
- ==published_at==  
- ==effective_at==  
- ==status==  
- ==change_type==  
- ==summary==  
- ==citations[]==  
- ==license_note==  
- ==retrieved_at==  
- ==updated_at==  
- ==provenance[]==  
  
## Optional Fields  
  
- ==entity_mentions==  
- ==affected_topics==  
- ==tags==  
- ==version==  
- ==diff_summary==  
- ==confidence==  
- ==raw_snapshot_ref==  
  
## Delivery Formats  
  
- JSON  
- NDJSON  
- Webhook delivery  
- API delivery  
  
If you use Bright Data collection patterns, these formats align well with structured extraction workflows from Bright Data tooling.  

---
  
# Part 4: Citation, License, and Buyer Policies  
  
## Citation Policy  
  
Use a source-first citation policy:  
  
- Cite the original public source, not the normalized summary.  
- Include the exact URL.  
- Include the retrieval date/time.  
- Include the source title and issuing body where available.  
- For changed records, cite both the current and prior versions.  
- Never imply endorsement or legal authority beyond the original source text.  
  
> **Suggested rule:** "Summary generated from primary public source. Verify against cited source before compliance use."  
  

## Source License Policy  
  
Set a conservative policy:  
  
- Prefer primary public sources with clear public access.  
- Store license or reuse notes where available.  
- Do not claim ownership of source text.  
- Publish only summaries, metadata, and derived structure unless the source policy explicitly allows more.  
- Preserve original attribution.  
- Maintain a source-specific usage note when terms are known.  
  
If a source has unclear licensing, keep the output limited to factual summaries and citations.  
  
## Buyer Promises  
  
Make promises that are measurable and defensible:  
  
- Primary-source only.  
- Public and lawful sources only.  
- Timestamped provenance on every record.  
- Normalized, machine-readable output.  
- Change tracking for volatile sources.  
- Source diffs for updated items.  
- Low-latency refresh for monitored feeds.  
- No hidden manual curation without disclosure.  
  
Avoid promising legal interpretation unless you have a separate review layer.  

---
  
# Part 5: MCP Tool and Billing Conventions  
  
## MCP Tool Conventions for netm8  
  
Use MCP as the agent access surface, not as the whole ingestion system.  
  
### Tool naming pattern  
  
- ==search_sources==  
- ==get_source==  
- ==compare_versions==  
- ==list_changes==  
- ==fetch_provenance==  
- ==get_feed==  
- ==get_entity_timeline==  
  
### Tool design rules  
  
- One tool per clear action.  
- Inputs should be explicit and typed.  
- Return normalized data plus provenance.  
- Avoid large unfiltered payloads.  
- Support source group toggles to reduce token usage.  
  
Bright Data MCP docs on tool grouping are relevant here: [MCP tools](https://docs.brightdata.com/ai/mcp-server/tools).  
  
## Billing Model for netm8  
  
Use a metered model with a small free or trial tier if you want adoption.  
  
### Good billing dimensions  
  
- Per source monitored.  
- Per feed delivered.  
- Per document processed.  
- Per change event detected.  
- Per enriched record.  
- Per API call for advanced endpoints.  
  
### Buyer-friendly promise  
  
- Pay for sources actually monitored.  
- Charge more for high-volatility or hard-to-collect sources.  
- Include provenance and change diffs in every paid feed.  
  
Bright Data pricing pages are the right reference if you want to align your own infra usage with Bright Data costs: [Bright Data pricing](https://brightdata.com/pricing).  

---
  
# Part 6: Domain Eligibility and Verticals  
  
## Domain Eligibility Criteria for Factory Probes  
  
### Must have  
  
- Public access.  
- Primary source.  
- Frequent updates.  
- High signal density.  
- Hard-to-navigate structure.  
- Clear legal or public-interest relevance.  
- Stable enough identifiers for tracking.  
  
### Should avoid  
  
- Login-only sources.  
- Sources with unclear reuse rights if you plan to republish content.  
- Sources that are mostly static.  
- Sources whose value is already trivial to scrape.  
- Sources requiring deep personal-data collection.  
  
## Verticals to Shortlist  
  
### 1. Government rulemaking and regulatory change  
  
Best for your Federal Register-style use case. Source types: federal notices, agency rule changes, public comment dockets, enforcement notices, compliance bulletins.  
  
### 2. Trade and customs  
  
Good for high-volatility, public, source-first updates. Examples: tariff notices, customs rulings, import/export classifications, trade remedy actions.  
  
### 3. Procurement and public contracting  
  
Useful for structured but messy public records. Examples: tender notices, award updates, amendments, debarment notices.  
  
### 4. Courts and legal dockets  
  
High-signal, frequently updated, and difficult to normalize. Examples: docket entries, opinions, filings, hearing schedules.  
  
### 5. Financial regulators and disclosures  
  
Good if you want structured event tracking. Examples: filings, enforcement actions, supervisory notices, market alerts.  
  
### 6. Public health and safety notices  
  
Strong for time-sensitive change detection. Examples: recalls, advisories, inspection outcomes, emergency notices.  
  
### 7. Energy and environment  
  
Good for ongoing rule, permit, and status changes. Examples: permits, filings, environmental notices, compliance actions.  
  
## Validation Framework for Candidate Domains  
  
Score each candidate 1–5 on:  
  
- authority  
- update frequency  
- public accessibility  
- structure clarity  
- change detectability  
- provenance strength  
- commercial value  
- legal risk  
- extraction difficulty  
- normalization complexity  
  
Then classify:  
  
- **A-tier:** immediate probe candidate.  
- **B-tier:** good but needs validation.  
- **C-tier:** avoid for now.  
  
## Practical Bright Data Mapping  
  
For implementation:  
  
- Use **MCP Server** for agent-facing candidate discovery and browsing.  
- Use **Web Scraper API** for supported public domains with repeatable structured outputs.  
- Use **Browser API** or **Web Unlocker** for hard public pages.  
- Use **Web Archive** for historical backfill and provenance checks.  
  
**Docs**  
  
- [MCP Server Overview](https://docs.brightdata.com/ai/mcp-server/overview)  
- [Web Scraper API vs DIY scraping](https://docs.brightdata.com/datasets/scrapers/concepts/web-scraper-api-vs-diy)  
- [Browser API introduction](https://docs.brightdata.com/scraping-automation/scraping-browser/introduction)  
- [Web Unlocker best practices](https://docs.brightdata.com/scraping-automation/web-unlocker/bestpractices)  
- [Web Archive overview](https://docs.brightdata.com/datasets/archive/overview)  

---
  
# Part 7: Canonical Schema — FeedItemV1  
  
Design around one canonical record type: a **change event**. Every delivery format should serialize from this same object.  
  
## Core Object: ==FeedItemV1==  
  
```
{
  "id": "string",
  "source": {
    "name": "string",
    "type": "string",
    "jurisdiction": "string",
    "authority": "string",
    "publisher": "string",
    "source_url": "string",
    "source_version_url": "string",
    "source_id": "string"
  },
  "classification": {
    "category": "string",
    "subtype": "string",
    "topics": ["string"],
    "tags": ["string"]
  },
  "status": {
    "state": "string",
    "change_type": "string",
    "is_new": true,
    "is_updated": false,
    "is_withdrawn": false,
    "is_corrected": false
  },
  "dates": {
    "published_at": "2026-06-11T00:00:00Z",
    "effective_at": "2026-06-15T00:00:00Z",
    "updated_at": "2026-06-11T00:00:00Z",
    "retrieved_at": "2026-06-11T00:00:00Z",
    "detected_at": "2026-06-11T00:00:00Z",
    "expires_at": null
  },
  "summary": {
    "title": "string",
    "abstract": "string",
    "short_summary": "string",
    "long_summary": "string"
  },
  "change_tracking": {
    "version": "string",
    "previous_version": "string",
    "diff_summary": "string",
    "diff_fields": ["string"],
    "change_severity": "string",
    "change_notes": "string"
  },
  "provenance": {
    "primary_source_url": "string",
    "snapshot_url": "string",
    "snapshot_hash": "string",
    "retrieval_method": "string",
    "parser_version": "string",
    "confidence": 0.0
  },
  "delivery": {
    "canonical_url": "string",
    "rss_guid": "string",
    "calendar_uid": "string",
    "webhook_event": "string"
  },
  "metrics": {
    "importance_score": 0,
    "recency_score": 0,
    "volatility_score": 0,
    "confidence_score": 0
  },
  "raw": {
    "content_type": "string",
    "raw_snapshot_ref": "string"
  }
}

```
  
  
## Field Intent  
  
### ==source==  
  
Identifies where the record came from.  
  
- ==name==: human-readable source name.  
- ==type==: source class, such as government, regulator, customs, court, registry.  
- ==jurisdiction==: country, state, province, or region.  
- ==authority==: issuing body.  
- ==publisher==: organization hosting the content.  
- ==source_url==: original source page.  
- ==source_version_url==: versioned or archived source URL if available.  
- ==source_id==: stable identifier from the source system.  
  
### ==classification==  
  
Used for routing, filtering, and feeds.  
  
- ==category==: broad domain, such as rulemaking, tariff, enforcement, notice, filing.  
- ==subtype==: narrower type, such as proposed_rule, final_rule, correction, withdrawal.  
- ==topics==: one or more topic labels.  
- ==tags==: free-form machine tags.  
  
### ==status==  
  
Tracks lifecycle.  
  
- ==state==: new, updated, scheduled, effective, superseded, withdrawn, corrected, archived.  
- ==change_type==: created, amended, deleted, moved, reissued, corrected, status_changed.  
- flags: quick booleans for common filtering.  
  
### ==dates==  
  
Normalize all dates to UTC.  
  
- ==published_at==: when the source published the item.  
- ==effective_at==: when the change takes effect.  
- ==updated_at==: last known source modification time.  
- ==retrieved_at==: when Factory fetched it.  
- ==detected_at==: when Factory detected the event.  
- ==expires_at==: if the item has a time-bound validity.  
  
### ==change_tracking==  
  
Critical for deltas.  
  
- ==version==: current source version string or hash.  
- ==previous_version==: prior version reference.  
- ==diff_summary==: human-readable delta.  
- ==diff_fields==: array of changed field names.  
- ==change_severity==: low, medium, high, critical.  
- ==change_notes==: parser or analyst notes.  
  
### ==provenance==  
  
Every output must carry auditability.  
  
- ==primary_source_url==  
- ==snapshot_url==  
- ==snapshot_hash==  
- ==retrieval_method==: api, html, pdf, rss, browser, mcp.  
- ==parser_version==  
- ==confidence==: 0 to 1.  
  
### ==delivery==  
  
Supports multiple downstream formats from one record.  
  
- ==canonical_url==: record page in your system.  
- ==rss_guid==: stable RSS identifier.  
- ==calendar_uid==: calendar event UID when relevant.  
- ==webhook_event==: event name for downstream automation.  
  
## Format-Specific Mapping  
  
### API  
  
Return the full canonical object plus pagination metadata.  
  
```
{
  "data": ["FeedItemV1"],
  "next_cursor": "string",
  "total": 123
}

```
  
  
### Webhooks  
  
Send one event per state transition.  
  
```
{
  "event": "factory.item.updated",
  "id": "string",
  "status": "updated",
  "change_type": "corrected",
  "source_url": "string",
  "effective_at": "string",
  "published_at": "string",
  "diff_summary": "string"
}

```
  
  
### RSS  
  
Map the canonical fields to RSS item fields:  
  
- ==title== → RSS title  
- ==short_summary== → description  
- ==canonical_url== → link  
- ==rss_guid== → guid  
- ==published_at== → pubDate  
- ==effective_at== → custom extension if needed  
- ==source.name== and ==jurisdiction== → category or custom namespace  
  
### Calendar  
  
Only emit calendar entries for time-bound changes.  
  
- ==title== → event title  
- ==effective_at== → start time  
- ==expires_at== → end time if applicable  
- ==summary== → description  
- ==calendar_uid== → UID  
  
### MCP tools  
  
Expose the schema through focused tools:  
  
- ==search_sources==  
- ==get_item==  
- ==list_changes==  
- ==compare_versions==  
- ==get_timeline==  
- ==get_provenance==  
- ==get_feed==  
  
Each tool returns:  
  
1. normalized record  
2. provenance  
3. diff summary  
4. source pointer  
  
## Validation Rules for the Schema  
  
### Required fields  
  
- ==id==  
- ==source.name==  
- ==source.type==  
- ==source.jurisdiction==  
- ==source.authority==  
- ==source.source_url==  
- ==status.state==  
- ==status.change_type==  
- ==dates.published_at==  
- ==dates.retrieved_at==  
- ==summary.title==  
- ==provenance.primary_source_url==  
- ==provenance.snapshot_hash==  
  
### Strongly recommended  
  
- ==effective_at==  
- ==updated_at==  
- ==diff_summary==  
- ==diff_fields==  
- ==confidence==  
- ==source_id==  
  
### Normalization rules  
  
- Dates in UTC ISO-8601.  
- Source URLs must be canonicalized.  
- Versioned content must keep both current and prior snapshot references.  
- Titles should be source-faithful, not editorialized.  
- ==id== must be stable across re-ingests.  

---
  
# Part 8: Scoring Rubric for Candidate Domains  
  
Use a 100-point model.  

| Criterion | Range | Guidance |
| ------------------------ | ----- | ---------------------------------------------------------------------------------------------------------------------------------- |
| A. Authority | 0–20 | 0–5 informal/third-party; 6–10 semi-official; 11–15 official but not primary; 16–20 primary issuing authority. |
| B. Update frequency | 0–15 | 0–3 static; 4–7 monthly; 8–11 weekly; 12–15 daily or near-real-time. |
| C. Public accessibility | 0–10 | 0–3 hard gated; 4–6 mixed; 7–10 public and stable. |
| D. Structure clarity | 0–15 | 0–3 messy/unstructured; 4–7 semi-structured; 8–11 structured with inconsistent markup; 12–15 clear records, IDs, pages, or tables. |
| E. Provenance strength | 0–15 | 0–3 weak; 4–7 partial; 8–11 good; 12–15 strong versioning, citations, timestamps. |
| F. Commercial value | 0–15 | 0–3 low; 4–7 niche; 8–11 useful; 12–15 strong recurring value. |
| G. Extraction difficulty | 0–10 | Lower difficulty scores higher: 0–2 extremely hard; 3–4 hard; 5–6 moderate; 7–8 easy; 9–10 very easy. |
  
  
## Eligibility Thresholds  
  
- **85–100:** Tier A probe candidate.  
- **70–84:** Tier B candidate, validate first.  
- **50–69:** Tier C, only if strategically important.  
- **Below 50:** reject for Factory probes.  
  
## Hard Filters  
  
Reject if any of these are true:  
  
- Login required.  
- Low public relevance.  
- No stable identifiers.  
- No clear primary source.  
- Content is mostly static.  
- Legal or reuse risk is too high.  
- Repeated access is likely to trigger avoidable blocking with no clear workaround.  

---
  
# Part 9: 30-Day Shortlist of First Probe Domains  
  
These are public, high-value, data-rich, and harder than simple static pages.  
  
## Week 1: U.S. Regulatory and Trade Change Sources  
  
### 1. U.S. Customs and Border Protection  
  
- **Focus:** rulings, trade guidance, tariff-related notices, enforcement updates.  
- **Why:** high-value, frequent change, strong commercial relevance.  
- **Probe target:** policy notices, rulings, trade updates, classification guidance.  
  
### 2. U.S. International Trade Commission  
  
- **Focus:** investigations, determinations, trade remedy actions.  
- **Why:** structured, consequential, recurring updates.  
- **Probe target:** investigation status, determination notices, report releases.  
  
### 3. U.S. Department of Commerce  
  
- **Focus:** antidumping/countervailing duty notices, export controls, trade remedy events.  
- **Why:** strong tariff and trade signal.  
- **Probe target:** administrative reviews, final results, scope rulings.  
  
### 4. Federal Communications Commission  
  
- **Focus:** orders, notices, proposed rules, enforcement actions.  
- **Why:** high-volume public docket activity.  
- **Probe target:** docket changes, final orders, rule proposals.  
  
## Week 2: Financial and Market Oversight Sources  
  
### 5. Securities and Exchange Commission  
  
- **Focus:** rulemaking, enforcement, notices, filings metadata.  
- **Why:** high commercial value, strong change tracking.  
- **Probe target:** proposed rules, final rules, enforcement releases.  
  
### 6. Commodity Futures Trading Commission  
  
- **Focus:** rules, advisories, enforcement, exemptions.  
- **Why:** high-signal regulatory change.  
- **Probe target:** rule changes, commission votes, enforcement actions.  
  
### 7. Financial Industry Regulatory Authority  
  
- **Focus:** notices, rule filings, enforcement.  
- **Why:** important market-structure changes.  
- **Probe target:** regulatory notices, rule proposals, disciplinary actions.  
  
## Week 3: Labor, Health, and Environmental Regulation  
  
### 8. Department of Labor  
  
- **Focus:** wage, benefits, ERISA, OSHA-related rule updates.  
- **Why:** broad downstream impact, frequent notices.  
- **Probe target:** final rules, guidance, enforcement releases.  
  
### 9. Environmental Protection Agency  
  
- **Focus:** proposed and final rules, compliance actions, permits.  
- **Why:** detailed public rule changes.  
- **Probe target:** rulemaking dockets, air and water program updates, enforcement notices.  
  
### 10. Occupational Safety and Health Administration  
  
- **Focus:** standards, guidance, inspections, enforcement.  
- **Why:** actionable regulatory change.  
- **Probe target:** standard updates, citations, rulemaking notices.  
  
### 11. Food and Drug Administration  
  
- **Focus:** recalls, guidances, alerts, approvals with structured public notice pages.  
- **Why:** high-value public safety change stream.  
- **Probe target:** safety alerts, guidance documents, recall notices.  
  
## Week 4: State and International Trade / Regulatory Sources  
  
### 12. California Legislative and Regulatory Portals  
  
- **Focus:** rulemaking, administrative notices, agency updates.  
- **Why:** large, high-signal jurisdiction with frequent updates.  
- **Probe target:** state agency rule updates, notices of proposed action, enforcement announcements.  
  
### 13. New York State Regulatory Portals  
  
- **Focus:** agency rules, notices, filings, public hearings.  
- **Why:** dense change activity, public access.  
- **Probe target:** rulemaking notices, hearing schedules, agency advisories.  
  
### 14. European Commission Trade and Regulatory Notices  
  
- **Focus:** implementing acts, consultations, trade measures.  
- **Why:** important global policy signal.  
- **Probe target:** public consultations, delegated acts, trade defense notices.  
  
### 15. UK Government Regulatory Update Pages  
  
- **Focus:** consultations, statutory instruments, agency notices.  
- **Why:** strong public policy stream.  
- **Probe target:** consultations, regulation updates, implementation notices.  
  
## Recommended First-Probe Order  
  
For maximum value in 30 days, start in this order:  
  
1. U.S. Customs and Border Protection  
2. U.S. International Trade Commission  
3. Securities and Exchange Commission  
4. Federal Communications Commission  
5. Department of Commerce  
6. Environmental Protection Agency  
7. Department of Labor  
8. Food and Drug Administration  
9. Commodity Futures Trading Commission  
10. California regulatory portals  
  
This order balances commercial value, update frequency, public accessibility, structured change detection, and coverage diversity.  
  
## Operational Rule for Factory Probes  
  
A domain becomes a Factory probe only if all of the following hold:  
  
- Score is **70+**.  
- Source is primary.  
- At least one stable identifier exists.  
- Repeated change events are expected.  
- Record-level provenance is available or inferable.  
- Downstream users can act on the changes.  
  
## Suggested v1 Output Contract for Buyers  
  
For each feed, expose:  
  
- ==feed_id==  
- ==feed_name==  
- ==jurisdiction==  
- ==source_domain==  
- ==event_count==  
- ==last_updated_at==  
- ==coverage_scope==  
- ==delivery_modes==  
- ==sample_item==  
- ==confidence_policy==  
- ==provenance_policy==  
  
That gives buyers enough to integrate without reading your internal schema.  

---
  
# Part 10: JSON Schema for FeedItemV1  
  
```
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://example.com/schemas/feed-item-v1.schema.json",
  "title": "FeedItemV1",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "id",
    "source",
    "classification",
    "status",
    "dates",
    "summary",
    "provenance"
  ],
  "properties": {
    "id": {
      "type": "string",
      "minLength": 1
    },
    "source": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "name",
        "type",
        "jurisdiction",
        "authority",
        "source_url"
      ],
      "properties": {
        "name": { "type": "string", "minLength": 1 },
        "type": { "type": "string", "minLength": 1 },
        "jurisdiction": { "type": "string", "minLength": 1 },
        "authority": { "type": "string", "minLength": 1 },
        "publisher": { "type": "string" },
        "source_url": { "type": "string", "format": "uri" },
        "source_version_url": { "type": "string", "format": "uri" },
        "source_id": { "type": "string" }
      }
    },
    "classification": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "category",
        "subtype",
        "topics",
        "tags"
      ],
      "properties": {
        "category": { "type": "string", "minLength": 1 },
        "subtype": { "type": "string", "minLength": 1 },
        "topics": {
          "type": "array",
          "items": { "type": "string" }
        },
        "tags": {
          "type": "array",
          "items": { "type": "string" }
        }
      }
    },
    "status": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "state",
        "change_type",
        "is_new",
        "is_updated",
        "is_withdrawn",
        "is_corrected"
      ],
      "properties": {
        "state": {
          "type": "string",
          "enum": [
            "new",
            "updated",
            "scheduled",
            "effective",
            "superseded",
            "withdrawn",
            "corrected",
            "archived"
          ]
        },
        "change_type": {
          "type": "string",
          "enum": [
            "created",
            "amended",
            "deleted",
            "moved",
            "reissued",
            "corrected",
            "status_changed"
          ]
        },
        "is_new": { "type": "boolean" },
        "is_updated": { "type": "boolean" },
        "is_withdrawn": { "type": "boolean" },
        "is_corrected": { "type": "boolean" }
      }
    },
    "dates": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "published_at",
        "retrieved_at"
      ],
      "properties": {
        "published_at": { "type": "string", "format": "date-time" },
        "effective_at": { "type": ["string", "null"], "format": "date-time" },
        "updated_at": { "type": ["string", "null"], "format": "date-time" },
        "retrieved_at": { "type": "string", "format": "date-time" },
        "detected_at": { "type": ["string", "null"], "format": "date-time" },
        "expires_at": { "type": ["string", "null"], "format": "date-time" }
      }
    },
    "summary": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "title",
        "abstract",
        "short_summary",
        "long_summary"
      ],
      "properties": {
        "title": { "type": "string", "minLength": 1 },
        "abstract": { "type": "string" },
        "short_summary": { "type": "string" },
        "long_summary": { "type": "string" }
      }
    },
    "change_tracking": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "version": { "type": "string" },
        "previous_version": { "type": "string" },
        "diff_summary": { "type": "string" },
        "diff_fields": {
          "type": "array",
          "items": { "type": "string" }
        },
        "change_severity": {
          "type": "string",
          "enum": [
            "low",
            "medium",
            "high",
            "critical"
          ]
        },
        "change_notes": { "type": "string" }
      }
    },
    "provenance": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "primary_source_url",
        "snapshot_hash"
      ],
      "properties": {
        "primary_source_url": { "type": "string", "format": "uri" },
        "snapshot_url": { "type": "string", "format": "uri" },
        "snapshot_hash": { "type": "string", "minLength": 1 },
        "retrieval_method": {
          "type": "string",
          "enum": [
            "api",
            "html",
            "pdf",
            "rss",
            "browser",
            "mcp"
          ]
        },
        "parser_version": { "type": "string" },
        "confidence": {
          "type": "number",
          "minimum": 0,
          "maximum": 1
        }
      }
    },
    "delivery": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "canonical_url": { "type": "string", "format": "uri" },
        "rss_guid": { "type": "string" },
        "calendar_uid": { "type": "string" },
        "webhook_event": { "type": "string" }
      }
    },
    "metrics": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "importance_score": { "type": "number" },
        "recency_score": { "type": "number" },
        "volatility_score": { "type": "number" },
        "confidence_score": { "type": "number" }
      }
    },
    "raw": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "content_type": { "type": "string" },
        "raw_snapshot_ref": { "type": "string" }
      }
    }
  }
}

```
  

---
  
# Part 11: Scoring Spreadsheet Format  
  
Use one row per domain. Keep the rubric as columns so scoring stays auditable.  
  
****Recommended Columns****  

| Column                           | Description                      |
| -------------------------------- | -------------------------------- |
| domain                           | Target domain or source name     |
| url                              | Primary source URL               |
| jurisdiction                     | Country / state / region         |
| authority_score_0_20             | Primary authority score          |
| update_frequency_score_0_15      | Change frequency score           |
| public_accessibility_score_0_10  | Access without login score       |
| structure_clarity_score_0_15     | Machine-friendliness score       |
| provenance_strength_score_0_15   | Versioning / traceability score  |
| commercial_value_score_0_15      | Buyer value score                |
| extraction_difficulty_score_0_10 | Ease of extraction score         |
| total_score_100                  | Formula sum of all rubric scores |
| eligibility_tier                 | A, B, C, or Reject               |
| hard_filters_passed              | Yes / No                         |
| stable_identifiers               | Yes / No                         |
| primary_source_confirmed         | Yes / No                         |
| repeat_change_events_expected    | Yes / No                         |
| provenance_available             | Yes / No                         |
| recommended_action               | Probe, Validate first, Reject    |
| notes                            | Short analyst notes              |
| owner                            | Person responsible               |
| last_reviewed_at                 | Review date                      |
  
  
## Formula Layout  
  
Assuming the rubric columns are laid out as:  
  
- ==F== = Authority  
- ==G== = Update frequency  
- ==H== = Public accessibility  
- ==I== = Structure clarity  
- ==J== = Provenance strength  
- ==K== = Commercial value  
- ==L== = Extraction difficulty  
  
**Total score** (Excel):  
  
```
=SUM(F2:L2)

```
  
  
**Eligibility tier** (Excel):  
  
```
=IF(M2="No","Reject",IF(N2="No","Reject",IF(O2="No","Reject",IF(P2="No","Reject",IF(Q2="No","Reject",IF(R2>=85,"Tier A",IF(R2>=70,"Tier B",IF(R2>=50,"Tier C","Reject"))))))))

```
  
  
For cleaner logic, split hard filters into separate columns and compute the tier from the total score only after the filter pass.  
  
## Suggested Spreadsheet Tabs  
  
1. Scoring Matrix  
2. Rubric Definitions  
3. Rejected Sources  
4. Tier A Shortlist  
5. Review Log  

---
  
# Part 12: 30-Day Execution Plan  
  
## Week 1 — Setup and Source Confirmation  
  
**Goal:** Lock the first probe list and confirm each source passes launch criteria.  
  
**Tasks**  
  
- Finalize the first 10 domains.  
- Confirm primary source URLs for each.  
- Verify stable identifiers exist.  
- Verify repeated change events are expected.  
- Define the canonical FeedItemV1 mapping for each source type.  
  
**Milestones**  
  
- Source list approved.  
- Scoring sheet populated for all candidates.  
- At least 10 domains scored.  
- First 5 probe candidates selected.  
  
**Acceptance criteria**  
  
- Each selected domain scores 70+.  
- Each selected domain passes all hard filters.  
- Each selected domain has a stable identifier or equivalent record key.  
- Each selected domain has a documented provenance path.  
- Each selected domain has a source-specific extraction plan.  
  
## Week 2 — Build First Probes  
  
**Goal:** Implement parsers, normalization, and provenance capture for the first probe set.  
  
**Tasks**  
  
- Build extraction logic for 3 to 5 highest-priority domains.  
- Map raw source data into FeedItemV1.  
- Normalize dates to UTC.  
- Populate ==status==, ==change_tracking==, and ==provenance==.  
- Add record-level validation.  
- Add duplicate detection and stable ID checks.  
  
**Milestones**  
  
- First probe pipeline working end to end.  
- Canonical JSON output produced.  
- Validation rules applied.  
  
**Acceptance criteria**  
  
- At least 90% of required fields populated on sample output.  
- Required fields never empty in approved records.  
- Duplicate rate below agreed threshold.  
- Provenance fields always present.  
- Output is stable across repeated test runs.  
  
## Week 3 — Delta Detection and Quality Hardening  
  
**Goal:** Make the probes change-aware and reliable.  
  
**Tasks**  
  
- Add diff logic between current and previous versions.  
- Detect new, updated, withdrawn, corrected, and superseded states.  
- Tune severity scoring.  
- Add monitoring for parse failures and schema drift.  
- Add sampling-based manual review on outputs.  
- Validate data freshness and snapshot integrity.  
  
**Milestones**  
  
- Delta detection active.  
- Change classification validated.  
- First quality review completed.  
  
**Acceptance criteria**  
  
- New vs. updated vs. withdrawn states are correctly classified.  
- Change summaries are human-readable.  
- Confidence scores are populated.  
- Failure cases are logged with source pointers.  
- No silent schema breaks in test runs.  
  
## Week 4 — Launch and Operationalize  
  
**Goal:** Move the first probes into repeatable production operation.  
  
**Tasks**  
  
- Run daily or scheduled refreshes for the first probe set.  
- Confirm delivery mode for each output path.  
- Finalize alerting thresholds.  
- Document source-specific runbooks.  
- Review early production results.  
- Expand to the next 3 to 5 domains if stability is good.  
  
**Milestones**  
  
- First production probe set live.  
- Runbooks completed.  
- Monitoring and alerting active.  
- Second-wave domains selected.  
  
**Acceptance criteria**  
  
- Scheduled runs complete successfully for 5 consecutive cycles or the agreed pilot window.  
- Success rate meets target.  
- Validation failures are either fixed or explicitly accepted.  
- Data is delivered in the intended format.  
- Owners can explain every field in the canonical record.  
  
## Operating Checklist for Every Probe  
  
- [ ] Source is primary.  
- [ ] Score is 70+.  
- [ ] Stable identifier exists.  
- [ ] Provenance is strong.  
- [ ] Change events are expected.  
- [ ] Output maps cleanly to FeedItemV1.  
- [ ] Validation rules are defined.  
- [ ] Delivery mode is agreed.  
- [ ] Owner is assigned.  
