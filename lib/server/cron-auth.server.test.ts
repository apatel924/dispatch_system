import { afterEach, describe, expect, it } from "vitest";
import { validateCronSecret } from "@/lib/server/cron-auth.server";

const SECRET = "test-cron-secret-value";

function requestWithAuth(token?: string): Request {
  const headers = new Headers();
  if (token !== undefined) {
    headers.set("authorization", `Bearer ${token}`);
  }
  return new Request("http://localhost/api/cron/barnet-sync", { headers });
}

describe("validateCronSecret", () => {
  const originalSecret = process.env.CRON_SECRET;

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = originalSecret;
    }
  });

  it("returns 500 when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;
    const response = validateCronSecret(requestWithAuth(SECRET));
    expect(response?.status).toBe(500);
    const body = await response?.json();
    expect(body).toEqual({ ok: false, error: "cron_not_configured" });
  });

  it("returns 401 when authorization header is missing", async () => {
    process.env.CRON_SECRET = SECRET;
    const response = validateCronSecret(requestWithAuth());
    expect(response?.status).toBe(401);
    const body = await response?.json();
    expect(body).toEqual({ ok: false, error: "unauthorized" });
    expect(JSON.stringify(body)).not.toContain(SECRET);
  });

  it("returns 401 when bearer token is incorrect", async () => {
    process.env.CRON_SECRET = SECRET;
    const response = validateCronSecret(requestWithAuth("wrong-secret"));
    expect(response?.status).toBe(401);
  });

  it("returns null when bearer token matches CRON_SECRET", () => {
    process.env.CRON_SECRET = SECRET;
    const response = validateCronSecret(requestWithAuth(SECRET));
    expect(response).toBeNull();
  });
});
