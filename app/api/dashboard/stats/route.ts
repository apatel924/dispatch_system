import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { handleServiceError } from "@/lib/server/handle-service-error";
import { ADMIN_ROLES } from "@/lib/server/roles";
import { ensureFirebaseConfigured, isErrorResponse } from "@/lib/server/route-utils";
import { getDashboardStats } from "@/lib/server/services/dashboard-stats";

export async function GET(request: Request) {
  const configError = ensureFirebaseConfigured();
  if (configError) return configError;

  const user = await requireRole(request, ADMIN_ROLES);
  if (isErrorResponse(user)) return user;

  try {
    const stats = await getDashboardStats();
    return NextResponse.json({ stats });
  } catch (err) {
    return handleServiceError(err);
  }
}
