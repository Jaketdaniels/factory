import type { EnforcementRecord } from "../src/openfda";

export function sampleRecord(recallNumber: string, overrides: Partial<EnforcementRecord> = {}): EnforcementRecord {
	return {
		recall_number: recallNumber,
		event_id: "98928",
		status: "Ongoing",
		classification: "Class I",
		product_type: "Food",
		product_description: "Butter Parsley Bagel Crisps, Item Number 18490",
		reason_for_recall: "Made with recalled milk powder",
		recalling_firm: "Legacy Bakehouse LLC",
		distribution_pattern: "PA, WI",
		recall_initiation_date: "20260505",
		report_date: "20260603",
		voluntary_mandated: "Voluntary: Firm initiated",
		state: "WI",
		country: "United States",
		...overrides,
	};
}
