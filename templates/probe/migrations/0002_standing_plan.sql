-- The 'standing' plan can't widen api_keys' original CHECK(plan IN
-- ('free','pro')) by table rebuild: D1 rolls back any migration that drops a
-- table with FK children (verified live, code 7500). Instead keys gain a
-- nullable tier column that, when set, supersedes plan — core writes both
-- (legacy-safe plan + exact tier) and reads COALESCE(tier, plan).
ALTER TABLE api_keys ADD COLUMN tier TEXT CHECK (tier IN ('free', 'pro', 'standing'));
