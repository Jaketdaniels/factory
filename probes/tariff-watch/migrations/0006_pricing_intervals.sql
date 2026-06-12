-- Public checkout choices now distinguish fixed monthly from fixed annual.
-- The reservation plan remains payg/standing for compatibility with the key
-- tier model; billing_interval carries the selected fixed-rate cadence.
ALTER TABLE provisioned_keys ADD COLUMN billing_interval TEXT NOT NULL DEFAULT 'usage' CHECK (billing_interval IN ('usage', 'monthly', 'annual'));
