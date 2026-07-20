import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "./auth";
import { LedgerError, isContentionError } from "./ledger";

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function apiError(
  status: number,
  code: string,
  message: string
): NextResponse {
  return NextResponse.json({ error: message, code }, { status });
}

/** Converts any thrown error into a structured API response. */
export function handleError(err: unknown): NextResponse {
  if (err instanceof AuthError) {
    return apiError(err.status, err.code, err.message);
  }
  if (err instanceof ZodError) {
    const message = err.issues
      .map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
      .join("; ");
    return apiError(400, "VALIDATION_ERROR", message);
  }
  if (err instanceof LedgerError) {
    if (isContentionError(err)) {
      return apiError(409, "LEDGER_CONTENTION", "Ledger contention; retry.");
    }
    return apiError(502, "LEDGER_ERROR", "Ledger unreachable or returned error.");
  }
  console.error("[API]", err);
  return apiError(500, "INTERNAL", "Internal server error");
}
