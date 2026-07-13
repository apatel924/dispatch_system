/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DriverAccountAccessCard } from "@/components/dash/driver-account-access";

vi.mock("@/lib/dash/api/config", () => ({
  isApiEnabled: () => true,
}));

const fetchDriverAccount = vi.fn();
const updateDriverAccountApi = vi.fn();

vi.mock("@/lib/dash/api/client", () => ({
  fetchDriverAccount: (...args: unknown[]) => fetchDriverAccount(...args),
  updateDriverAccountApi: (...args: unknown[]) => updateDriverAccountApi(...args),
}));

describe("DriverAccountAccessCard", () => {
  afterEach(() => vi.clearAllMocks());

  it("validates password confirmation before submit", async () => {
    fetchDriverAccount.mockResolvedValue({
      account: {
        driverId: "DRV-1",
        driverName: "Alex",
        linked: true,
        loginEmail: "alex@example.com",
        disabled: false,
      },
    });

    render(<DriverAccountAccessCard driverId="DRV-1" driverName="Alex" />);
    await screen.findByText("Login email");

    fireEvent.click(screen.getByRole("button", { name: /set new password/i }));
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "Secret1a" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "Secret1b" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^set password$/i }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Password confirmation does not match",
    );
    expect(updateDriverAccountApi).not.toHaveBeenCalled();
  });
});
