import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { handleServiceError } from "@/lib/server/handle-service-error";
import {
  ensureFirebaseConfigured,
  isErrorResponse,
  parseQueryParams,
} from "@/lib/server/route-utils";
import { listImportLogs } from "@/lib/server/services/import";
import { ListImportLogsQuerySchema } from "@/lib/server/validation/import";

const IMPORT_ROLES = ["admin"] as const;

export async function GET(request: Request) {
  const configError = ensureFirebaseConfigured();
  if (configError) return configError;

  const user = await requireRole(request, IMPORT_ROLES);
  if (isErrorResponse(user)) return user;

  const query = parseQueryParams(request, ListImportLogsQuerySchema);
  if (isErrorResponse(query)) return query;

  try {
    const result = await listImportLogs(query);
    return NextResponse.json(result);
  } catch (err) {
    return handleServiceError(err);
  }
}
