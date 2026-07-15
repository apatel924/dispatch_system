import { describe, expect, it } from "vitest";
import {
  cssPointerPosition,
  resolveDevicePixelRatio,
  setupHiDpiCanvas,
} from "@/lib/dash/signature-canvas";

describe("signature canvas coordinates", () => {
  it("maps pointer CSS coordinates without multiplying by DPR", () => {
    const pos = cssPointerPosition(110, 210, { left: 100, top: 200 });
    expect(pos).toEqual({ x: 10, y: 10 });
  });

  it("falls back to DPR 1 when invalid", () => {
    expect(resolveDevicePixelRatio(0)).toBe(1);
    expect(resolveDevicePixelRatio(Number.NaN)).toBe(1);
    expect(resolveDevicePixelRatio(2)).toBe(2);
  });

  it("scales the context once for DPR 2 without requiring coordinate multiply", () => {
    const scaleCalls: number[] = [];
    const canvas = {
      width: 0,
      height: 0,
      style: { width: "", height: "" },
      getContext: () => ({
        setTransform: () => undefined,
        scale: (x: number, y: number) => {
          scaleCalls.push(x, y);
        },
        strokeStyle: "",
        lineWidth: 0,
        lineCap: "",
        lineJoin: "",
      }),
    } as unknown as HTMLCanvasElement;

    const setup = setupHiDpiCanvas(canvas, 100, 50, 2);
    expect(setup).toEqual({ dpr: 2, cssWidth: 100, cssHeight: 50 });
    expect(canvas.width).toBe(200);
    expect(canvas.height).toBe(100);
    expect(scaleCalls).toEqual([2, 2]);

    // Drawing at CSS (10,10) stays (10,10) after a single context scale.
    const drawAt = cssPointerPosition(10, 10, { left: 0, top: 0 });
    expect(drawAt).toEqual({ x: 10, y: 10 });
    expect(drawAt.x * 2).not.toBe(drawAt.x); // documents why we must not also multiply
  });
});
