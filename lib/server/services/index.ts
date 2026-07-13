export { writeAuditLog, listAuditLogsForEntity } from "@/lib/server/services/audit";
export type { WriteAuditLogInput } from "@/lib/server/services/audit";

export {
  createOrder,
  getOrderById,
  listOrders,
  updateOrder,
  assignDriver,
  updateOrderStatus,
  listOrdersForDriver,
  assertDriverOwnsOrder,
  getStatusEvents,
  addStatusEvent,
} from "@/lib/server/services/orders";
export type { ActorContext, AssignDriverResult } from "@/lib/server/services/orders";

export {
  getDriverById,
  getDriverByUserId,
  listDrivers,
  createDriver,
  updateDriverAdmin,
  updateDriverSelf,
  toDriverDto,
} from "@/lib/server/services/drivers";

export {
  listProofs,
  getProof,
  createProof,
  reviewProof,
  getSignedDownloadUrl,
} from "@/lib/server/services/proofs";

export { getReportsOverview } from "@/lib/server/services/reports";
export type { ReportsOverview } from "@/lib/server/services/reports";

export {
  importOrders,
  listImportLogs,
  MOCK_IMPORT_FIXTURES,
} from "@/lib/server/services/import";

export {
  notifyCustomerOrderAssigned,
  notifyCustomerStatusUpdate,
  issueAndSendTrackingLink,
} from "@/lib/server/services/notifications";
export type {
  NotificationResult,
  NotificationChannel,
  TrackingLinkNotificationResult,
  TrackingLinkNotificationType,
} from "@/lib/server/services/notifications";
