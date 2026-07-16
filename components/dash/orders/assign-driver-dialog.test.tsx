/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { AssignDriverDialog } from "@/components/dash/orders/assign-driver-dialog";

const assignDriverApi = vi.hoisted(() => vi.fn());
const useAdminDrivers = vi.hoisted(() => vi.fn());
const invalidateAfterOrderLifecycle = vi.hoisted(() =>
  vi.fn(async () => undefined),
);

vi.mock("@/lib/dash/api/client", () => ({ assignDriverApi }));
vi.mock("@/lib/dash/hooks/use-admin-drivers", () => ({ useAdminDrivers }));
vi.mock("@/lib/dash/api/config", () => ({
  isApiEnabled: () => true,
  shouldUseMockData: () => false,
}));
vi.mock("@/lib/dash/query/query-keys", () => ({
  invalidateAfterOrderLifecycle,
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const drivers = [
  {
    id: "drv-1",
    name: "Dave Smith",
    phone: "8254013481",
    email: "d@example.com",
    status: "Busy" as const,
    activeDeliveries: 2,
    completedToday: 0,
    failedToday: 0,
    averageTime: "—",
    lastActive: "—",
    avatarColor: "bg-primary",
    initials: "DS",
    vehicle: "Van",
  },
  {
    id: "drv-2",
    name: "driver2",
    phone: "5552349876",
    email: "2@example.com",
    status: "Available" as const,
    activeDeliveries: 0,
    completedToday: 0,
    failedToday: 0,
    averageTime: "—",
    lastActive: "—",
    avatarColor: "bg-secondary",
    initials: "D2",
  },
  {
    id: "drv-3",
    name: "Inactive Ian",
    phone: "4035559999",
    email: "i@example.com",
    status: "Inactive" as const,
    activeDeliveries: 0,
    completedToday: 0,
    failedToday: 0,
    averageTime: "—",
    lastActive: "—",
    avatarColor: "bg-muted",
    initials: "II",
  },
  {
    id: "drv-4",
    name: "No Phone",
    phone: "—",
    email: "n@example.com",
    status: "Available" as const,
    activeDeliveries: 0,
    completedToday: 0,
    failedToday: 0,
    averageTime: "—",
    lastActive: "—",
    avatarColor: "bg-muted",
    initials: "NP",
  },
];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AssignDriverDialog", () => {
  it("opens for an unassigned order, loads drivers, and disables ineligible ones", () => {
    useAdminDrivers.mockReturnValue({
      drivers,
      loading: false,
      error: null,
    });

    render(
      <AssignDriverDialog
        open
        orderId="QRX-10007"
        orderLabel="QRX-10007 · Abigail Walker"
        onClose={() => undefined}
      />,
      { wrapper },
    );

    expect(screen.getByRole("heading", { name: "Assign Driver" })).toBeTruthy();
    expect(screen.getByText("Dave Smith")).toBeTruthy();
    expect(screen.getByText("driver2")).toBeTruthy();
    const inactive = screen.getByRole("option", { name: /Inactive Ian/i });
    expect((inactive as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Not assignable \(Inactive\)/)).toBeTruthy();
  });

  it("defaults SMS off for first assignment and can assign without SMS", async () => {
    useAdminDrivers.mockReturnValue({
      drivers,
      loading: false,
      error: null,
    });
    assignDriverApi.mockResolvedValue({
      order: { id: "QRX-10007", assignedDriverId: "drv-2" },
      assignment: {
        success: true,
        previousDriverId: null,
        driverId: "drv-2",
        actionType: "assignment",
      },
      notification: { requested: false, sent: false },
    });

    const onAssigned = vi.fn();
    render(
      <AssignDriverDialog
        open
        orderId="QRX-10007"
        onClose={() => undefined}
        onAssigned={onAssigned}
      />,
      { wrapper },
    );

    fireEvent.click(screen.getByRole("option", { name: /driver2/i }));
    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    expect(checkbox.checked).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: /Assign Order/i }));

    await waitFor(() => {
      expect(assignDriverApi).toHaveBeenCalledWith(
        "QRX-10007",
        expect.objectContaining({
          driverId: "drv-2",
          notifyDriver: undefined,
        }),
      );
    });
    await waitFor(() => {
      expect(onAssigned).toHaveBeenCalledWith(
        expect.objectContaining({
          notificationRequested: false,
          notificationSent: false,
        }),
      );
    });
    expect(screen.getByText(/Order assigned to driver2/i)).toBeTruthy();
  });

  it("defaults SMS on for reassignment and distinguishes SMS failure", async () => {
    useAdminDrivers.mockReturnValue({
      drivers,
      loading: false,
      error: null,
    });
    assignDriverApi.mockResolvedValue({
      order: { id: "QRX-10007", assignedDriverId: "drv-2" },
      assignment: {
        success: true,
        previousDriverId: "drv-1",
        driverId: "drv-2",
        actionType: "reassignment",
      },
      notification: { requested: true, sent: false, reason: "PROVIDER_ERROR" },
    });

    render(
      <AssignDriverDialog
        open
        orderId="QRX-10007"
        currentDriverId="drv-1"
        currentDriverName="Dave Smith"
        onClose={() => undefined}
      />,
      { wrapper },
    );

    expect(screen.getByRole("heading", { name: "Reassign Driver" })).toBeTruthy();
    expect(screen.getByText(/Currently assigned to/)).toBeTruthy();

    fireEvent.click(screen.getByRole("option", { name: /driver2/i }));
    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    await waitFor(() => {
      expect(checkbox.checked).toBe(true);
    });

    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(false);
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: /Reassign to driver2/i }));

    await waitFor(() => {
      expect(assignDriverApi).toHaveBeenCalledWith(
        "QRX-10007",
        expect.objectContaining({
          driverId: "drv-2",
          notifyDriver: true,
        }),
      );
    });
    expect(
      await screen.findByText(
        /Order assigned to driver2, but the text message could not be sent/i,
      ),
    ).toBeTruthy();
  });

  it("disables SMS checkbox when driver has no valid phone", () => {
    useAdminDrivers.mockReturnValue({
      drivers,
      loading: false,
      error: null,
    });

    render(
      <AssignDriverDialog open orderId="QRX-10007" onClose={() => undefined} />,
      { wrapper },
    );

    fireEvent.click(screen.getByRole("option", { name: /No Phone/i }));
    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    expect(checkbox.disabled).toBe(true);
    expect(
      screen.getByText(/No mobile number is available for this driver/i),
    ).toBeTruthy();
  });
});
