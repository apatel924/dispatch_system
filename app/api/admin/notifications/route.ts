import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { handleServiceError } from "@/lib/server/handle-service-error";
import {
  ensureFirebaseConfigured,
  isErrorResponse,
} from "@/lib/server/route-utils";
import {
  listAdminNotifications,
  markAllAdminNotificationsRead,
} from "@/lib/server/services/admin-notifications";

const ADMIN_ROLES = ["admin"] as const;

export async function GET(request: Request) {
  const configError = ensureFirebaseConfigured();
  if (configError) return configError;

  const user = await requireRole(request, ADMIN_ROLES);
  if (isErrorResponse(user)) return user;

  try {
    const url = new URL(request.url);
    const unreadOnly = url.searchParams.get("unreadOnly") === "true";
    const limitRaw = url.searchParams.get("limit");
    const limit = limitRaw ? Number(limitRaw) : 50;

    const result = await listAdminNotifications({
      limit: Number.isFinite(limit) ? limit : 50,
      unreadOnly,
    });

    return NextResponse.json(result);
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function POST(request: Request) {
  const configError = ensureFirebaseConfigured();
  if (configError) return configError;

  const user = await requireRole(request, ADMIN_ROLES);
  if (isErrorResponse(user)) return user;

  try {
    const body = await request.json().catch(() => ({}));
    if (body && typeof body === "object" && body.markAllRead === true) {
      const updated = await markAllAdminNotificationsRead();
      return NextResponse.json({ ok: true, updated });
    }
    return NextResponse.json({ ok: false, error: "unsupported_action" }, { status: 400 });
  } catch (err) {
    return handleServiceError(err);
  }
}
