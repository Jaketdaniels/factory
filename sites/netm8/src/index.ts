import { Hono } from "hono";
import feedItemV1Schema from "../schemas/feed-item-v1.schema.json";
import { contactPage, homePage, licensingPage, standardsPage } from "./pages";

const app = new Hono<{ Bindings: Env }>()
	.notFound((c) => {
		c.header("cache-control", "public, max-age=300");
		return c.text("Not found. The catalog lives at https://netm8.com/", 404);
	})
	.get("/", (c) => {
		c.header("cache-control", "public, max-age=3600");
		return c.html(homePage());
	})
	.get("/standards", (c) => {
		c.header("cache-control", "public, max-age=3600");
		return c.html(standardsPage());
	})
	// The stable spec URL: programs depend on it, so it is versioned and the
	// v1 path will keep serving the v1 shape forever.
	.get("/standards/feed-item-v1.schema.json", (c) => {
		c.header("cache-control", "public, max-age=3600");
		return c.json(feedItemV1Schema);
	})
	.get("/licensing", (c) => {
		c.header("cache-control", "public, max-age=3600");
		return c.html(licensingPage());
	})
	.get("/contact", (c) => {
		c.header("cache-control", "public, max-age=3600");
		return c.html(contactPage());
	})
	.get("/llms.txt", (c) => {
		c.header("content-type", "text/markdown; charset=utf-8");
		c.header("cache-control", "public, max-age=3600");
		return c.body(`# netm8

Current context APIs for specialist domains. netm8 turns source material into
tailored, source-linked feeds for humans, software, and AI agents. Feed contract
(FeedItemV1 JSON Schema):
https://netm8.com/standards/feed-item-v1.schema.json

Example feeds:
- tariff.watch — US tariff/trade-action context. Agent index: https://tariff.watch/llms.txt
- recalls.netm8.com — FDA recall context. Agent index: https://recalls.netm8.com/llms.txt

The network is designed for many focused feeds across regulation, safety,
trade, licensing, procurement, litigation, market notices, and other specialist
domains where stale context causes mistakes.

Licensing: free reading with attribution; metered machine access per feed;
commercial redistribution licensed (hello@netm8.com). Verify against the
cited source before compliance use.
`);
	});

export type AppType = typeof app;
export default app;
