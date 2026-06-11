import { describe, expect, it } from "vitest";
import { keyCreatedEmail } from "../src/email";

describe("keyCreatedEmail", () => {
	it("states the public pay-as-you-go pricing", () => {
		const email = keyCreatedEmail({
			to: "buyer@example.com",
			baseUrl: "https://tariff.watch",
			freeQuota: 30,
		});

		expect(email.subject).toBe("Your tariff.watch API key is active");
		expect(email.text).toContain("your first 30 API calls are free");
		expect(email.text).toContain("month\n  of daily updates");
		expect(email.text).toContain("US$0.10 per API call");
		expect(email.text).not.toContain("each month are free");
		expect(email.text).toContain("Cancel anytime");
		expect(email.text).not.toContain("US$2");
		expect(email.html).toContain("US$0.10 per API call");
	});
});
