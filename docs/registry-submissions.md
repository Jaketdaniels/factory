# MCP Registry Submissions — tariff.watch

Server card: [probes/tariff-watch/server.json](../probes/tariff-watch/server.json)
(official schema 2025-12-11), also served live at
`https://tariff.watch/.well-known/mcp.json`. Listing copy lives in the card's
`description`.

| Registry | Mechanism | Status |
| --- | --- | --- |
| Official MCP Registry (registry.modelcontextprotocol.io) | `mcp-publisher` via GitHub Actions OIDC — automated in CI (`publish-mcp` job) whenever server.json changes; namespace `io.github.Jaketdaniels/*` | Filed automatically on merge (2026-06-12); check the ci run + `https://registry.modelcontextprotocol.io/v0/servers?search=tariff` |
| PulseMCP | Aggregates from the official registry (per registry docs, registry-aggregators.mdx) | Inherited from official publish — verify listing after propagation |
| Glama | Aggregates from the official registry + GitHub crawl | Inherited — verify after propagation |
| Smithery | Requires a Smithery account (GitHub app install) and smithery.yaml for hosted servers; URL-listing of remote servers via their dashboard | Account-gated: needs a one-time human sign-in at smithery.ai, then "Add server" with `https://tariff.watch/mcp` |
| Claude Connectors Directory | Anthropic submission form (company account) | Account-gated: submit at the directory's "Submit a connector" form with the server card values |

Notes:

- The official registry is the load-bearing listing: the major aggregators
  consume it, so one automated publish covers most distribution.
- The two account-gated rows need a human once; everything they ask for is in
  server.json (name, description, URL, auth note).
- Version bumps: edit `version` in server.json and merge — CI republishes.
