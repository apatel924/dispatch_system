/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { DriverEditDialog } from "@/components/dash/driver-edit-dialog";
import type { AdminDriverRow } from "@/lib/dash/api/adapters";

vi.mock("@/lib/dash/api/config", () => ({ isApiEnabled: () => true }));

const { updateDriverApi } = vi.hoisted(() => ({
  updateDriverApi: vi.fn(),
}));

vi.mock("@/lib/dash/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/dash/api/client")>();
  return {
    ...actual,
    updateDriverApi,
  };
});

const baseDriver: AdminDriverRow = {
  id: "DRV-10012",
  name: "Alex Rivera",
  phone: "(555) 123-4567",
  email: "alex@example.com",
  status: "Available",
  activeDeliveries: 2,
  completedToday: 1,
  failedToday: 0,
  averageTime: "12m",
  lastActive: "—",
  avatarColor: "bg-info-soft text-info",
  initials: "AR",
};

describe("DriverEditDialog", () => {
  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it("warns before deactivating a driver with active assignments", async () => {
    render(
      <DriverEditDialog
        driver={baseDriver}
        open
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByRole("combobox"), {
      target: { value: "Inactive" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("alertdialog")).toBeTruthy();
    expect(screen.getByText(/active assignments found/i)).toBeTruthy();
    expect(updateDriverApi).not.toHaveBeenCalled();
  });

  it("saves after explicit deactivation confirmation", async () => {
    updateDriverApi.mockResolvedValue({
      driver: {
        ...baseDriver,
        status: "Inactive",
        userId: "auth-1",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-07-13T12:00:00.000Z",
      },
    });

    const onSaved = vi.fn();
    render(
      <DriverEditDialog
        driver={baseDriver}
        open
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
    );

    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByRole("combobox"), {
      target: { value: "Inactive" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));
    fireEvent.click(await screen.findByRole("button", { name: /confirm deactivation/i }));

    await waitFor(() => {
      expect(updateDriverApi).toHaveBeenCalledWith(
        "DRV-10012",
        expect.objectContaining({
          status: "Inactive",
          acknowledgeActiveAssignments: true,
        }),
      );
    });
  });
});
