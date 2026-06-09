import { z } from "zod";
import { ApiError } from "./errors";

/**
 * Stripe secrets are provisioned with `wrangler secret put` (production) or
 * `.dev.vars` (local, gitignored) — never in wrangler.jsonc or source.
 * Parsed at request time with zod so a missing secret fails loudly and typed.
 * Prefer a restricted key (rk_…) scoped to Checkout + Billing over sk_.
 */
const stripeSecretsSchema = z.object({
	STRIPE_SECRET_KEY: z.string().min(1),
	STRIPE_WEBHOOK_SECRET: z.string().min(1),
});
export type StripeSecrets = z.infer<typeof stripeSecretsSchema>;

export function getStripeSecrets(env: unknown): StripeSecrets {
	const parsed = stripeSecretsSchema.safeParse(env);
	if (!parsed.success) {
		throw new ApiError(500, "missing_configuration", "Billing is not configured on this deployment.");
	}
	return parsed.data;
}
