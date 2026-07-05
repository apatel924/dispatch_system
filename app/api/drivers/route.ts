import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { handleServiceError } from "@/lib/server/handle-service-error";
import { ADMIN_ROLES } from "@/lib/server/roles";
import {
  ensureFirebaseConfigured,
  isErrorResponse,
  parseJsonBody,
  parseQueryParams,
} from "@/lib/server/route-utils";
import { createDriver, listDrivers } from "@/lib/server/services/drivers";
import {
  CreateDriverSchema,
  ListDriversQuerySchema,
} from "@/lib/server/validation/drivers";

const ADMIN_ONLY = ["admin"] as const;

export async function GET(request: Request) {
  const configError = ensureFirebaseConfigured();
  if (configError) return configError;

  const user = await requireRole(request, ADMIN_ROLES);
  if (isErrorResponse(user)) return user;

  const query = parseQueryParams(request, ListDriversQuerySchema);
  if (isErrorResponse(query)) return query;

  try {
    const result = await listDrivers(query);
    return NextResponse.json(result);
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function POST(request: Request) {
  const configError = ensureFirebaseConfigured();
  if (configError) return configError;

  const user = await requireRole(request, ADMIN_ONLY);
  if (isErrorResponse(user)) return user;

  const body = await parseJsonBody(request, CreateDriverSchema);
  if (isErrorResponse(body)) return body;

  try {
    const driver = await createDriver(body, user);
    return NextResponse.json({ driver }, { status: 201 });
  } catch (err) {
    return handleServiceError(err);
  }
}
