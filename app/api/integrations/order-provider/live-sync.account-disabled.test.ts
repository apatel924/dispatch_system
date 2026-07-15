import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { ACCOUNT_DISABLED_CODE, ACCOUNT_DISABLED_MESSAGE } from "@/lib/auth/account-status";

const { requireRole, syncLiveExternalOrders, writeAuditLog, ensureFirebaseConfigured, isErrorResponse } =
  vi.hoisted(() => ({
    requireRole: vi.fn(),
    syncLiveExternalOrders: vi.fn(),
    writeAuditLog: vi.fn(),
    ensureFirebaseConfigured: vi.fn(() => null),
    isErrorResponse: vi.fn(
      (value: unknown): value is Response => value instanceof Response,
    ),
  }));

vi.mock("@/lib/server/auth", () => ({ requireRole }));
vi.mock("@/lib/server/route-utils", () => ({
  ensureFirebaseConfigured,
  isErrorResponse,
}));
vi.mock("@/lib/server/services/audit", () => ({ writeAuditLog }));
vi.mock("@/lib/integrations/order-provider/index.server", () => ({
  syncLiveExternalOrders,
}));
vi.mock("@/lib/server/handle-service-error", () => ({
  handleServiceError: (err: unknown) =>
    NextResponse.json({ error: String(err) }, { status: 500 }),
}));

import { POST } from "@/app/api/integrations/order-provider/live-sync/route";

describe("POST /api/integrations/order-provider/live-sync disabled admin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ensureFirebaseConfigured.mockReturnValue(null);
    isErrorResponse.mockImplementation(
      (value: unknown): value is Response => value instanceof Response,
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("blocks disabled admin from manual sync and quiet-hours override", async () => {
    requireRole.mockResolvedValue(
      NextResponse.json(
        { error: ACCOUNT_DISABLED_MESSAGE, code: ACCOUNT_DISABLED_CODE },
        { status: 403 },
      ),
    );

    const response = await POST(
      new Request("https://app.example/api/integrations/order-provider/live-sync", {
        method: "POST",
        body: JSON.stringify({ overrideQuietHours: true }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: ACCOUNT_DISABLED_CODE });
    expect(syncLiveExternalOrders).not.toHaveBeenCalled();
    expect(writeAuditLog).not.toHaveBeenCalled();
  });
});
