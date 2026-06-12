-- Public checkout choices: pay as you go, fixed monthly, fixed annual.
-- Keys still use the legacy-safe api_keys plan/tier shape; reservations keep
-- the checkout interval so paid-mode webhooks and free-launch reservations
-- provision the same key tier.
ALTER TABLE provisioned_keys ADD COLUMN plan TEXT NOT NULL DEFAULT 'payg' CHECK (plan IN ('payg', 'standing'));
ALTER TABLE provisioned_keys ADD COLUMN billing_interval TEXT NOT NULL DEFAULT 'usage' CHECK (billing_interval IN ('usage', 'monthly', 'annual'));
