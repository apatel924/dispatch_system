'use client'

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Eraser, IdCard, Loader2, PenTool, X } from "lucide-react";
import {
  formatProofByteSize,
  prepareProofImage,
  type ClientProofType,
} from "@/lib/dash/proof-image-prepare";

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
  const [hasStroke, setHasStroke] = useState(false);
  const [savingLocal, setSavingLocal] = useState(false);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || savingLocal || saving) return;
    drawing.current = true;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    canvasRef.current?.setPointerCapture(e.pointerId);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasStroke(true);
  };

  const endDraw = () => { drawing.current = false; };

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(2, 2);
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  useEffect(() => { setupCanvas(); }, [setupCanvas]);

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasStroke(false);
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
          onPointerDown={startDraw}
          onPointerMove={draw}
          onPointerUp={endDraw}
          onPointerLeave={endDraw}
        />
        {!hasStroke && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground/50">
            Sign here
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button
          disabled={busy}
          onClick={clear}
          className="flex h-12 items-center justify-center gap-1.5 rounded-xl border border-border text-sm font-semibold hover:bg-secondary disabled:opacity-50"
        >
          <Eraser className="h-4 w-4" /> Clear
        </button>
        <button
          disabled={busy}
          onClick={onCancel}
          className="flex h-12 items-center justify-center rounded-xl border border-border text-sm font-semibold hover:bg-secondary disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          disabled={!hasStroke || busy}
          onClick={() => void save()}
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
  uploading?: boolean;
  uploadError?: string;
  onRetry?: () => void;
}

export function ProofThumbnail({
  label,
  dataUrl,
  required,
  icon,
  onCapture,
  onRemove,
  uploading,
  uploadError,
  onRetry,
}: ProofThumbnailProps) {
  return (
    <div className="relative flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-3 text-center">
      {dataUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={dataUrl} alt={label} className="h-20 w-full rounded-lg object-cover" />
          {uploading ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
              <Loader2 className="h-3 w-3 animate-spin" /> Uploading…
            </span>
          ) : uploadError ? (
            <div className="space-y-1">
              <span className="block text-[10px] text-destructive">{uploadError}</span>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="text-[10px] font-semibold text-primary hover:underline"
                >
                  Retry upload
                </button>
              )}
            </div>
          ) : (
            <span className="text-xs font-semibold text-success">Attached</span>
          )}
          {onRemove && !uploading && (
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
          disabled={uploading}
          onClick={onCapture}
          className="flex w-full flex-col items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <div className="grid h-14 w-14 place-items-center rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 text-primary">
            {icon}
          </div>
          <span className="text-xs font-semibold">{label}</span>
          {required && <span className="text-[10px] text-muted-foreground">Required</span>}
        </button>
      )}
    </div>
  );
}
