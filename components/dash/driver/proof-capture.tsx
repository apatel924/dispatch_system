'use client'

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Eraser, IdCard, Loader2, PenTool, X } from "lucide-react";
import {
  formatProofByteSize,
  prepareProofImage,
  type ClientProofType,
} from "@/lib/dash/proof-image-prepare";
import {
  applyStrokeStyle,
  clearCanvasCssSpace,
  cssPointerPosition,
  resolveDevicePixelRatio,
  restoreInkFromDataUrl,
  setupHiDpiCanvas,
} from "@/lib/dash/signature-canvas";
import type { ProofSyncStatus } from "@/lib/dash/driver-store";

type CaptureMode = "photo" | "signature" | "id";

interface ProofCaptureSheetProps {
  open: boolean;
  mode: CaptureMode;
  title: string;
  onClose: () => void;
  onSave: (dataUrl: string) => void | Promise<void>;
  saving?: boolean;
}

export function ProofCaptureSheet({ open, mode, title, onClose, onSave, saving }: ProofCaptureSheetProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-border bg-card p-4">
        <button
          onClick={onClose}
          disabled={saving}
          className="rounded-full p-1.5 hover:bg-secondary disabled:opacity-50"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
        <h2 className="flex-1 text-base font-bold">{title}</h2>
      </header>
      <div className="flex-1 overflow-y-auto p-4">
        {mode === "signature" ? (
          <SignatureCapture onSave={onSave} onCancel={onClose} saving={saving} />
        ) : (
          <PhotoCapture mode={mode} onSave={onSave} onCancel={onClose} saving={saving} />
        )}
      </div>
    </div>
  );
}

function PhotoCapture({
  mode,
  onSave,
  onCancel,
  saving,
}: {
  mode: "photo" | "id";
  onSave: (url: string) => void | Promise<void>;
  onCancel: () => void;
  saving?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [preparedSize, setPreparedSize] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [prepareError, setPrepareError] = useState<string | null>(null);
  const [attaching, setAttaching] = useState(false);

  const proofType: ClientProofType = mode === "id" ? "idVerification" : "exteriorPhoto";

  const clearPreview = () => {
    setPreview(null);
    setPreparedSize(null);
    setPrepareError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setPreparing(true);
    setPrepareError(null);
    setPreview(null);
    setPreparedSize(null);

    try {
      const prepared = await prepareProofImage(file, proofType);
      setPreview(prepared.dataUrl);
      setPreparedSize(formatProofByteSize(prepared.byteSize));
    } catch {
      setPrepareError("Could not prepare photo. Try another image or retake.");
    } finally {
      setPreparing(false);
    }
  };

  const handleAttach = async () => {
    if (!preview || attaching || saving) return;
    setAttaching(true);
    try {
      const dataUrl = preview;
      clearPreview();
      await onSave(dataUrl);
    } finally {
      setAttaching(false);
    }
  };

  const busy = preparing || attaching || saving;

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="grid h-11 w-11 place-items-center rounded-full bg-primary/10 text-primary">
          {mode === "id" ? <IdCard className="h-5 w-5" /> : <Camera className="h-5 w-5" />}
        </div>
        <div>
          <div className="text-sm font-semibold">{mode === "id" ? "Verify recipient ID" : "Take a photo"}</div>
          <div className="text-xs text-muted-foreground">Use your camera or choose from gallery</div>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        disabled={busy}
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />

      {preparing && (
        <div className="flex h-48 items-center justify-center gap-2 rounded-2xl border border-border bg-secondary/30 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Preparing photo…
        </div>
      )}

      {prepareError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {prepareError}
        </div>
      )}

      {preview ? (
        <div className="space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Preview" className="w-full rounded-2xl border border-border object-cover" />
          {preparedSize && (
            <div className="text-center text-xs text-muted-foreground">Prepared size: {preparedSize}</div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button
              disabled={busy}
              onClick={clearPreview}
              className="flex h-12 items-center justify-center gap-1.5 rounded-xl border border-border text-sm font-semibold hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
            >
              Retake
            </button>
            <button
              disabled={busy}
              onClick={() => void handleAttach()}
              className="flex h-12 items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {attaching || saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
                </>
              ) : (
                "Attach Photo"
              )}
            </button>
          </div>
        </div>
      ) : !preparing ? (
        <button
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="flex h-48 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Camera className="h-10 w-10 text-primary" />
          <span className="text-sm font-semibold text-primary">Open Camera / Gallery</span>
        </button>
      ) : null}

      <button
        disabled={busy}
        onClick={onCancel}
        className="text-center text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
      >
        Cancel
      </button>
    </div>
  );
}

function SignatureCapture({
  onSave,
  onCancel,
  saving,
}: {
  onSave: (url: string) => void | Promise<void>;
  onCancel: () => void;
  saving?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const cssSize = useRef({ width: 0, height: 0 });
  const inkSnapshot = useRef<string | null>(null);
  const activePointerId = useRef<number | null>(null);
  const hasStrokeRef = useRef(false);
  const [hasStroke, setHasStroke] = useState(false);
  const [savingLocal, setSavingLocal] = useState(false);

  const setStrokeState = (value: boolean) => {
    hasStrokeRef.current = value;
    setHasStroke(value);
  };

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return cssPointerPosition(e.clientX, e.clientY, rect);
  };

  const configureCanvas = useCallback(async (preserveInk: boolean) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const nextWidth = rect.width;
    const nextHeight = rect.height;
    if (nextWidth <= 0 || nextHeight <= 0) return;

    const sizeChanged =
      Math.abs(nextWidth - cssSize.current.width) > 0.5 ||
      Math.abs(nextHeight - cssSize.current.height) > 0.5;
    const snapshot =
      preserveInk && hasStrokeRef.current ? canvas.toDataURL("image/png") : inkSnapshot.current;

    if (!sizeChanged && cssSize.current.width > 0) {
      const ctx = canvas.getContext("2d");
      if (ctx) applyStrokeStyle(ctx);
      return;
    }

    const setup = setupHiDpiCanvas(
      canvas,
      nextWidth,
      nextHeight,
      resolveDevicePixelRatio(),
    );
    if (!setup) return;
    cssSize.current = { width: setup.cssWidth, height: setup.cssHeight };

    if (snapshot) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        try {
          await restoreInkFromDataUrl(ctx, snapshot, setup.cssWidth, setup.cssHeight);
          inkSnapshot.current = snapshot;
          setStrokeState(true);
        } catch {
          inkSnapshot.current = null;
        }
      }
    }
  }, []);

  useEffect(() => {
    void configureCanvas(false);
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      void configureCanvas(true);
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [configureCanvas]);

  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || savingLocal || saving) return;
    e.preventDefault();
    drawing.current = true;
    activePointerId.current = e.pointerId;
    const { x, y } = getPos(e);
    lastPoint.current = { x, y };
    ctx.beginPath();
    ctx.moveTo(x, y);
    canvas.setPointerCapture(e.pointerId);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || activePointerId.current !== e.pointerId) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    e.preventDefault();
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    // Reset path so repeated stroke() calls do not darken prior segments.
    ctx.beginPath();
    ctx.moveTo(x, y);
    lastPoint.current = { x, y };
    if (!hasStrokeRef.current) setStrokeState(true);
  };

  const endDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointerId.current !== null && e.pointerId !== activePointerId.current) return;
    const canvas = canvasRef.current;
    if (canvas?.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }
    drawing.current = false;
    activePointerId.current = null;
    lastPoint.current = null;
    if (hasStrokeRef.current && canvas) {
      inkSnapshot.current = canvas.toDataURL("image/png");
    }
  };

  const handlePointerLeave = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // While captured, keep the stroke active even if the pointer leaves the element.
    if (drawing.current && canvasRef.current?.hasPointerCapture(e.pointerId)) return;
    endDraw(e);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    clearCanvasCssSpace(ctx, cssSize.current.width || canvas.clientWidth, cssSize.current.height || canvas.clientHeight);
    setStrokeState(false);
    inkSnapshot.current = null;
    lastPoint.current = null;
  };

  const save = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasStroke || savingLocal || saving) return;
    setSavingLocal(true);
    try {
      const raw = canvas.toDataURL("image/png");
      const prepared = await prepareProofImage(raw, "signature");
      await onSave(prepared.dataUrl);
    } finally {
      setSavingLocal(false);
    }
  };

  const busy = savingLocal || saving;

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="grid h-11 w-11 place-items-center rounded-full bg-primary/10 text-primary">
          <PenTool className="h-5 w-5" />
        </div>
        <div>
          <div className="text-sm font-semibold">Sign below</div>
          <div className="text-xs text-muted-foreground">Ask the recipient to sign in the box</div>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-2xl border-2 border-border bg-white">
        <canvas
          ref={canvasRef}
          className="h-52 w-full touch-none"
          style={{ touchAction: "none" }}
          aria-label="Signature pad"
          onPointerDown={startDraw}
          onPointerMove={draw}
          onPointerUp={endDraw}
          onPointerCancel={endDraw}
          onPointerLeave={handlePointerLeave}
        />
        {!hasStroke && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground/50">
            Sign here
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={clear}
          aria-label="Clear signature"
          className="flex h-12 items-center justify-center gap-1.5 rounded-xl border border-border text-sm font-semibold hover:bg-secondary disabled:opacity-50"
        >
          <Eraser className="h-4 w-4" /> Clear
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          aria-label="Cancel signature"
          className="flex h-12 items-center justify-center rounded-xl border border-border text-sm font-semibold hover:bg-secondary disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!hasStroke || busy}
          onClick={() => void save()}
          aria-label="Save signature"
          className="flex h-12 items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
        </button>
      </div>
    </div>
  );
}

interface ProofThumbnailProps {
  label: string;
  dataUrl?: string;
  required?: boolean;
  icon: React.ReactNode;
  onCapture: () => void;
  onRemove?: () => void;
  syncStatus?: ProofSyncStatus;
  uploading?: boolean;
  uploadError?: string;
  onRetry?: () => void;
  disabled?: boolean;
}

function syncStatusLabel(
  syncStatus: ProofSyncStatus | undefined,
  uploading: boolean | undefined,
  uploadError: string | undefined,
): { text: string; className: string } {
  if (uploading || syncStatus === "uploading" || syncStatus === "preparing") {
    return { text: "Uploading…", className: "text-primary" };
  }
  if (uploadError || syncStatus === "failed") {
    return { text: "Upload failed", className: "text-destructive" };
  }
  if (syncStatus === "synced") {
    return { text: "Uploaded", className: "text-success" };
  }
  if (syncStatus === "captured_locally") {
    return { text: "Captured locally", className: "text-amber-700 dark:text-amber-300" };
  }
  return { text: "Not captured", className: "text-muted-foreground" };
}

export function ProofThumbnail({
  label,
  dataUrl,
  required,
  icon,
  onCapture,
  onRemove,
  syncStatus,
  uploading,
  uploadError,
  onRetry,
  disabled,
}: ProofThumbnailProps) {
  const status = syncStatusLabel(syncStatus, uploading, uploadError);
  const busy = Boolean(uploading || disabled || syncStatus === "uploading" || syncStatus === "preparing");
  const showPreview = Boolean(dataUrl);

  return (
    <div className="relative flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-3 text-center">
      {showPreview ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={dataUrl} alt={label} className="h-20 w-full rounded-lg object-cover" />
          <div className="space-y-1">
            <span className={`inline-flex items-center gap-1 text-xs font-semibold ${status.className}`}>
              {(uploading || syncStatus === "uploading") && (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              )}
              {status.text}
            </span>
            {required && (
              <span className="block text-[10px] text-muted-foreground">Required</span>
            )}
            {uploadError && (
              <span className="block text-[10px] text-destructive" role="alert">
                {uploadError}
              </span>
            )}
            {onRetry && (uploadError || syncStatus === "failed") && !busy && (
              <button
                type="button"
                onClick={onRetry}
                aria-label={`Retry upload for ${label}`}
                className="text-[10px] font-semibold text-primary hover:underline"
              >
                Retry upload
              </button>
            )}
            {(syncStatus === "failed" || syncStatus === "captured_locally") && !busy && (
              <button
                type="button"
                onClick={onCapture}
                aria-label={`Replace ${label}`}
                className="block w-full text-[10px] font-semibold text-muted-foreground hover:text-foreground"
              >
                Replace
              </button>
            )}
          </div>
          {onRemove && !busy && (
            <button
              type="button"
              onClick={onRemove}
              className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-background/90 text-muted-foreground shadow-sm hover:text-primary"
              aria-label={`Remove ${label}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={onCapture}
          aria-label={`Capture ${label}`}
          className="flex w-full flex-col items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <div className="grid h-14 w-14 place-items-center rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 text-primary">
            {icon}
          </div>
          <span className="text-xs font-semibold">{label}</span>
          {required ? (
            <span className="text-[10px] text-muted-foreground">Required · Not captured</span>
          ) : (
            <span className="text-[10px] text-muted-foreground">Optional · Not captured</span>
          )}
        </button>
      )}
    </div>
  );
}
