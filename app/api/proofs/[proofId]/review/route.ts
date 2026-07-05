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
import { reviewProof } from "@/lib/server/services/proofs";
import {
  ReviewProofQuerySchema,
  ReviewProofSchema,
} from "@/lib/server/validation/proofs";

type RouteContext = { params: Promise<{ proofId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const configError = ensureFirebaseConfigured();
  if (configError) return configError;

  const user = await requireRole(request, ADMIN_ROLES);
  if (isErrorResponse(user)) return user;

  const query = parseQueryParams(request, ReviewProofQuerySchema);
  if (isErrorResponse(query)) return query;

  const body = await parseJsonBody(request, ReviewProofSchema);
  if (isErrorResponse(body)) return body;

  const { proofId } = await context.params;

  try {
    const proof = await reviewProof(query.orderId, proofId, body, user);
    return NextResponse.json({ proof });
  } catch (err) {
    return handleServiceError(err);
  }
}
