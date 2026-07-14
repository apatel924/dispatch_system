import type {
  DeliveryStepKey,
  ConsumerNote,
  Order,
  OrderStatus,
  OrderStatusEvent,
  ProofAsset,
  DriverProfile,
} from "@/lib/types/backend";
import { driverFetch } from "@/lib/dash/api/client";
import type { UploadProofInput } from "@/lib/server/validation/proofs";

export async function fetchDriverOrders(scope: "today" | "active" | "completed" | "route" = "active"): Promise<{
  orders: Order[];
}> {
  const qs = new URLSearchParams({ scope });
  return driverFetch(`/api/driver/orders?${qs.toString()}`);
}

export async function fetchDriverOrderDetail(id: string): Promise<{
  order: Order;
  statusEvents: OrderStatusEvent[];
  proofs: ProofAsset[];
  consumerNotes: ConsumerNote[];
}> {
  return driverFetch(`/api/driver/orders/${encodeURIComponent(id)}`);
}

export async function fetchDriverProfile(id: string): Promise<{ driver: DriverProfile }> {
  return driverFetch(`/api/drivers/${encodeURIComponent(id)}`);
}

export async function fetchOrderProofs(id: string): Promise<{ proofs: ProofAsset[] }> {
  return driverFetch(`/api/orders/${encodeURIComponent(id)}/proofs`);
}

export async function postOrderProof(
  orderId: string,
  body: UploadProofInput,
  options?: { signal?: AbortSignal; timeoutMs?: number },
): Promise<{ proof: ProofAsset }> {
  const controller = new AbortController();
  const timeoutMs = options?.timeoutMs ?? 45_000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  if (options?.signal) {
    options.signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  try {
    return await driverFetch(`/api/orders/${encodeURIComponent(orderId)}/proofs`, {
      method: "POST",
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function postOrderStatus(
  orderId: string,
  body: { status: OrderStatus; stepKey?: DeliveryStepKey; note?: string },
): Promise<{ order: Order; event: OrderStatusEvent }> {
  return driverFetch(`/api/orders/${encodeURIComponent(orderId)}/status`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
