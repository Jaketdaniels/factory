import type { PublicTradeAction } from "./trade-action";

interface CalendarEvent {
	date: string;
	kind: "effective" | "comment_due" | "hearing";
	label: string;
	action: PublicTradeAction;
}

export function escapeXml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&apos;");
}

function rfc822Date(isoDate: string): string {
	return new Date(`${isoDate}T12:00:00Z`).toUTCString();
}

function compactDate(isoDate: string): string {
	return isoDate.replaceAll("-", "");
}

function escapeIcsText(value: string): string {
	return value
		.replaceAll("\\", "\\\\")
		.replaceAll(";", "\\;")
		.replaceAll(",", "\\,")
		.replaceAll("\r\n", "\\n")
		.replaceAll("\n", "\\n");
}

function calendarEventsFor(action: PublicTradeAction): CalendarEvent[] {
	const events: CalendarEvent[] = [];
	if (action.effective_on !== null) {
		events.push({ action, date: action.effective_on, kind: "effective", label: "Effective date" });
	}
	if (action.comments_close_on !== null) {
		events.push({ action, date: action.comments_close_on, kind: "comment_due", label: "Comment deadline" });
	}
	if (action.hearing_on !== null) {
		events.push({ action, date: action.hearing_on, kind: "hearing", label: "Hearing" });
	}
	return events;
}

export function renderRssFeed(actions: PublicTradeAction[], baseUrl: string): string {
	const items = actions
		.map((action) => {
			const dates = [
				`published ${action.publication_date}`,
				action.effective_on === null ? null : `effective ${action.effective_on}`,
				action.comments_close_on === null ? null : `comments due ${action.comments_close_on}`,
				action.hearing_on === null ? null : `hearing ${action.hearing_on}`,
			]
				.filter((date): date is string => date !== null)
				.join("; ");
			return `<item>
  <title>${escapeXml(action.title)}</title>
  <link>${escapeXml(action.url)}</link>
  <guid isPermaLink="false">${escapeXml(action.source.id)}</guid>
  <pubDate>${rfc822Date(action.publication_date)}</pubDate>
  <description>${escapeXml(`${action.program} | ${action.legal_status} | ${dates}`)}</description>
</item>`;
		})
		.join("\n");

	return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>tariff.watch trade-action evidence feed</title>
  <link>${escapeXml(baseUrl)}</link>
  <description>Source-linked US tariff, customs, and trade-action changes with legal status and effective dates.</description>
${items}
</channel>
</rss>
`;
}

export function renderCalendar(actions: PublicTradeAction[], generatedAt: Date): string {
	const dtstamp = generatedAt
		.toISOString()
		.replaceAll("-", "")
		.replaceAll(":", "")
		.replace(/\.\d{3}Z$/, "Z");
	const events = actions.flatMap(calendarEventsFor).map((event) => {
		const date = compactDate(event.date);
		return [
			"BEGIN:VEVENT",
			`UID:${event.action.document_number}-${event.kind}-${date}@tariff.watch`,
			`DTSTAMP:${dtstamp}`,
			`DTSTART;VALUE=DATE:${date}`,
			`SUMMARY:${escapeIcsText(`${event.label}: ${event.action.title}`)}`,
			`DESCRIPTION:${escapeIcsText(`${event.action.program} | ${event.action.legal_status} | ${event.action.url}`)}`,
			`URL:${event.action.url}`,
			"END:VEVENT",
		].join("\r\n");
	});

	return [
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//tariff.watch//Trade Action Evidence Calendar//EN",
		"CALSCALE:GREGORIAN",
		"METHOD:PUBLISH",
		"X-WR-CALNAME:tariff.watch trade-action dates",
		...events,
		"END:VCALENDAR",
		"",
	].join("\r\n");
}
