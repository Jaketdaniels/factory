import { createExecutionContext, createScheduledController, env, SELF, waitOnExecutionContext } from "cloudflare:test";
import { createApiKey } from "@factory/core";
import { beforeEach, describe, expect, it } from "vitest";
import worker from "../src/index";

async function clearTables(): Promise<void> {
	for (const table of ["usage_events", "provisioned_keys", "analytics_events", "api_keys"]) {
		await env.DB.prepare(`DELETE FROM ${table}`).run();
	}
}

function echoRequest(key?: string, message = "hello"): Request {
	const headers: Record<string, string> = { "content-type": "application/json" };
	if (key !== undefined) {
		headers.authorization = `Bearer ${key}`;
	}
	return new Request("https://example.com/v1/echo", {
		method: "POST",
		headers,
		body: JSON.stringify({ message }),
	});
}

describe("public routes", () => {
	it("serves the landing page", async () => {
		const res = await SELF.fetch("https://example.com/");
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/html");
		const html = await res.text();
		expect(html).toContain("probe-template");
		expect(html).toContain('role="tablist" aria-label="Pricing plans"');
		expect(html).toContain("Pay as you go");
		expect(html).toContain("Fixed rate - monthly");
		expect(html).toContain("Fixed rate - annual");
		expect(html).toContain("Launch access is free while Stripe billing is verified.");
		expect(html).toContain('aria-label="Email for selected plan"');
		expect(html).not.toContain('class="plan"');
	});

	it("reports health", async () => {
		const res = await SELF.fetch("https://example.com/healthz");
		expect(res.status).toBe(200);
		await expect(res.json()).resolves.toEqual({ ok: true });
	});

	it("returns structured 404s", async () => {
		const res = await SELF.fetch("https://example.com/nope");
		expect(res.status).toBe(404);
		const body = (await res.json()) as { error: { code: string } };
		expect(body.error.code).toBe("not_found");
	});
});

describe("metered API", () => {
	beforeEach(clearTables);

	it("rejects requests without a key", async () => {
		const res = await SELF.fetch(echoRequest());
		expect(res.status).toBe(401);
	});

	it("rejects unknown keys", async () => {
		const res = await SELF.fetch(echoRequest("fk_unknown"));
		expect(res.status).toBe(401);
	});

	it("echoes for a valid key and reports remaining quota", async () => {
		const { rawKey } = await createApiKey(env.DB, { plan: "free", monthlyQuota: 10 });
		const res = await SELF.fetch(echoRequest(rawKey, "ping"));
		expect(res.status).toBe(200);
		await expect(res.json()).resolves.toEqual({ echo: "ping", plan: "free", remaining: 9 });
	});

	it("validates the request body without billing the rejected request", async () => {
		const { rawKey } = await createApiKey(env.DB, { plan: "free", monthlyQuota: 10 });
		const res = await SELF.fetch(
			new Request("https://example.com/v1/echo", {
				method: "POST",
				headers: { authorization: `Bearer ${rawKey}`, "content-type": "application/json" },
				body: JSON.stringify({ message: "" }),
			}),
		);
		expect(res.status).toBe(400);
		// Validator runs before metered(): malformed requests never consume quota.
		const usage = await env.DB.prepare("SELECT id FROM usage_events").all();
		expect(usage.results).toHaveLength(0);
	});

	it("runs the scheduled handler and records the cron tick", async () => {
		const ctx = createExecutionContext();
		const controller = createScheduledController({ cron: "0 6 * * *" });
		await worker.scheduled(controller, env, ctx);
		await waitOnExecutionContext(ctx);
		const events = await env.DB.prepare("SELECT name, props FROM analytics_events WHERE name = 'cron_tick'").all();
		expect(events.results).toHaveLength(1);
	});

	it("enforces the monthly quota with 429", async () => {
		const { rawKey } = await createApiKey(env.DB, { plan: "free", monthlyQuota: 2 });
		expect((await SELF.fetch(echoRequest(rawKey))).status).toBe(200);
		expect((await SELF.fetch(echoRequest(rawKey))).status).toBe(200);
		const blocked = await SELF.fetch(echoRequest(rawKey));
		expect(blocked.status).toBe(429);
		const body = (await blocked.json()) as { error: { code: string } };
		expect(body.error.code).toBe("quota_exceeded");
	});
});
