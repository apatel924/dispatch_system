"use client";

import { useCallback, useEffect, useState } from "react";
import { Eye, EyeOff, KeyRound, Link2, Mail, ShieldAlert, ShieldCheck } from "lucide-react";
import type { DriverAccountAccess } from "@/lib/types/backend";
import { isApiEnabled } from "@/lib/dash/api/config";
import { fetchDriverAccount, updateDriverAccountApi } from "@/lib/dash/api/client";
import { SectionCard } from "@/components/dash/ui/section-card";
import { DashErrorState, DashLoadingState } from "@/components/dash/ui/query-state";

type ModalMode = "email" | "password" | "disable" | "enable" | "link" | null;

function ConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  loading,
  destructive,
  onConfirm,
  onCancel,
  children,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  loading?: boolean;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-lg">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        {children ? <div className="mt-4 space-y-3">{children}</div> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-input px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50 ${
              destructive
                ? "bg-destructive hover:bg-destructive/90"
                : "bg-primary hover:bg-primary/90"
            }`}
          >
            {loading ? "Saving…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  visible,
  onToggleVisible,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggleVisible: () => void;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="new-password"
          className="h-10 w-full rounded-lg border border-input bg-background px-3 pr-10 text-sm"
        />
        <button
          type="button"
          onClick={onToggleVisible}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export function DriverAccountAccessCard({
  driverId,
  driverName,
}: {
  driverId: string;
  driverName: string;
}) {
  const [account, setAccount] = useState<DriverAccountAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalMode>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [loginEmail, setLoginEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [linkAuthUid, setLinkAuthUid] = useState("");

  const loadAccount = useCallback(async () => {
    if (!isApiEnabled()) {
      setError("API mode is required to manage driver login accounts.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { account: next } = await fetchDriverAccount(driverId);
      setAccount(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load account access");
    } finally {
      setLoading(false);
    }
  }, [driverId]);

  useEffect(() => {
    void loadAccount();
  }, [loadAccount]);

  function openModal(mode: ModalMode) {
    setFormError(null);
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
    if (mode === "email") {
      setLoginEmail(account?.loginEmail ?? "");
      setDisplayName(account?.displayName ?? "");
    }
    if (mode === "link") {
      setLinkAuthUid("");
    }
    setModal(mode);
  }

  function closeModal() {
    if (saving) return;
    setModal(null);
    setFormError(null);
  }

  async function handleEmailSave() {
    if (saving) return;
    setSaving(true);
    setFormError(null);
    try {
      const patch: {
        loginEmail?: string;
        displayName?: string;
      } = {};
      const trimmedEmail = loginEmail.trim().toLowerCase();
      if (!trimmedEmail) {
        setFormError("Login email is required");
        return;
      }
      if (trimmedEmail !== (account?.loginEmail ?? "")) {
        patch.loginEmail = trimmedEmail;
      }
      const trimmedDisplay = displayName.trim();
      if (trimmedDisplay && trimmedDisplay !== (account?.displayName ?? "")) {
        patch.displayName = trimmedDisplay;
      }
      if (!patch.loginEmail && !patch.displayName) {
        setFormError("Change the login email or display name to save");
        return;
      }
      const { account: next } = await updateDriverAccountApi(driverId, patch);
      setAccount(next);
      setModal(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to update login email");
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordSave() {
    if (saving) return;
    if (password !== confirmPassword) {
      setFormError("Password confirmation does not match");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const { account: next } = await updateDriverAccountApi(driverId, {
        password,
        confirmPassword,
      });
      setAccount(next);
      setPassword("");
      setConfirmPassword("");
      setModal(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to set password");
    } finally {
      setSaving(false);
    }
  }

  async function handleDisableSave() {
    if (saving) return;
    setSaving(true);
    setFormError(null);
    try {
      const { account: next } = await updateDriverAccountApi(driverId, { disabled: true });
      setAccount(next);
      setModal(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to disable account");
    } finally {
      setSaving(false);
    }
  }

  async function handleEnableSave() {
    if (saving) return;
    setSaving(true);
    setFormError(null);
    try {
      const { account: next } = await updateDriverAccountApi(driverId, { disabled: false });
      setAccount(next);
      setModal(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to enable account");
    } finally {
      setSaving(false);
    }
  }

  async function handleLinkSave() {
    if (saving) return;
    const uid = linkAuthUid.trim();
    if (!uid) {
      setFormError("Firebase Auth UID is required");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const { account: next } = await updateDriverAccountApi(driverId, { linkAuthUid: uid });
      setAccount(next);
      setModal(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to link authentication account");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <SectionCard title="Driver Account Access" className="mt-6">
        {loading ? (
          <DashLoadingState message="Loading login account…" className="py-6" />
        ) : error ? (
          <DashErrorState message={error} />
        ) : !account ? null : !account.linked ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">Authentication account not linked</p>
                <p className="mt-1 text-amber-900/80 dark:text-amber-100/80">
                  Create the driver in Firebase Console → Authentication, copy their UID, then link
                  it here. Run the seed script or set custom claims (
                  {`{ role: "driver", driverId: "${driverId}" }`}) before linking.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => openModal("link")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-card px-3 py-2 text-sm font-medium hover:bg-secondary"
            >
              <Link2 className="h-4 w-4" /> Link Firebase Auth account
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Managing login access for <span className="font-medium text-foreground">{driverName}</span>{" "}
              ({driverId}). Operational profile edits are separate from these security actions.
            </p>

            <dl className="grid gap-3 sm:grid-cols-2">
              <InfoRow label="Login email" value={account.loginEmail ?? "—"} />
              <InfoRow label="Auth display name" value={account.displayName ?? "—"} />
              <InfoRow
                label="Login account"
                value={
                  account.disabled ? (
                    <span className="inline-flex items-center gap-1 text-destructive">
                      <ShieldAlert className="h-3.5 w-3.5" /> Disabled
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                      <ShieldCheck className="h-3.5 w-3.5" /> Enabled
                    </span>
                  )
                }
              />
              <InfoRow
                label="Last credential update"
                value={
                  account.accountUpdatedAt
                    ? new Date(account.accountUpdatedAt).toLocaleString()
                    : "—"
                }
              />
            </dl>

            {account.activeOrderCount != null && account.activeOrderCount > 0 ? (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                This driver has {account.activeOrderCount} active order
                {account.activeOrderCount === 1 ? "" : "s"}. Reassign or complete them before
                disabling login.
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2 border-t border-border/60 pt-4">
              <button
                type="button"
                onClick={() => openModal("email")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-card px-3 py-2 text-sm font-medium hover:bg-secondary"
              >
                <Mail className="h-4 w-4" /> Change email
              </button>
              <button
                type="button"
                onClick={() => openModal("password")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-card px-3 py-2 text-sm font-medium hover:bg-secondary"
              >
                <KeyRound className="h-4 w-4" /> Set new password
              </button>
              {account.disabled ? (
                <button
                  type="button"
                  onClick={() => openModal("enable")}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-card px-3 py-2 text-sm font-medium hover:bg-secondary"
                >
                  <ShieldCheck className="h-4 w-4" /> Enable login
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => openModal("disable")}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 bg-card px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/5"
                >
                  <ShieldAlert className="h-4 w-4" /> Disable login
                </button>
              )}
            </div>
          </div>
        )}
      </SectionCard>

      <ConfirmModal
        open={modal === "email"}
        title="Change login email"
        message={`Update the Firebase login email for ${driverName}. Existing driver sessions will be signed out.`}
        confirmLabel="Update email"
        loading={saving}
        onCancel={closeModal}
        onConfirm={() => void handleEmailSave()}
      >
        <div>
          <label className="mb-1.5 block text-sm font-medium">Login email</label>
          <input
            type="email"
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
            autoComplete="off"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">Firebase display name (optional)</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
          />
        </div>
        {formError ? (
          <p className="text-sm text-destructive" role="alert">
            {formError}
          </p>
        ) : null}
      </ConfirmModal>

      <ConfirmModal
        open={modal === "password"}
        title="Set new password"
        message={`Set a new password for ${driverName}. The driver must sign in again; all active sessions will be signed out.`}
        confirmLabel="Set password"
        loading={saving}
        onCancel={closeModal}
        onConfirm={() => void handlePasswordSave()}
      >
        <PasswordField
          label="New password"
          value={password}
          onChange={setPassword}
          visible={showPassword}
          onToggleVisible={() => setShowPassword((v) => !v)}
        />
        <PasswordField
          label="Confirm new password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          visible={showConfirmPassword}
          onToggleVisible={() => setShowConfirmPassword((v) => !v)}
        />
        <p className="text-xs text-muted-foreground">
          At least 8 characters with one letter and one number. Leading or trailing spaces are not
          allowed.
        </p>
        {formError ? (
          <p className="text-sm text-destructive" role="alert">
            {formError}
          </p>
        ) : null}
      </ConfirmModal>

      <ConfirmModal
        open={modal === "disable"}
        title="Disable driver login?"
        message={`Disable Firebase Authentication for ${driverName}? They will not be able to sign in or receive new assignments until login is re-enabled. Delivery history is preserved.`}
        confirmLabel="Disable login"
        loading={saving}
        destructive
        onCancel={closeModal}
        onConfirm={() => void handleDisableSave()}
      >
        {formError ? (
          <p className="text-sm text-destructive" role="alert">
            {formError}
          </p>
        ) : null}
      </ConfirmModal>

      <ConfirmModal
        open={modal === "enable"}
        title="Enable driver login?"
        message={`Re-enable Firebase Authentication for ${driverName}? They will be able to sign in again.`}
        confirmLabel="Enable login"
        loading={saving}
        onCancel={closeModal}
        onConfirm={() => void handleEnableSave()}
      >
        {formError ? (
          <p className="text-sm text-destructive" role="alert">
            {formError}
          </p>
        ) : null}
      </ConfirmModal>

      <ConfirmModal
        open={modal === "link"}
        title="Link Firebase Auth account"
        message={`Paste the Firebase Authentication UID for ${driverName}. Only link accounts you created manually in Firebase Console.`}
        confirmLabel="Link account"
        loading={saving}
        onCancel={closeModal}
        onConfirm={() => void handleLinkSave()}
      >
        <div>
          <label className="mb-1.5 block text-sm font-medium">Firebase Auth UID</label>
          <input
            type="text"
            value={linkAuthUid}
            onChange={(e) => setLinkAuthUid(e.target.value)}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 font-mono text-sm"
            placeholder="e.g. AbCdEf1234567890"
            autoComplete="off"
          />
        </div>
        {formError ? (
          <p className="text-sm text-destructive" role="alert">
            {formError}
          </p>
        ) : null}
      </ConfirmModal>
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/60 bg-secondary/10 px-3 py-2.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{value}</dd>
    </div>
  );
}
