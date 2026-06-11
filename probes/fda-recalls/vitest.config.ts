import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => {
	const migrations = await readD1Migrations("./migrations");
	return {
		plugins: [
			cloudflareTest({
				wrangler: { configPath: "./wrangler.jsonc" },
				miniflare: {
					bindings: {
						TEST_MIGRATIONS: migrations,
						// Test-only doubles; real secrets live in .dev.vars / wrangler secret.
						STRIPE_SECRET_KEY: "rk_test_dummy",
						STRIPE_WEBHOOK_SECRET: "whsec_test_secret",
					},
				},
			}),
		],
		test: {
			setupFiles: ["./test/apply-migrations.ts"],
		},
	};
});
