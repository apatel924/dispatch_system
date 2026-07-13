import { afterEach, describe, expect, it, vi } from "vitest";

const {
  requireRole,
  getDriverById,
  updateDriverAdmin,
  updateDriverSelf,
  ensureFirebaseConfigured,
} = vi.hoisted(() => ({
  requireRole: vi.fn(),
  getDriverById: vi.fn(),
  updateDriverAdmin: vi.fn(),
  updateDriverSelf: vi.fn(),
  ensureFirebaseConfigured: vi.fn(),
}));

vi.mock("@/lib/server/auth", () => ({ requireRole }));
vi.mock("@/lib/server/services/drivers", () => ({
  getDriverById,
  updateDriverAdmin,
  updateDriverSelf,
  toDriverDto: (driver: { id: string }) => driver,
}));
vi.mock("@/lib/server/route-utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/route-utils")>();
  return { ...actual, ensureFirebaseConfigured };
});

import { GET, PATCH } from "@/app/api/drivers/[id]/route";

const adminUser = { uid: "admin-1", role: "admin" as const };
const driverUser = { uid: "driver-auth-1", role: "driver" as const, driverId: "DRV-10012" };
const sampleDriver = {
  id: "DRV-10012",
  name: "Alex Rivera",
  phone: "(555) 123-4567",
  status: "Available",
  updatedByUid: "admin-1",
};

function patchRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/drivers/DRV-10012", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/drivers/[id]", () => {
  afterEach(() => vi.clearAllMocks());

  it("requires authentication", async () => {
    ensureFirebaseConfigured.mockReturnValue(null);
    requireRole.mockResolvedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    );

    const response = await GET(new Request("http://localhost/api/drivers/DRV-10012"), {
      params: Promise.resolve({ id: "DRV-10012" }),
    });

    expect(response.status).toBe(401);
  });

  it("rejects invalid driverId", async () => {
    ensureFirebaseConfigured.mockReturnValue(null);
    requireRole.mockResolvedValue(adminUser);

    const response = await GET(new Request("http://localhost/api/drivers/not-a-driver"), {
      params: Promise.resolve({ id: "not-a-driver" }),
    });

    expect(response.status).toBe(400);
    expect(getDriverById).not.toHaveBeenCalled();
  });

  it("returns driver for admin", async () => {
    ensureFirebaseConfigured.mockReturnValue(null);
    requireRole.mockResolvedValue(adminUser);
    getDriverById.mockResolvedValue(sampleDriver);

    const response = await GET(new Request("http://localhost/api/drivers/DRV-10012"), {
      params: Promise.resolve({ id: "DRV-10012" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ driver: { id: "DRV-10012" } });
  });
});

describe("PATCH /api/drivers/[id]", () => {
  afterEach(() => vi.clearAllMocks());

  it("rejects unauthenticated update", async () => {
    ensureFirebaseConfigured.mockReturnValue(null);
    requireRole.mockResolvedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    );

    const response = await PATCH(patchRequest({ name: "Updated" }), {
      params: Promise.resolve({ id: "DRV-10012" }),
    });

    expect(response.status).toBe(401);
    expect(updateDriverAdmin).not.toHaveBeenCalled();
  });

  it("rejects driver-role update of another driver", async () => {
    ensureFirebaseConfigured.mockReturnValue(null);
    requireRole.mockResolvedValue(driverUser);

    const response = await PATCH(patchRequest({ name: "Hijack" }), {
      params: Promise.resolve({ id: "DRV-99999" }),
    });

    expect(response.status).toBe(403);
    expect(updateDriverSelf).not.toHaveBeenCalled();
  });

  it("rejects invalid driverId", async () => {
    ensureFirebaseConfigured.mockReturnValue(null);
    requireRole.mockResolvedValue(adminUser);

    const response = await PATCH(patchRequest({ name: "Updated" }), {
      params: Promise.resolve({ id: "bad-id" }),
    });

    expect(response.status).toBe(400);
    expect(updateDriverAdmin).not.toHaveBeenCalled();
  });

  it("rejects unknown request fields", async () => {
    ensureFirebaseConfigured.mockReturnValue(null);
    requireRole.mockResolvedValue(adminUser);

    const response = await PATCH(patchRequest({ name: "Alex", rogueField: true }), {
      params: Promise.resolve({ id: "DRV-10012" }),
    });

    expect(response.status).toBe(400);
    expect(updateDriverAdmin).not.toHaveBeenCalled();
  });

  it("rejects empty display name", async () => {
    ensureFirebaseConfigured.mockReturnValue(null);
    requireRole.mockResolvedValue(adminUser);

    const response = await PATCH(patchRequest({ name: "   " }), {
      params: Promise.resolve({ id: "DRV-10012" }),
    });

    expect(response.status).toBe(400);
  });

  it("rejects invalid phone", async () => {
    ensureFirebaseConfigured.mockReturnValue(null);
    requireRole.mockResolvedValue(adminUser);

    const response = await PATCH(patchRequest({ phone: "123" }), {
      params: Promise.resolve({ id: "DRV-10012" }),
    });

    expect(response.status).toBe(400);
  });

  it("rejects unsupported status", async () => {
    ensureFirebaseConfigured.mockReturnValue(null);
    requireRole.mockResolvedValue(adminUser);

    const response = await PATCH(patchRequest({ status: "Offline" }), {
      params: Promise.resolve({ id: "DRV-10012" }),
    });

    expect(response.status).toBe(400);
  });

  it("allows admin successful name update with audit metadata", async () => {
    ensureFirebaseConfigured.mockReturnValue(null);
    requireRole.mockResolvedValue(adminUser);
    updateDriverAdmin.mockResolvedValue({ ...sampleDriver, name: "Alex Updated" });

    const response = await PATCH(patchRequest({ name: "Alex Updated", status: "Available" }), {
      params: Promise.resolve({ id: "DRV-10012" }),
    });

    expect(response.status).toBe(200);
    expect(updateDriverAdmin).toHaveBeenCalledWith(
      "DRV-10012",
      { name: "Alex Updated", status: "Available" },
      adminUser,
    );
  });

  it("allows admin successful vehicle update", async () => {
    ensureFirebaseConfigured.mockReturnValue(null);
    requireRole.mockResolvedValue(adminUser);
    updateDriverAdmin.mockResolvedValue({ ...sampleDriver, vehicle: "2022 Toyota Camry" });

    const response = await PATCH(patchRequest({ vehicle: "2022 Toyota Camry" }), {
      params: Promise.resolve({ id: "DRV-10012" }),
    });

    expect(response.status).toBe(200);
    expect(updateDriverAdmin).toHaveBeenCalledWith(
      "DRV-10012",
      { vehicle: "2022 Toyota Camry" },
      adminUser,
    );
  });

  it("returns 404 when driver is missing", async () => {
    ensureFirebaseConfigured.mockReturnValue(null);
    requireRole.mockResolvedValue(adminUser);
    const { ServiceError } = await import("@/lib/server/errors");
    updateDriverAdmin.mockRejectedValue(new ServiceError("Driver not found: DRV-10012", "NOT_FOUND", 404));

    const response = await PATCH(patchRequest({ name: "Alex" }), {
      params: Promise.resolve({ id: "DRV-10012" }),
    });

    expect(response.status).toBe(404);
  });

  it("requires confirmation when deactivating with active assignments", async () => {
    ensureFirebaseConfigured.mockReturnValue(null);
    requireRole.mockResolvedValue(adminUser);
    const { ServiceError } = await import("@/lib/server/errors");
    updateDriverAdmin.mockRejectedValue(
      new ServiceError(
        "This driver has 2 active assignment(s). Confirm to deactivate while keeping those orders assigned.",
        "ACTIVE_ASSIGNMENTS",
        409,
      ),
    );

    const response = await PATCH(patchRequest({ status: "Inactive" }), {
      params: Promise.resolve({ id: "DRV-10012" }),
    });

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.code).toBe("ACTIVE_ASSIGNMENTS");
  });

  it("allows deactivation when active assignments are acknowledged", async () => {
    ensureFirebaseConfigured.mockReturnValue(null);
    requireRole.mockResolvedValue(adminUser);
    updateDriverAdmin.mockResolvedValue({ ...sampleDriver, status: "Inactive" });

    const response = await PATCH(
      patchRequest({ status: "Inactive", acknowledgeActiveAssignments: true }),
      { params: Promise.resolve({ id: "DRV-10012" }) },
    );

    expect(response.status).toBe(200);
    expect(updateDriverAdmin).toHaveBeenCalledWith(
      "DRV-10012",
      { status: "Inactive", acknowledgeActiveAssignments: true },
      adminUser,
    );
  });

  it("allows driver self-service status update", async () => {
    ensureFirebaseConfigured.mockReturnValue(null);
    requireRole.mockResolvedValue(driverUser);
    updateDriverSelf.mockResolvedValue({ ...sampleDriver, status: "Inactive" });

    const response = await PATCH(patchRequest({ status: "Inactive" }), {
      params: Promise.resolve({ id: "DRV-10012" }),
    });

    expect(response.status).toBe(200);
    expect(updateDriverSelf).toHaveBeenCalledWith(
      "DRV-10012",
      { status: "Inactive" },
      driverUser,
    );
    expect(updateDriverAdmin).not.toHaveBeenCalled();
  });
});
