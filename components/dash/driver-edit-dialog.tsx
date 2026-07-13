"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { CheckCircle2, X } from "lucide-react";
import type { AdminDriverRow } from "@/lib/dash/api/adapters";
import { driverToAdminRow } from "@/lib/dash/api/adapters";
import { isApiEnabled } from "@/lib/dash/api/config";
import { AdminApiError, updateDriverApi } from "@/lib/dash/api/client";
import {
  DRIVER_STATUSES,
  DRIVER_STATUS_DESCRIPTIONS,
  isDriverUnavailable,
} from "@/lib/driver-status";
import type { DriverStatus } from "@/lib/types/backend";

const PHONE_DIGITS_MIN = 10;
const PHONE_DIGITS_MAX = 15;

function validatePhone(phone: string): string | null {
  const trimmed = phone.trim();
  if (!trimmed) return "Phone number is required.";
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < PHONE_DIGITS_MIN || digits.length > PHONE_DIGITS_MAX) {
    return "Enter a valid phone number.";
  }
  return null;
}

function validateName(name: string): string | null {
  if (!name.trim()) return "Display name is required.";
  return null;
}

export function DriverEditDialog({
  driver,
  open,
  onClose,
  onSaved,
}: {
  driver: AdminDriverRow;
  open: boolean;
  onClose: () => void;
  onSaved: (driver: AdminDriverRow) => void;
}) {
  const titleId = useId();
  const statusSelectId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState(driver.name);
  const [phone, setPhone] = useState(driver.phone);
  const [vehicle, setVehicle] = useState(driver.vehicle ?? "");
  const [adminNote, setAdminNote] = useState(driver.adminNote ?? "");
  const [status, setStatus] = useState<DriverStatus>(driver.status);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmDeactivateOpen, setConfirmDeactivateOpen] = useState(false);
  const [pendingAcknowledge, setPendingAcknowledge] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(driver.name);
    setPhone(driver.phone);
    setVehicle(driver.vehicle ?? "");
    setAdminNote(driver.adminNote ?? "");
    setStatus(driver.status);
    setFieldErrors({});
    setError(null);
    setSuccess(null);
    setConfirmDeactivateOpen(false);
    setPendingAcknowledge(false);
  }, [open, driver]);

  const handleClose = useCallback(() => {
    if (saving) return;
    onClose();
  }, [onClose, saving]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!saving && !confirmDeactivateOpen) handleClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, saving, confirmDeactivateOpen, handleClose]);

  useEffect(() => {
    if (open) dialogRef.current?.focus();
  }, [open]);

  function validateFields(): boolean {
    const nextErrors: Record<string, string> = {};
    const nameError = validateName(name);
    const phoneError = validatePhone(phone);
    if (nameError) nextErrors.name = nameError;
    if (phoneError) nextErrors.phone = phoneError;
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function saveDriver(acknowledgeActiveAssignments = false) {
    if (!isApiEnabled() || saving) return;
    if (!validateFields()) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const { driver: updated } = await updateDriverApi(driver.id, {
        name: name.trim(),
        phone: phone.trim(),
        vehicle: vehicle.trim(),
        adminNote: adminNote.trim(),
        status,
        acknowledgeActiveAssignments: acknowledgeActiveAssignments || undefined,
      });

      const row = driverToAdminRow(updated);
      setSuccess("Driver profile saved.");
      onSaved(row);
      window.setTimeout(() => {
        onClose();
      }, 700);
    } catch (err) {
      if (
        err instanceof AdminApiError &&
        err.status === 409 &&
        err.message.includes("active assignment")
      ) {
        setConfirmDeactivateOpen(true);
        setPendingAcknowledge(true);
        setError(null);
      } else {
        setError(
          err instanceof Error
            ? err.message
            : "We could not save this driver. Please try again.",
        );
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!validateFields()) return;

    const deactivating =
      isDriverUnavailable(status) && !isDriverUnavailable(driver.status);
    if (deactivating && driver.activeDeliveries > 0) {
      setConfirmDeactivateOpen(true);
      setPendingAcknowledge(false);
      return;
    }

    await saveDriver(false);
  }

  async function handleConfirmDeactivate() {
    setConfirmDeactivateOpen(false);
    await saveDriver(true);
  }

  if (!open) return null;

  const activeAssignmentCount = driver.activeDeliveries;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close dialog"
        onClick={handleClose}
        disabled={saving}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative z-10 w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-xl outline-none"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id={titleId} className="text-lg font-semibold">
            Edit driver
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary"
            aria-label="Close"
            disabled={saving}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <Field
            label="Display name"
            value={name}
            onChange={setName}
            error={fieldErrors.name}
            required
            disabled={saving}
          />
          <Field
            label="Phone number"
            value={phone}
            onChange={setPhone}
            error={fieldErrors.phone}
            required
            disabled={saving}
          />
          <Field
            label="Vehicle description"
            value={vehicle}
            onChange={setVehicle}
            placeholder="Not provided"
            disabled={saving}
          />
          <div>
            <label htmlFor={statusSelectId} className="mb-1.5 block text-sm font-medium">
              Availability / status
            </label>
            <select
              id={statusSelectId}
              value={status}
              onChange={(e) => setStatus(e.target.value as DriverStatus)}
              disabled={saving}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
            >
              {DRIVER_STATUSES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {DRIVER_STATUS_DESCRIPTIONS[status]} Login email and password are managed under
              Driver Account Access on this profile.
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Internal admin note</label>
            <textarea
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              rows={3}
              disabled={saving}
              placeholder="Optional note visible only to administrators"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          {success ? (
            <p className="flex items-center gap-1.5 text-sm text-success" role="status">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {success}
            </p>
          ) : null}

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg border border-input px-4 py-2 text-sm font-medium hover:bg-secondary"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>

      {confirmDeactivateOpen ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Dismiss confirmation"
            onClick={() => {
              if (saving) return;
              setConfirmDeactivateOpen(false);
              setPendingAcknowledge(false);
            }}
          />
          <div
            role="alertdialog"
            aria-labelledby={`${titleId}-confirm`}
            className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl"
          >
            <h3 id={`${titleId}-confirm`} className="text-lg font-semibold">
              Active assignments found
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {activeAssignmentCount === 1
                ? "This driver has 1 active assignment."
                : `This driver has ${activeAssignmentCount} active assignments.`}{" "}
              Setting the status to {status} will prevent new assignments, but existing orders
              will stay assigned. Firebase Auth suspension is handled separately.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmDeactivateOpen(false);
                  setPendingAcknowledge(false);
                }}
                disabled={saving}
                className="rounded-lg border border-input px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-60"
              >
                Go back
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmDeactivate()}
                disabled={saving}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {saving ? "Saving…" : pendingAcknowledge ? "Confirm and save" : "Confirm deactivation"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  placeholder,
  error,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
}) {
  const fieldId = useId();
  return (
    <div>
      <label htmlFor={fieldId} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <input
        id={fieldId}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm disabled:opacity-60"
      />
      {error ? (
        <p id={`${fieldId}-error`} className="mt-1 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
