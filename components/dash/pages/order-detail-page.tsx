'use client'

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Users, Send, Save, FileText, MapPin, Package, User2, ClipboardList, CheckCircle2, Truck, Camera, PenTool, IdCard, MessageSquare, Copy, Check, Phone, ExternalLink } from "lucide-react";
import { DashboardLayout } from "@/components/dash/layout/dashboard-layout";
import { SectionCard } from "@/components/dash/ui/section-card";
import { ConsumerDeliveryInstructions } from "@/components/dash/consumer-delivery-instructions";
import { OrderActionsMenu } from "@/components/dash/order-actions-menu";
import { AssignDriverDialog } from "@/components/dash/orders/assign-driver-dialog";
import { OrderStatusBadge, DriverStatusBadge, ProofReviewBadge } from "@/components/dash/status-badge";
import { OrderDetailSkeleton } from "@/components/dash/ui/skeletons";
import { reviewProofApi, acknowledgeConsumerNoteApi, rotateOrderTrackingLinkApi } from "@/lib/dash/api/client";
import { isApiEnabled } from "@/lib/dash/api/config";
import { useAdminOrderDetail } from "@/lib/dash/hooks/use-admin-order-detail";
import { hasUnreadConsumerNotes } from "@/lib/consumer-notes";
import type { ProofType } from "@/lib/types/backend";

const TIMELINE_ICONS: Record<string, typeof FileText> = {
  New: FileText,
  Assigned: Users,
  "Picked Up": Package,
  "Out for Delivery": Truck,
  Delivered: CheckCircle2,
};

const TIMELINE_TONES: Record<string, string> = {
  New: "purple",
  Assigned: "info",
  "Picked Up": "orange",
  "Out for Delivery": "orange",
  Delivered: "success",
};

const PROOF_ICONS: Record<ProofType, typeof PenTool> = {
  signature: PenTool,
  exteriorPhoto: Camera,
  idVerification: IdCard,
};

const PLACEHOLDER_PROOFS = [
  { label: "Customer Signature", icon: PenTool },
  { label: "Drop-off Photo", icon: Camera },
  { label: "Exterior / Address", icon: Camera },
];

function mapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function telHref(phone: string): string | null {
  const cleaned = phone.replace(/[^\d+]/g, "");
  return cleaned ? `tel:${cleaned}` : null;
}

export function OrderDetailPage({ orderId }: { orderId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { detail, proofs, consumerNotes, loading, refresh } = useAdminOrderDetail(orderId);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);
  const [trackingUrl, setTrackingUrl] = useState<string | undefined>(undefined);
  const [trackingBusy, setTrackingBusy] = useState(false);
  const [trackingMessage, setTrackingMessage] = useState<string | null>(null);
  const [trackingMessageTone, setTrackingMessageTone] = useState<"success" | "warning" | "error">("success");
  const [showResendConfirm, setShowResendConfirm] = useState(false);
  const [copied, setCopied] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [retryFailed, setRetryFailed] = useState(false);
  const [assignFeedback, setAssignFeedback] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      setTrackingUrl(undefined);
    };
  }, []);

  useEffect(() => {
    if (searchParams.get("action") === "assign") {
      setAssignOpen(true);
      setRetryFailed(searchParams.get("retryFailed") === "1");
    }
  }, [searchParams]);

  const clearAssignQuery = () => {
    setAssignOpen(false);
    setRetryFailed(false);
    if (searchParams.get("action") === "assign") {
      router.replace(`/orders/${orderId}`, { scroll: false });
    }
  };

  const handleReview = async (proofId: string, status: "approved" | "rejected") => {
    if (!isApiEnabled()) return;
    setReviewingId(proofId);
    try {
      await reviewProofApi(orderId, proofId, { status });
      await refresh();
    } finally {
      setReviewingId(null);
    }
  };

  const handleAcknowledge = async (noteId: string) => {
    if (!isApiEnabled()) return;
    setAcknowledgingId(noteId);
    try {
      await acknowledgeConsumerNoteApi(orderId, noteId);
      await refresh({ silent: true });
    } finally {
      setAcknowledgingId(null);
    }
  };

  const handleResendTrackingLink = async () => {
    if (!isApiEnabled() || trackingBusy) return;
    setTrackingBusy(true);
    setTrackingMessage(null);
    setTrackingUrl(undefined);
    setCopied(false);
    try {
      const result = await rotateOrderTrackingLinkApi(orderId);
      if (result.smsSent) {
        setTrackingMessage("New tracking link sent successfully.");
        setTrackingMessageTone("success");
      } else if (result.linkCreated && result.copyUrl) {
        setTrackingUrl(result.copyUrl);
        setTrackingMessage("The secure link was created, but SMS could not be sent.");
        setTrackingMessageTone("warning");
      } else {
        setTrackingMessage(result.message || "Failed to generate tracking link.");
        setTrackingMessageTone("error");
      }
      setShowResendConfirm(false);
      await refresh({ silent: true });
    } catch (err) {
      setTrackingMessage(err instanceof Error ? err.message : "Failed to generate tracking link");
      setTrackingMessageTone("error");
    } finally {
      setTrackingBusy(false);
    }
  };

  const handleCopyTrackingUrl = async () => {
    if (!trackingUrl || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(trackingUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setTrackingMessage("Could not copy link. Select and copy the URL manually.");
      setTrackingMessageTone("warning");
    }
  };

  if (loading && !detail) {
    return (
      <DashboardLayout title="Orders">
        <OrderDetailSkeleton />
      </DashboardLayout>
    );
  }

  if (!detail) {
    return (
      <DashboardLayout title="Orders">
        <Link href="/orders" className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" /> Back to Orders</Link>
        <p className="text-muted-foreground">Order {orderId} not found</p>
      </DashboardLayout>
    );
  }

  const d = detail;
  const hasNewConsumerNotes = hasUnreadConsumerNotes(consumerNotes);
  const customerPhone = telHref(d.phone);
  const driverPhone = d.driver ? telHref(d.driver.phone) : null;
  const deliveryAddress = [d.address, d.deliveryUnit].filter(Boolean).join(", ");

  const openAssign = (options?: { retryFailed?: boolean }) => {
    setRetryFailed(Boolean(options?.retryFailed));
    setAssignOpen(true);
  };

  return (
    <DashboardLayout title="Orders">
      {assignOpen && (
        <AssignDriverDialog
          open
          orderId={d.id}
          orderLabel={`${d.id} · ${d.customerName}`}
          currentDriverId={d.driver?.id ?? null}
          currentDriverName={d.driver?.name ?? null}
          retryFailed={retryFailed}
          onClose={clearAssignQuery}
          onAssigned={(info) => {
            const first = info.driverName.split(" ")[0] ?? info.driverName;
            if (info.notificationRequested && info.notificationSent) {
              setAssignFeedback(`Order assigned to ${first} and notification sent.`);
            } else if (info.notificationRequested && !info.notificationSent) {
              setAssignFeedback(
                `Order assigned to ${first}, but the text message could not be sent.`,
              );
            } else {
              setAssignFeedback(`Order assigned to ${first}.`);
            }
            void refresh();
          }}
        />
      )}

      <Link href="/orders" className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" /> Back to Orders</Link>

      <div className="rounded-xl border border-border bg-card p-4 shadow-[0_1px_2px_0_rgb(0_0_0/0.03)] sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
            <h2 className="truncate text-xl font-bold tracking-tight sm:text-2xl">{d.id}</h2>
            <OrderStatusBadge status={d.status} unrecognizedStatusRaw={d.unrecognizedStatusRaw} />
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <button
              type="button"
              onClick={() => openAssign()}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border border-input bg-card px-3 py-2 text-sm font-medium hover:bg-secondary sm:flex-initial"
            >
              <Users className="h-4 w-4" /> {d.driver ? "Reassign Driver" : "Assign Driver"}
            </button>
            <button
              type="button"
              onClick={() => setShowResendConfirm(true)}
              disabled={trackingBusy}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border border-input bg-card px-3 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-60 sm:flex-initial"
            >
              <Send className="h-4 w-4" /> <span className="sm:inline">{trackingBusy ? "Sending…" : "Resend Tracking"}</span>
            </button>
            <button
              type="button"
              className="hidden min-h-11 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 sm:inline-flex"
            >
              <Save className="h-4 w-4" /> Save Changes
            </button>
            <OrderActionsMenu
              order={{
                id: d.id,
                status: d.status,
                driver: d.driver?.name ?? null,
                unrecognizedStatusRaw: d.unrecognizedStatusRaw,
              }}
              onStatusChanged={() => void refresh()}
              onAssign={(_id, options) => openAssign(options)}
              triggerClassName="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-input bg-card hover:bg-secondary"
            />
          </div>
        </div>
        {showResendConfirm ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900/50 dark:bg-amber-950/30">
            <p className="font-semibold text-foreground">Resend tracking link?</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
              <li>Generating a new link invalidates the previous link.</li>
              <li>The new link will be shown only during this session.</li>
              <li>If SMS fails, copy the link before leaving the page.</li>
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleResendTrackingLink()}
                disabled={trackingBusy}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                <Send className="h-4 w-4" /> {trackingBusy ? "Sending…" : "Confirm resend"}
              </button>
              <button
                type="button"
                onClick={() => setShowResendConfirm(false)}
                disabled={trackingBusy}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-input bg-card px-3 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
        {trackingMessage ? (
          <p
            className={`mt-3 text-sm ${
              trackingMessageTone === "success"
                ? "text-success"
                : trackingMessageTone === "warning"
                  ? "text-amber-700 dark:text-amber-300"
                  : "text-destructive"
            }`}
            role="status"
          >
            {trackingMessage}
          </p>
        ) : null}
        {assignFeedback ? (
          <p className="mt-3 text-sm text-success" role="status">
            {assignFeedback}
          </p>
        ) : null}
        {trackingUrl ? (
          <div className="mt-3 rounded-lg border border-border bg-secondary/30 p-3">
            <p className="text-xs text-muted-foreground">
              Copy this link now — it will not be shown again after you leave this page.
            </p>
            <p className="mt-2 break-all font-mono text-xs">{trackingUrl}</p>
            <button
              type="button"
              onClick={() => void handleCopyTrackingUrl()}
              className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-input bg-card px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy Link"}
            </button>
          </div>
        ) : d.trackingLinkVersion ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Tracking link v{d.trackingLinkVersion} is active. Use &quot;Resend Tracking Link&quot; to
            send a new link to the customer (invalidates the previous link).
          </p>
        ) : null}
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 md:gap-6">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Assigned Driver</div>
            {d.driver ? (
              <div className="mt-2 flex items-center gap-2">
                <div className={`grid h-9 w-9 place-items-center rounded-full ${d.driver.avatarColor} text-xs font-semibold`}>{d.driver.initials}</div>
                <div className="min-w-0 leading-tight">
                  <div className="truncate text-sm font-semibold">{d.driver.name}</div>
                  {driverPhone ? (
                    <a href={driverPhone} className="text-xs text-primary hover:underline">{d.driver.phone}</a>
                  ) : (
                    <div className="text-xs text-muted-foreground">{d.driver.phone}</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-2 text-sm text-muted-foreground">Unassigned</div>
            )}
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Created</div>
            <div className="mt-2 text-sm font-semibold">{d.createdDate}</div>
            <div className="text-xs text-muted-foreground">{d.createdTime}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Last Updated</div>
            <div className="mt-2 text-sm font-semibold">{d.updatedDate}</div>
            <div className="text-xs text-muted-foreground">{d.updatedTime}</div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 pb-24 lg:grid-cols-3 md:pb-0">
        <div className="space-y-6">
          <SectionCard title="Customer Information" icon={<User2 className="h-4 w-4" />} action={<button type="button" className="text-xs font-semibold text-primary hover:underline">Edit</button>}>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2"><FileText className="h-4 w-4 shrink-0 text-purple" /><span className="min-w-0 break-words font-semibold">{d.companyName}</span></div>
              <Field label="Contact Name" value={d.contactName} />
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Phone</div>
                {customerPhone ? (
                  <a href={customerPhone} className="mt-0.5 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                    <Phone className="h-3.5 w-3.5" /> {d.phone}
                  </a>
                ) : (
                  <div className="mt-0.5 text-sm">{d.phone}</div>
                )}
              </div>
              <Field label="Email" value={d.email} />
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Address</div>
                <div className="mt-0.5 break-words text-sm">{deliveryAddress}</div>
                {deliveryAddress && (
                  <a
                    href={mapsUrl(deliveryAddress)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex min-h-11 items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Open in Maps
                  </a>
                )}
              </div>
            </div>
          </SectionCard>
          <SectionCard
            title="Consumer Delivery Instructions"
            icon={<MessageSquare className="h-4 w-4" />}
            action={
              hasNewConsumerNotes ? (
                <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
                  New
                </span>
              ) : undefined
            }
          >
            <ConsumerDeliveryInstructions
              notes={consumerNotes}
              variant="admin"
              onAcknowledge={isApiEnabled() ? handleAcknowledge : undefined}
              acknowledgingId={acknowledgingId}
            />
          </SectionCard>
          <SectionCard title="Internal Admin Notes" action={<button type="button" className="text-xs font-semibold text-primary hover:underline">Edit</button>}>
            <p className="break-words text-sm">{d.notes}</p>
          </SectionCard>
          {d.driverNotes.length > 0 && (
            <SectionCard title="Driver Notes">
              <ol className="space-y-3">
                {d.driverNotes.map((note) => (
                  <li key={note.id} className="rounded-lg border border-border p-3 text-sm">
                    <p className="break-words">{note.text}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {note.date} {note.time}
                    </p>
                  </li>
                ))}
              </ol>
            </SectionCard>
          )}
        </div>

        <div className="space-y-6">
          <SectionCard title="Delivery Information" icon={<MapPin className="h-4 w-4" />} action={<button type="button" className="text-xs font-semibold text-primary hover:underline">Edit</button>}>
            <Field label="External Order #" value={d.external} />
            <div className="mt-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Pickup Location</div>
              <div className="mt-1 flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-purple" />
                <div className="min-w-0 text-sm">
                  <div className="font-semibold">{d.pickupName}</div>
                  <div className="break-words text-muted-foreground">{d.pickupAddress}</div>
                  {d.pickupAddress && (
                    <a
                      href={mapsUrl(d.pickupAddress)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex min-h-11 items-center gap-1 text-xs font-semibold text-primary hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Open in Maps
                    </a>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Delivery Location</div>
              <div className="mt-1 flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 text-sm">
                  <div className="font-semibold">{d.customerName}</div>
                  <div className="break-words text-muted-foreground">{d.address}</div>
                </div>
              </div>
            </div>
            <div className="mt-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Special Instructions</div>
              <p className="mt-1 break-words text-sm">{d.deliveryInstructions}</p>
            </div>
          </SectionCard>

          {d.driver && (
            <SectionCard title="Driver Assignment" icon={<Users className="h-4 w-4" />} action={<button type="button" onClick={() => openAssign()} className="text-xs font-semibold text-primary hover:underline">Change</button>}>
              <div className="flex flex-wrap items-center gap-3">
                <div className={`grid h-11 w-11 place-items-center rounded-full ${d.driver.avatarColor} text-sm font-semibold`}>{d.driver.initials}</div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{d.driver.name}</div>
                  {driverPhone ? (
                    <a href={driverPhone} className="text-xs text-primary hover:underline">{d.driver.phone}</a>
                  ) : (
                    <div className="text-xs text-muted-foreground">{d.driver.phone}</div>
                  )}
                </div>
                <div className="sm:ml-auto"><DriverStatusBadge status={d.driver.status} /></div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                <Field label="Vehicle" value={d.driver.vehicle} />
              </div>
            </SectionCard>
          )}
        </div>

        <div className="space-y-6">
          <SectionCard title="Status Timeline" icon={<ClipboardList className="h-4 w-4" />}>
            <ol className="space-y-4">
              {d.statusEvents.map((s) => {
                const Icon = TIMELINE_ICONS[s.status] ?? FileText;
                const tone = TIMELINE_TONES[s.status] ?? "muted";
                const toneBg: Record<string, string> = { purple: "bg-purple-soft text-purple", info: "bg-info-soft text-info", orange: "bg-orange-soft text-orange", success: "bg-success-soft text-success", muted: "bg-secondary text-muted-foreground" };
                return (
                  <li key={s.id} className="flex items-start gap-3">
                    <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${toneBg[tone]}`}><Icon className="h-4 w-4" /></div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold">{s.title}</div>
                      <div className="text-xs text-muted-foreground">by {s.by}</div>
                    </div>
                    <div className="shrink-0 text-right text-xs text-muted-foreground">
                      <div>{s.date}</div>
                      <div>{s.time}</div>
                    </div>
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-label="Completed" />
                  </li>
                );
              })}
            </ol>
          </SectionCard>
          <SectionCard title="Proof of Delivery">
            {proofs.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {proofs.map((proof) => {
                  const Icon = PROOF_ICONS[proof.type] ?? Camera;
                  return (
                    <div key={proof.id} className="rounded-lg border border-border p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="text-xs font-semibold">{proof.label}</div>
                        <ProofReviewBadge status={proof.reviewStatus} />
                      </div>
                      <div className="overflow-hidden rounded-lg border border-border bg-secondary/40">
                        {proof.downloadUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={proof.downloadUrl}
                            alt={proof.label}
                            className="aspect-square w-full object-cover"
                          />
                        ) : (
                          <div className="grid aspect-square place-items-center">
                            <Icon className="h-8 w-8 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="mt-2 text-[11px] text-muted-foreground">Uploaded {proof.uploadedAt}</div>
                      {proof.reviewNote && (
                        <p className="mt-1 text-xs text-muted-foreground">{proof.reviewNote}</p>
                      )}
                      {proof.reviewStatus === "pending" && isApiEnabled() && (
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            disabled={reviewingId === proof.id}
                            onClick={() => handleReview(proof.id, "approved")}
                            className="min-h-11 flex-1 rounded-lg bg-success px-2 py-1.5 text-xs font-semibold text-white hover:bg-success/90 disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={reviewingId === proof.id}
                            onClick={() => handleReview(proof.id, "rejected")}
                            className="min-h-11 flex-1 rounded-lg border border-primary px-2 py-1.5 text-xs font-semibold text-primary hover:bg-primary/5 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {PLACEHOLDER_PROOFS.map((p) => (
                  <div key={p.label} className="text-center">
                    <div className="mb-1 text-xs text-muted-foreground">{p.label}</div>
                    <div className="grid aspect-square place-items-center rounded-lg border border-border bg-secondary/40">
                      <p.icon className="h-6 w-6 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      {/* Fixed mobile action strip — does not cover content (pb-24 above) */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/80 md:hidden pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-lg gap-2">
          <button
            type="button"
            onClick={() => openAssign()}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
          >
            <Users className="h-4 w-4" /> {d.driver ? "Reassign" : "Assign Driver"}
          </button>
          {customerPhone && (
            <a
              href={customerPhone}
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-input bg-card"
              aria-label="Call customer"
            >
              <Phone className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 break-words text-sm">{value}</div>
    </div>
  );
}
