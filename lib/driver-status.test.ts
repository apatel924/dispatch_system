import { describe, expect, it } from "vitest";
import {
  isDriverAssignable,
  isDriverUnavailable,
  normalizeDriverStatus,
  resolveStoredDriverStatus,
} from "@/lib/driver-status";

describe("driver-status", () => {
  it("normalizes legacy casing", () => {
    expect(normalizeDriverStatus("available")).toBe("Available");
    expect(normalizeDriverStatus(" INACTIVE ")).toBe("Inactive");
    expect(normalizeDriverStatus("Offline")).toBeNull();
  });

  it("identifies assignable and unavailable drivers", () => {
    expect(isDriverAssignable("Available")).toBe(true);
    expect(isDriverAssignable("Busy")).toBe(true);
    expect(isDriverAssignable("Inactive")).toBe(false);
    expect(isDriverUnavailable("Suspended")).toBe(true);
  });

  it("coerces Available to Busy when active deliveries exist", () => {
    expect(resolveStoredDriverStatus("Available", 2)).toBe("Busy");
    expect(resolveStoredDriverStatus("Available", 0)).toBe("Available");
    expect(resolveStoredDriverStatus("Inactive", 2)).toBe("Inactive");
  });
});
