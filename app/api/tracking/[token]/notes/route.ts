import { NextResponse } from "next/server";
import { handleServiceError } from "@/lib/server/handle-service-error";
import { ensureFirebaseConfigured, parseJsonBody } from "@/lib/server/route-utils";
import { addConsumerNoteByToken } from "@/lib/server/services/consumer-tracking";
import { getClientIp } from "@/lib/server/rate-limit";
import { ConsumerNoteBodySchema } from "@/lib/server/validation/tracking";

type RouteContext = { params: Promise<{ token: string }> };

export async function POST(request: Request, context: RouteContext) {
  const configError = ensureFirebaseConfigured();
  if (configError) return configError;

  const { token } = await context.params;
  const body = await parseJsonBody(request, ConsumerNoteBodySchema);
  if (body instanceof Response) return body;

  try {
    const note = await addConsumerNoteByToken(token, body.text, getClientIp(request));
    return NextResponse.json(
      { note },
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (err) {
    return handleServiceError(err);
  }
}
