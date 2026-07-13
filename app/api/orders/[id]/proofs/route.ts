import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { requireDriverId } from "@/lib/server/driver-context";
import { handleServiceError } from "@/lib/server/handle-service-error";
import { STAFF_ROLES } from "@/lib/server/roles";
import {
  ensureFirebaseConfigured,
  isErrorResponse,
  parseJsonBody,
} from "@/lib/server/route-utils";
import { assertDriverOwnsOrder } from "@/lib/server/services/orders";
import { createProof, listProofs } from "@/lib/server/services/proofs";
import { UploadProofSchema } from "@/lib/server/validation/proofs";

const DRIVER_ROLES = ["driver"] as const;

/** Allow headroom for decode + Firebase upload on large prepared images. */
export const maxDuration = 30;

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const configError = ensureFirebaseConfigured();
  if (configError) return configError;

  const user = await requireRole(request, STAFF_ROLES);
  if (isErrorResponse(user)) return user;

  const { id } = await context.params;

  try {
    if (user.role === "driver") {
      const driverId = await requireDriverId(user);
      if (isErrorResponse(driverId)) return driverId;
      await assertDriverOwnsOrder(id, driverId);
    }

    const proofs = await listProofs(id);
    return NextResponse.json({ proofs });
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function POST(request: Request, context: RouteContext) {
  const configError = ensureFirebaseConfigured();
  if (configError) return configError;

  const user = await requireRole(request, DRIVER_ROLES);
  if (isErrorResponse(user)) return user;

  const driverId = await requireDriverId(user);
  if (isErrorResponse(driverId)) return driverId;

  const { id } = await context.params;
  const body = await parseJsonBody(request, UploadProofSchema);
  if (isErrorResponse(body)) return body;

  try {
    await assertDriverOwnsOrder(id, driverId);
    const proof = await createProof(id, body, user, driverId);
    return NextResponse.json({ proof }, { status: 201 });
  } catch (err) {
    return handleServiceError(err);
  }
}
