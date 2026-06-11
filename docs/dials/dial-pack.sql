-- tariff.watch dial pack — run weekly (same queries, logged in
-- docs/development-plan.md decision log) and on the kill date 2026-07-25.
--   CMD=$(grep -v '^--' docs/dials/dial-pack.sql | tr '\n' ' ')
--   npx wrangler d1 execute tariff-watch --remote --json --command "$CMD" \
--     | jq -r '.[].results[] | "\(.dial): \(.value)"'
--   (file mode only returns a batch summary; command mode returns rows)
-- Stripe side (read-only): active subscription count from the dashboard
-- Billing overview, or `stripe subscriptions list --limit 100`.
-- Kill dials (2026-07-25): >=200 organic visits/week OR >=5 keys OR >=1 paying key.
-- Statements are standalone: D1 rejects long compound SELECTs.

SELECT 'visits_7d' AS dial, COUNT(*) AS value FROM analytics_events WHERE name = 'pageview' AND created_at >= datetime('now', '-7 days');
SELECT 'visits_by_ref_7d' AS dial, COUNT(*) AS value FROM analytics_events WHERE name = 'pageview' AND created_at >= datetime('now', '-7 days') AND json_extract(props, '$.ref') IS NOT NULL;
SELECT 'keys_total' AS dial, COUNT(*) AS value FROM api_keys WHERE status = 'active';
SELECT 'keys_standing' AS dial, COUNT(*) AS value FROM api_keys WHERE status = 'active' AND COALESCE(tier, plan) = 'standing';
SELECT 'keys_paying' AS dial, COUNT(*) AS value FROM api_keys WHERE status = 'active' AND stripe_customer_id IS NOT NULL;
SELECT 'calls_7d' AS dial, COALESCE(SUM(qty), 0) AS value FROM usage_events WHERE created_at >= datetime('now', '-7 days');
SELECT 'watchlists' AS dial, COUNT(*) AS value FROM watchlists;
SELECT 'alerts_7d' AS dial, COUNT(*) AS value FROM alert_events WHERE created_at >= datetime('now', '-7 days');
SELECT 'checkouts_started_7d' AS dial, COUNT(*) AS value FROM analytics_events WHERE name = 'checkout_started' AND created_at >= datetime('now', '-7 days');
SELECT 'keys_claimed_7d' AS dial, COUNT(*) AS value FROM provisioned_keys WHERE claimed_at >= datetime('now', '-7 days');
