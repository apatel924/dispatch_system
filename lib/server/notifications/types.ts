export type SmsFailureCategory =
  | "SMS_NOT_CONFIGURED"
  | "INVALID_PHONE"
  | "PROVIDER_ERROR"
  | "PROVIDER_REJECTED"
  | "NETWORK_ERROR"
  | "EMAIL_ONLY"
  | "NOTIFICATION_DISABLED";

export type TrackingLinkNotificationType = "order_assigned" | "tracking_link_resend";

export type DriverAssignmentNotificationType = "driver_assignment";

export type NotificationAuditType =
  | TrackingLinkNotificationType
  | DriverAssignmentNotificationType;

export interface SendTrackingLinkInput {
  orderId: string;
  trackingId: string;
  customerName: string;
  phoneE164: string;
  trackingUrl: string;
}

export interface SendSmsInput {
  toE164: string;
  body: string;
}

export interface SendSmsResult {
  ok: boolean;
  provider: string;
  messageSid?: string;
  failureCategory?: SmsFailureCategory;
  providerErrorCode?: string;
}

export interface SmsProvider {
  readonly name: string;
  sendTrackingLink(input: SendTrackingLinkInput): Promise<SendSmsResult>;
  /** Generic plaintext SMS (driver assignment, etc.). */
  sendSms(input: SendSmsInput): Promise<SendSmsResult>;
}

export interface DriverAssignmentNotificationResult {
  requested: boolean;
  sent: boolean;
  reason?: SmsFailureCategory | "already_sent" | "not_requested" | "same_driver";
  provider?: string;
  messageSid?: string;
}

export interface TrackingLinkNotificationResult {
  linkCreated: boolean;
  smsAttempted: boolean;
  smsSent: boolean;
  copyUrl?: string;
  message: string;
  version?: number;
  expiresAt?: string;
  provider?: string;
  failureCategory?: SmsFailureCategory;
}

export interface NotificationAuditRecord {
  orderId: string;
  notificationType: NotificationAuditType;
  attemptedAt: string;
  provider: string;
  success: boolean;
  messageSid?: string;
  failureCategory?: SmsFailureCategory;
  linkCreated: boolean;
  smsAttempted: boolean;
  driverId?: string;
  idempotencyKey?: string;
}
