import { ZodError, type ZodSchema } from "zod";
import { NextResponse } from "next/server";
import { badRequest, serverError } from "@/lib/server/api-response";
import { isFirebaseAdminConfigured } from "@/lib/server/env";

export function isErrorResponse(value: unknown): value is Response {
  return value instanceof Response;
}

export function ensureFirebaseConfigured(): NextResponse | null {
  if (!isFirebaseAdminConfigured()) {
    return serverError("Firebase Admin is not configured");
  }
  return null;
}

export async function parseJsonBody<T>(
  request: Request,
  schema: ZodSchema<T>,
): Promise<T | NextResponse> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  try {
    return schema.parse(json);
  } catch (err) {
    if (err instanceof ZodError) {
      const message = err.issues.map((i) => i.message).join("; ");
      return badRequest(message || "Validation failed");
    }
    return badRequest("Validation failed");
  }
}

export function parseQueryParams<T>(
  request: Request,
  schema: ZodSchema<T>,
): T | NextResponse {
  try {
    const url = new URL(request.url);
    const raw = Object.fromEntries(url.searchParams.entries());
    return schema.parse(raw);
  } catch (err) {
    if (err instanceof ZodError) {
      const message = err.issues.map((i) => i.message).join("; ");
      return badRequest(message || "Invalid query parameters");
    }
    return badRequest("Invalid query parameters");
  }
}
