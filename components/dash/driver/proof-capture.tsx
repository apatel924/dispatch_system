'use client'

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Eraser, IdCard, PenTool, X } from "lucide-react";

type CaptureMode = "photo" | "signature" | "id";

interface ProofCaptureSheetProps {
  open: boolean;
  mode: CaptureMode;
  title: string;
  onClose: () => void;
  onSave: (dataUrl: string) => void;
}

export function ProofCaptureSheet({ open, mode, title, onClose, onSave }: ProofCaptureSheetProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-border bg-card p-4">
        <button onClick={onClose} className="rounded-full p-1.5 hover:bg-secondary" aria-label="Close">
          <X className="h-5 w-5" />
        </button>
        <h2 className="flex-1 text-base font-bold">{title}</h2>
      </header>
      <div className="flex-1 overflow-y-auto p-4">
        {mode === "signature" ? (
          <SignatureCapture onSave={onSave} onCancel={onClose} />
        ) : (
          <PhotoCapture mode={mode} onSave={onSave} onCancel={onClose} />
        )}
      </div>
    </div>
  );
}

function PhotoCapture({ mode, onSave, onCancel }: { mode: "photo" | "id"; onSave: (url: string) => void; onCancel: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

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
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {preview ? (
        <div className="space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Preview" className="w-full rounded-2xl border border-border object-cover" />
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => { setPreview(null); inputRef.current && (inputRef.current.value = ""); }}
              className="flex h-12 items-center justify-center gap-1.5 rounded-xl border border-border text-sm font-semibold hover:bg-secondary"
            >
              Retake
            </button>
            <button
              onClick={() => onSave(preview)}
              className="flex h-12 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Attach Photo
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          className="flex h-48 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10"
        >
          <Camera className="h-10 w-10 text-primary" />
          <span className="text-sm font-semibold text-primary">Open Camera / Gallery</span>
        </button>
      )}

      <button onClick={onCancel} className="text-center text-sm text-muted-foreground hover:text-foreground">Cancel</button>
    </div>
  );
}

function SignatureCapture({ onSave, onCancel }: { onSave: (url: string) => void; onCancel: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasStroke, setHasStroke] = useState(false);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
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

  const save = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasStroke) return;
    onSave(canvas.toDataURL("image/png"));
  };

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
        <button onClick={clear} className="flex h-12 items-center justify-center gap-1.5 rounded-xl border border-border text-sm font-semibold hover:bg-secondary">
          <Eraser className="h-4 w-4" /> Clear
        </button>
        <button onClick={onCancel} className="flex h-12 items-center justify-center rounded-xl border border-border text-sm font-semibold hover:bg-secondary">
          Cancel
        </button>
        <button
          disabled={!hasStroke}
          onClick={save}
          className="flex h-12 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Save
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
}

export function ProofThumbnail({ label, dataUrl, required, icon, onCapture, onRemove }: ProofThumbnailProps) {
  return (
    <button
      type="button"
      onClick={dataUrl ? undefined : onCapture}
      className="relative flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-3 text-center hover:border-primary/40"
    >
      {dataUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={dataUrl} alt={label} className="h-20 w-full rounded-lg object-cover" />
          <span className="text-xs font-semibold text-success">Attached</span>
          {onRemove && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onRemove(); } }}
              className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-background/90 text-muted-foreground shadow-sm hover:text-primary"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
        </>
      ) : (
        <>
          <div className="grid h-14 w-14 place-items-center rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 text-primary">
            {icon}
          </div>
          <span className="text-xs font-semibold">{label}</span>
          {required && <span className="text-[10px] text-muted-foreground">Required</span>}
        </>
      )}
    </button>
  );
}
