import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { handleServiceError } from "@/lib/server/handle-service-error";
import {
  ensureFirebaseConfigured,
  isErrorResponse,
  parseJsonBody,
} from "@/lib/server/route-utils";
import { importOrders } from "@/lib/server/services/import";
import { OrderImportSchema } from "@/lib/server/validation/import";

const IMPORT_ROLES = ["admin"] as const;

export async function POST(request: Request) {
  const configError = ensureFirebaseConfigured();
  if (configError) return configError;

  const user = await requireRole(request, IMPORT_ROLES);
  if (isErrorResponse(user)) return user;

  const body = await parseJsonBody(request, OrderImportSchema);
  if (isErrorResponse(body)) return body;

  try {
    const result = await importOrders(body, user);
    return NextResponse.json(
      {
        imported: result.imported,
        orders: result.orders,
        errors: result.errors.length > 0 ? result.errors : undefined,
        log: result.log,
      },
      { status: result.imported > 0 ? 201 : 200 },
    );
  } catch (err) {
    return handleServiceError(err);
  }
}
