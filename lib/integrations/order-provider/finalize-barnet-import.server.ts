import type { AuthUser } from "@/lib/server/auth";
import type { ActorContext } from "@/lib/server/services/orders";
import { createBarnetNewOrderNotification } from "@/lib/server/services/admin-notifications";
import { promoteExternalOrderToDispatch } from "@/lib/integrations/order-provider/promote-external-order.server";

export const BARNET_SYNC_SYSTEM_ACTOR: ActorContext = {
  uid: "system:barnet-sync",
  role: "system",
};

export interface FinalizeBarnetImportResult {
  dispatchOrderId: string | null;
  alreadyPromoted: boolean;
  notificationCreated: boolean;
  failed: boolean;
  errorCode?: string;
}

/**
 * After an external order is persisted, create the canonical unassigned dispatch
 * order (idempotent) and an admin notification for genuinely new imports.
 * Never assigns a driver.
 */
export async function finalizeBarnetDeliveryImport(input: {
  docId: string;
  externalOrderId: string;
  externalOrderNumber?: string | null;
  isNew: boolean;
  trigger: "cron" | "manual";
  actor?: AuthUser | ActorContext | null;
}): Promise<FinalizeBarnetImportResult> {
  const actor = input.actor ?? BARNET_SYNC_SYSTEM_ACTOR;

  try {
    const promoteResult = await promoteExternalOrderToDispatch(input.docId, actor, {
      overrideMissingFields: true,
    });

    // Guard: promote must never leave a driver assigned for sync imports.
    if (
      promoteResult.order.assignedDriverId ||
      promoteResult.order.assignedDriverName
    ) {
      console.warn(
        `[barnet-sync] promote unexpectedly assigned driver for externalId=${input.externalOrderId}`,
      );
    }

    let notificationCreated = false;
    if (input.isNew && !promoteResult.alreadyPromoted) {
      const notification = await createBarnetNewOrderNotification({
        externalOrderId: input.externalOrderId,
        externalOrderNumber: input.externalOrderNumber,
        dispatchOrderId: promoteResult.order.id,
        source: input.trigger === "cron" ? "barnet_cron" : "barnet_manual",
      });
      notificationCreated = notification.created;
    }

    return {
      dispatchOrderId: promoteResult.order.id,
      alreadyPromoted: promoteResult.alreadyPromoted,
      notificationCreated,
      failed: false,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "promote_failed";
    console.warn(
      `[barnet-sync] finalize import failed externalId=${input.externalOrderId}: ${message}`,
    );
    return {
      dispatchOrderId: null,
      alreadyPromoted: false,
      notificationCreated: false,
      failed: true,
      errorCode: "finalize_import_failed",
    };
  }
}
