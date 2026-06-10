import { describe, expect, it } from "vitest";
import type { TradeDocument } from "../src/federal-register";
import { classifyTradeDocument } from "../src/trade-action";

function doc(overrides: Partial<TradeDocument>): TradeDocument {
	return {
		documentNumber: "2026-55555",
		title: "Notice of Action",
		docType: "Notice",
		abstract: null,
		publicationDate: "2026-06-10",
		url: "https://www.federalregister.gov/d/2026-55555",
		agencies: ["International Trade Commission"],
		sourceQuery: "trade-agencies",
		...overrides,
	};
}

describe("classifyTradeDocument", () => {
	it("applies pinned metadata only to the exact pinned document number", () => {
		const pinned = classifyTradeDocument(
			doc({
				documentNumber: "2026-11296",
				title: "Section 301 Investigations of Forced Labor Import Prohibitions",
				publicationDate: "2026-06-05",
			}),
		);
		expect(pinned).toMatchObject({
			program: "section_301_forced_labor",
			legalStatus: "proposed",
			commentsCloseOn: "2026-07-06",
			hearingOn: "2026-07-07",
			confidence: "high",
		});
	});

	it("never fabricates dates onto future documents in the same docket", () => {
		const future = classifyTradeDocument(
			doc({
				documentNumber: "2026-99999",
				title: "Section 301 Investigation: Final Determination on Forced Labor Import Prohibitions",
				abstract: "Determination concerning imports produced with forced labor.",
				publicationDate: "2026-08-15",
			}),
		);
		expect(future.program).toBe("section_301_forced_labor");
		expect(future.hearingOn).toBeNull();
		expect(future.commentsCloseOn).toBeNull();
		expect(future.confidence).toBe("medium");
	});

	it("keeps source-supplied dates over pinned fallbacks", () => {
		const result = classifyTradeDocument(
			doc({ documentNumber: "2026-11296", publicationDate: "2026-06-05", commentsCloseOn: "2026-07-20" }),
		);
		expect(result.commentsCloseOn).toBe("2026-07-20");
		expect(result.hearingOn).toBe("2026-07-07");
	});

	it("does not infer court statuses from incidental abstract text", () => {
		const sunsetReview = classifyTradeDocument(
			doc({
				title: "Certain Steel Nails From Taiwan; Five-Year (Sunset) Review",
				abstract:
					"The order expires unless revoked; parties may appeal. The Commission requests comments on the review.",
			}),
		);
		expect(sunsetReview.legalStatus).toBe("final");
	});

	it("infers proposed from the document type and effective from a passed effective date", () => {
		expect(classifyTradeDocument(doc({ docType: "Proposed Rule" })).legalStatus).toBe("proposed");
		expect(classifyTradeDocument(doc({ effectiveOn: "2026-06-01", publicationDate: "2026-06-10" })).legalStatus).toBe(
			"effective",
		);
		expect(classifyTradeDocument(doc({ effectiveOn: "2026-07-01", publicationDate: "2026-06-10" })).legalStatus).toBe(
			"final",
		);
	});

	it("scrapes no dates from text: effective dates come only from the source field", () => {
		const result = classifyTradeDocument(
			doc({ abstract: "The modification is effective 2026-09-01 per the proclamation." }),
		);
		expect(result.effectiveOn).toBeNull();
	});
});
