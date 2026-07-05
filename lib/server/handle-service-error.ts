import { ServiceError } from "@/lib/server/errors";
import { NextResponse } from "next/server";
import { jsonError, serverError } from "@/lib/server/api-response";

export function handleServiceError(err: unknown): NextResponse {
  if (err instanceof ServiceError) {
    return jsonError(err.message, err.code, err.status);
  }
  console.error("[api]", err);
  return serverError();
}
