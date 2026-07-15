/**
 * HiDPI signature canvas helpers.
 * Drawing uses CSS-space coordinates; the context is scaled once by devicePixelRatio.
 */

export function resolveDevicePixelRatio(dpr?: number): number {
  const value =
    dpr ??
    (typeof window !== "undefined" && Number.isFinite(window.devicePixelRatio)
      ? window.devicePixelRatio
      : 1);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

/** Map client pointer coordinates into CSS-space canvas coordinates (no DPR multiply). */
export function cssPointerPosition(
  clientX: number,
  clientY: number,
  rect: Pick<DOMRect, "left" | "top">,
): { x: number; y: number } {
  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
  };
}

export interface CanvasHiDpiSetup {
  dpr: number;
  cssWidth: number;
  cssHeight: number;
}

/**
 * Size the backing store for sharpness and scale the 2D context once so
 * subsequent drawing calls use CSS-space units.
 * Clears the canvas (setting width/height resets state).
 */
export function setupHiDpiCanvas(
  canvas: HTMLCanvasElement,
  cssWidth: number,
  cssHeight: number,
  dpr = resolveDevicePixelRatio(),
): CanvasHiDpiSetup | null {
  if (cssWidth <= 0 || cssHeight <= 0) return null;

  const ratio = resolveDevicePixelRatio(dpr);
  canvas.width = Math.max(1, Math.round(cssWidth * ratio));
  canvas.height = Math.max(1, Math.round(cssHeight * ratio));
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(ratio, ratio);
  applyStrokeStyle(ctx);

  return { dpr: ratio, cssWidth, cssHeight };
}

export function applyStrokeStyle(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = "#1a1a1a";
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}

/** Clear using CSS-space dimensions (context already scaled by DPR). */
export function clearCanvasCssSpace(
  ctx: CanvasRenderingContext2D,
  cssWidth: number,
  cssHeight: number,
): void {
  ctx.clearRect(0, 0, cssWidth, cssHeight);
  applyStrokeStyle(ctx);
}

/**
 * Restore ink after a HiDPI resize by redrawing a previous PNG snapshot.
 */
export function restoreInkFromDataUrl(
  ctx: CanvasRenderingContext2D,
  dataUrl: string,
  cssWidth: number,
  cssHeight: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, cssWidth, cssHeight);
      applyStrokeStyle(ctx);
      resolve();
    };
    img.onerror = () => reject(new Error("Could not restore signature"));
    img.src = dataUrl;
  });
}
