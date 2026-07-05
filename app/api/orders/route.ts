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
import { createOrder, listOrders } from "@/lib/server/services/orders";
import {
  CreateOrderSchema,
  ListOrdersQuerySchema,
} from "@/lib/server/validation/orders";

export async function GET(request: Request) {
  const configError = ensureFirebaseConfigured();
  if (configError) return configError;

  const user = await requireRole(request, ADMIN_ROLES);
  if (isErrorResponse(user)) return user;

  const query = parseQueryParams(request, ListOrdersQuerySchema);
  if (isErrorResponse(query)) return query;

  try {
    const result = await listOrders(query);
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

  const body = await parseJsonBody(request, CreateOrderSchema);
  if (isErrorResponse(body)) return body;

  try {
    const order = await createOrder(body, user);
    return NextResponse.json({ order }, { status: 201 });
  } catch (err) {
    return handleServiceError(err);
  }
}
