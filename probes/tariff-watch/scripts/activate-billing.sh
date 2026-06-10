#!/usr/bin/env bash
set -euo pipefail
# Activate Stripe billing for tariff-watch. Run from probes/tariff-watch/.
#
# Get two values from the Stripe Dashboard (live mode) first:
#
#  1. STRIPE_WEBHOOK_SECRET (whsec_…)
#     https://dashboard.stripe.com/webhooks -> Add destination/endpoint
#       URL:    https://tariff.watch/webhooks/stripe
#       Events: checkout.session.completed, customer.subscription.deleted
#     Copy the signing secret shown after creation.
#
#  2. STRIPE_SECRET_KEY (rk_live_…)
#     https://dashboard.stripe.com/apikeys -> Create restricted key
#       Permissions: Checkout Sessions (Write), Billing meter events (Write)
#
# Secrets are read silently and piped straight to wrangler — never echoed,
# never written to disk.

cd "$(dirname "$0")/.."

read -r -s -p "Paste STRIPE_WEBHOOK_SECRET (whsec_…): " WHSEC
echo
read -r -s -p "Paste STRIPE_SECRET_KEY (rk_live_…): " RKEY
echo

[[ "$WHSEC" == whsec_* ]] || { echo "Error: expected a whsec_… signing secret." >&2; exit 1; }
[[ "$RKEY" == rk_* ]] || { echo "Error: expected a RESTRICTED key (rk_…), not a full secret key." >&2; exit 1; }

printf '%s' "$WHSEC" | npx wrangler secret put STRIPE_WEBHOOK_SECRET
printf '%s' "$RKEY" | npx wrangler secret put STRIPE_SECRET_KEY

echo "Secrets stored. Verifying live checkout…"
sleep 3
RESPONSE=$(curl -sf -X POST -H "content-type: application/json" \
	-d '{"email":"activation-test@tariff.watch"}' https://tariff.watch/billing/checkout)
echo "$RESPONSE"
if [[ "$RESPONSE" == *"checkout.stripe.com"* ]]; then
	echo "✅ Billing is LIVE: checkout sessions are being created."
else
	echo "❌ Checkout did not return a Stripe URL — check the secrets and retry." >&2
	exit 1
fi
