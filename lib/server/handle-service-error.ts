import { ServiceError } from "@/lib/server/errors";
import { OrderStatusConflict } from "@/lib/order-status";
import { NextResponse } from "next/server";
import { jsonError, serverError } from "@/lib/server/api-response";

export function handleServiceError(err: unknown): NextResponse {
  if (err instanceof ServiceError) {
    return jsonError(err.message, err.code, err.status);
  }
  if (err instanceof OrderStatusConflict) {
    return jsonError(err.message, err.code, err.httpStatus);
  }

  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code?: unknown }).code ?? "")
      : "";
  console.error(
    "[api]",
    JSON.stringify({
      message: err instanceof Error ? err.message : "unknown_error",
      firebaseCode: code || undefined,
    }),
  );
  return serverError();
}
