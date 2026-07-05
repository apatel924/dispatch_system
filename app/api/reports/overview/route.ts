import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { handleServiceError } from "@/lib/server/handle-service-error";
import { ADMIN_ROLES } from "@/lib/server/roles";
import {
  ensureFirebaseConfigured,
  isErrorResponse,
  parseQueryParams,
} from "@/lib/server/route-utils";
import { getReportsOverview } from "@/lib/server/services/reports";
import { ReportsOverviewQuerySchema } from "@/lib/server/validation/reports";

export async function GET(request: Request) {
  const configError = ensureFirebaseConfigured();
  if (configError) return configError;

  const user = await requireRole(request, ADMIN_ROLES);
  if (isErrorResponse(user)) return user;

  const query = parseQueryParams(request, ReportsOverviewQuerySchema);
  if (isErrorResponse(query)) return query;

  try {
    const overview = await getReportsOverview(query);
    return NextResponse.json({ overview });
  } catch (err) {
    return handleServiceError(err);
  }
}
