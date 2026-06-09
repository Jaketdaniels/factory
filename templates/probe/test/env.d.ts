import type { D1Migration } from "@cloudflare/vitest-pool-workers";

declare global {
	namespace Cloudflare {
		interface Env {
			TEST_MIGRATIONS: D1Migration[];
			STRIPE_SECRET_KEY: string;
			STRIPE_WEBHOOK_SECRET: string;
		}
	}
}
