import { z } from "zod";
import { getTradeAction, listTradeActions } from "./trade-action";

export const MCP_PROTOCOL_VERSION = "2025-06-18";

const jsonRpcIdSchema = z.union([z.string(), z.number(), z.null()]);
const mcpRequestSchema = z.object({
	jsonrpc: z.literal("2.0"),
	id: jsonRpcIdSchema.optional(),
	method: z.string(),
	params: z.unknown().optional(),
});
const sinceLimitSchema = z.object({
	since: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/)
		.default("1970-01-01"),
	limit: z.coerce.number().int().min(1).max(50).default(25),
});
const sourceArgsSchema = z.object({ document_number: z.string().min(1) });

type JsonRpcId = z.infer<typeof jsonRpcIdSchema>;

interface JsonRpcResponse {
	jsonrpc: "2.0";
	id: JsonRpcId;
	result?: unknown;
	error?: { code: number; message: string };
}

// Tool names stay within [a-zA-Z0-9_-]: several MCP hosts reject dots.
const tools = [
	{
		name: "tariffs_list_changes",
		description: "List source-linked tariff, customs, and trade-action changes.",
		inputSchema: {
			type: "object",
			properties: {
				since: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
				limit: { type: "integer", minimum: 1, maximum: 50, default: 25 },
			},
		},
	},
	{
		name: "tariffs_effective_dates",
		description:
			"List effective dates, comment deadlines, and hearings carried by trade actions published since a date.",
		inputSchema: {
			type: "object",
			properties: {
				since: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
				limit: { type: "integer", minimum: 1, maximum: 50, default: 25 },
			},
		},
	},
	{
		name: "tariffs_get_source",
		description: "Get one trade-action source record by Federal Register document number.",
		inputSchema: {
			type: "object",
			properties: {
				document_number: { type: "string" },
			},
			required: ["document_number"],
		},
	},
] as const;

function response(id: JsonRpcId, result: unknown): JsonRpcResponse {
	return { jsonrpc: "2.0", id, result };
}

function error(id: JsonRpcId, code: number, message: string): JsonRpcResponse {
	return { jsonrpc: "2.0", id, error: { code, message } };
}

function toolResult(structuredContent: unknown): {
	content: { type: "text"; text: string }[];
	structuredContent: unknown;
} {
	return {
		content: [{ type: "text", text: JSON.stringify(structuredContent, null, 2) }],
		structuredContent,
	};
}

export async function handleMcpJsonRpc(db: D1Database, body: unknown): Promise<JsonRpcResponse | null> {
	// Errors stay in-band as JSON-RPC error objects; a malformed request must
	// never surface as an opaque HTTP 500 to an MCP client.
	const parsedRequest = mcpRequestSchema.safeParse(body);
	if (!parsedRequest.success) {
		return error(null, -32600, "Invalid JSON-RPC request.");
	}
	const request = parsedRequest.data;
	const id = request.id ?? null;

	if (request.method === "notifications/initialized") {
		return null;
	}
	if (request.method === "initialize") {
		return response(id, {
			protocolVersion: MCP_PROTOCOL_VERSION,
			capabilities: { tools: {} },
			serverInfo: { name: "tariff-watch", version: "0.1.0" },
		});
	}
	if (request.method === "ping") {
		return response(id, {});
	}
	if (request.method === "tools/list") {
		return response(id, { tools: [...tools] });
	}
	if (request.method === "tools/call") {
		const params = z.object({ name: z.string(), arguments: z.unknown().optional() }).safeParse(request.params);
		if (!params.success) {
			return error(id, -32602, "tools/call params require a string tool name.");
		}
		const { name } = params.data;
		if (name === "tariffs_list_changes" || name === "tariffs_effective_dates") {
			const args = sinceLimitSchema.safeParse(params.data.arguments ?? {});
			if (!args.success) {
				return error(id, -32602, "Invalid arguments: since is YYYY-MM-DD; limit is an integer from 1 to 50.");
			}
			const actions = await listTradeActions(db, args.data);
			if (name === "tariffs_list_changes") {
				return response(id, toolResult({ changes: actions }));
			}
			const dates = actions.flatMap((action) => [
				...(action.effective_on === null
					? []
					: [
							{
								date: action.effective_on,
								kind: "effective",
								document_number: action.document_number,
								title: action.title,
							},
						]),
				...(action.comments_close_on === null
					? []
					: [
							{
								date: action.comments_close_on,
								kind: "comment_due",
								document_number: action.document_number,
								title: action.title,
							},
						]),
				...(action.hearing_on === null
					? []
					: [
							{
								date: action.hearing_on,
								kind: "hearing",
								document_number: action.document_number,
								title: action.title,
							},
						]),
			]);
			return response(id, toolResult({ dates }));
		}
		if (name === "tariffs_get_source") {
			const args = sourceArgsSchema.safeParse(params.data.arguments ?? {});
			if (!args.success) {
				return error(id, -32602, "Invalid arguments: document_number is required.");
			}
			const source = await getTradeAction(db, args.data.document_number);
			if (source === null) {
				return error(id, -32004, `No source found for ${args.data.document_number}.`);
			}
			return response(id, toolResult({ source }));
		}
		return error(id, -32602, `Unknown tool: ${name}`);
	}

	return error(id, -32601, `Unknown method: ${request.method}`);
}
