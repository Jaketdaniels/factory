import { z } from "zod";
import type { Plan } from "./keys";

export const checkoutPlanSchema = z.enum(["payg", "fixed_monthly", "fixed_annual"]);
export type CheckoutPlan = z.infer<typeof checkoutPlanSchema>;

export const billingModeSchema = z.enum(["free_launch", "paid"]);
export type BillingMode = z.infer<typeof billingModeSchema>;

export const billingIntervalSchema = z.enum(["usage", "monthly", "annual"]);
export type BillingInterval = z.infer<typeof billingIntervalSchema>;

export const reservationPlanSchema = z.enum(["payg", "standing"]);
export type ReservationPlan = z.infer<typeof reservationPlanSchema>;

export interface CheckoutProvisioning {
	reservationPlan: ReservationPlan;
	keyPlan: Plan;
	billingInterval: BillingInterval;
}

export function provisioningForCheckoutPlan(plan: CheckoutPlan): CheckoutProvisioning {
	switch (plan) {
		case "fixed_monthly":
			return { reservationPlan: "standing", keyPlan: "standing", billingInterval: "monthly" };
		case "fixed_annual":
			return { reservationPlan: "standing", keyPlan: "standing", billingInterval: "annual" };
		case "payg":
			return { reservationPlan: "payg", keyPlan: "pro", billingInterval: "usage" };
	}
}

export function checkoutPlanFromMetadata(value: string | undefined): CheckoutPlan {
	if (value === "standing") {
		return "fixed_monthly";
	}
	const parsed = checkoutPlanSchema.safeParse(value);
	return parsed.success ? parsed.data : "payg";
}
