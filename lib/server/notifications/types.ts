export type SmsFailureCategory =
  | "SMS_NOT_CONFIGURED"
  | "INVALID_PHONE"
  | "PROVIDER_ERROR"
  | "PROVIDER_REJECTED"
  | "NETWORK_ERROR"
  | "EMAIL_ONLY"
  | "NOTIFICATION_DISABLED";

export type TrackingLinkNotificationType = "order_assigned" | "tracking_link_resend";

export interface SendTrackingLinkInput {
  orderId: string;
  trackingId: string;
  customerName: string;
  phoneE164: string;
  trackingUrl: string;
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
  notificationType: TrackingLinkNotificationType;
  attemptedAt: string;
  provider: string;
  success: boolean;
  messageSid?: string;
  failureCategory?: SmsFailureCategory;
  linkCreated: boolean;
  smsAttempted: boolean;
}
