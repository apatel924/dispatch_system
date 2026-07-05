import { NextResponse } from "next/server";
import type { ApiErrorResponse } from "@/lib/types/backend";

export function jsonError(
  message: string,
  code: string,
  status: number,
): NextResponse<ApiErrorResponse> {
  return NextResponse.json({ error: message, code }, { status });
}

export function unauthorized(message = "Unauthorized"): NextResponse<ApiErrorResponse> {
  return jsonError(message, "UNAUTHORIZED", 401);
}

export function forbidden(message = "Forbidden"): NextResponse<ApiErrorResponse> {
  return jsonError(message, "FORBIDDEN", 403);
}

export function badRequest(message: string): NextResponse<ApiErrorResponse> {
  return jsonError(message, "BAD_REQUEST", 400);
}

export function notFound(message: string): NextResponse<ApiErrorResponse> {
  return jsonError(message, "NOT_FOUND", 404);
}

export function serverError(message = "Internal server error"): NextResponse<ApiErrorResponse> {
  return jsonError(message, "INTERNAL_ERROR", 500);
}
