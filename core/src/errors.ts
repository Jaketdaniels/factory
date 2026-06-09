import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

/** Structured API error carrying an HTTP status and a stable machine-readable code. */
export class ApiError extends Error {
	readonly status: ContentfulStatusCode;
	readonly code: string;

	constructor(status: ContentfulStatusCode, code: string, message: string) {
		super(message);
		this.name = "ApiError";
		this.status = status;
		this.code = code;
	}
}

export interface ErrorBody {
	error: { code: string; message: string };
}

export function errorBody(code: string, message: string): ErrorBody {
	return { error: { code, message } };
}

/**
 * Hono `app.onError` handler producing structured JSON errors.
 * ApiError surfaces its own status/code; everything else is a sanitized 500
 * (never leak internal messages, secrets, or stack traces to callers).
 */
export function onApiError(err: Error, c: Context): Response {
	if (err instanceof ApiError) {
		return c.json(errorBody(err.code, err.message), err.status);
	}
	console.error(JSON.stringify({ event: "unhandled_error", message: err.message }));
	return c.json(errorBody("internal_error", "Something went wrong."), 500);
}
