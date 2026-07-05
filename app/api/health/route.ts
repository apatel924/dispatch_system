import { NextResponse } from "next/server";
import packageJson from "../../../package.json";
import type { HealthResponse } from "@/lib/types/backend";
import {
  isFirebaseAdminConfigured,
  isFirebaseClientConfigured,
} from "@/lib/server/env";

export async function GET(): Promise<NextResponse<HealthResponse>> {
  const body: HealthResponse = {
    status: "ok",
    timestamp: new Date().toISOString(),
    version: packageJson.version,
    services: {
      firebaseAdmin: isFirebaseAdminConfigured() ? "configured" : "missing",
      firebaseClient: isFirebaseClientConfigured() ? "configured" : "missing",
    },
  };

  return NextResponse.json(body);
}
