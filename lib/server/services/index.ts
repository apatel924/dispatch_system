export { writeAuditLog, listAuditLogsForEntity } from "@/lib/server/services/audit";
export type { WriteAuditLogInput } from "@/lib/server/services/audit";

export {
  createOrder,
  getOrderById,
  getOrderByTrackingId,
  listOrders,
  updateOrder,
  assignDriver,
  updateOrderStatus,
  listOrdersForDriver,
  assertDriverOwnsOrder,
  getStatusEvents,
  addStatusEvent,
} from "@/lib/server/services/orders";
export type { ActorContext } from "@/lib/server/services/orders";

export {
  getDriverById,
  getDriverByUserId,
  listDrivers,
  createDriver,
  updateDriver,
} from "@/lib/server/services/drivers";

export {
  listProofs,
  getProof,
  createProof,
  reviewProof,
  getSignedDownloadUrl,
} from "@/lib/server/services/proofs";

export {
  getTrackingByTrackingId,
  buildTrackingViewFromOrder,
} from "@/lib/server/services/tracking";

export { getReportsOverview } from "@/lib/server/services/reports";
export type { ReportsOverview } from "@/lib/server/services/reports";

export {
  importOrders,
  listImportLogs,
  MOCK_IMPORT_FIXTURES,
} from "@/lib/server/services/import";
