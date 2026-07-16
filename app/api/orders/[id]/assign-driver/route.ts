import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { handleServiceError } from "@/lib/server/handle-service-error";
import { ADMIN_ROLES } from "@/lib/server/roles";
import {
  ensureFirebaseConfigured,
  isErrorResponse,
  parseJsonBody,
} from "@/lib/server/route-utils";
import { assignDriver } from "@/lib/server/services/orders";
import { AssignDriverSchema } from "@/lib/server/validation/orders";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const configError = ensureFirebaseConfigured();
  if (configError) return configError;

  const user = await requireRole(request, ADMIN_ROLES);
  if (isErrorResponse(user)) return user;

  const { id } = await context.params;
  const body = await parseJsonBody(request, AssignDriverSchema);
  if (isErrorResponse(body)) return body;

  try {
    const result = await assignDriver(id, body.driverId, user, {
      retryFailed: body.retryFailed,
      notifyDriver: body.notifyDriver,
      assignmentOperationId: body.assignmentOperationId,
    });

    const {
      order,
      previousDriverId,
      actionType,
      trackingNotification,
      driverNotification,
    } = result;

    const response: Record<string, unknown> = {
      order,
      assignment: {
        success: true,
        previousDriverId,
        driverId: order.assignedDriverId,
        actionType,
      },
      notification: {
        requested: driverNotification.requested,
        sent: driverNotification.sent,
        reason: driverNotification.reason ?? null,
      },
    };

    // Customer tracking SMS soft-failure (existing behaviour)
    if (trackingNotification.linkCreated && !trackingNotification.smsSent) {
      response.trackingNotification = trackingNotification;
      response.warning = trackingNotification.message;
    }

    // Driver SMS soft-failure — assignment still succeeded
    if (driverNotification.requested && !driverNotification.sent) {
      response.driverNotification = driverNotification;
      if (!response.warning) {
        response.warning =
          "Order assigned, but the driver text message could not be sent.";
      }
    }

    return NextResponse.json(response);
  } catch (err) {
    return handleServiceError(err);
  }
}
