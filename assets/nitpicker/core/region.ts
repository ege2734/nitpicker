// @nitpicker/core — region capture. On mouse-up we freeze the view, rasterize the whole viewport with
// html2canvas, then composite the gray-dim + red-box annotation onto the captured canvas at the correct
// device-pixel scale. html2canvas is imported dynamically so it is only ever pulled into the bundle
// inside this dev-only path (and thus tree-shaken from any prod build).
import { compositeRegion, checkCaptureScale } from "./redbox";
import type { Rect } from "./types";

export interface CaptureResult {
  blob: Blob;
  /** the composited frozen canvas, shown on top to freeze the view. */
  canvas: HTMLCanvasElement;
  /** small data-URL thumbnail for the chat panel. */
  thumb: string;
  /** scale-check warning, if any. */
  warning: string | null;
}

/**
 * Capture the current viewport, burn in the gray-dim + red box around `selCss`, and return the frozen
 * canvas + a PNG blob. `hostEl` is the overlay's own shadow host, excluded from the capture so our UI
 * never appears in the screenshot.
 */
export async function captureRegion(
  selCss: Rect,
  scale: number,
  hostEl: Element,
): Promise<CaptureResult> {
  const { default: html2canvas } = await import("html2canvas");
  const viewport = { w: window.innerWidth, h: window.innerHeight };

  const canvas = await html2canvas(document.body, {
    x: window.scrollX,
    y: window.scrollY,
    width: viewport.w,
    height: viewport.h,
    scale,
    useCORS: true,
    backgroundColor: null,
    logging: false,
    // Exclude our overlay UI from the raster. The shadow host also carries data-html2canvas-ignore as
    // a belt-and-braces guard.
    ignoreElements: (el) => el === hostEl,
  });

  const warning = checkCaptureScale(canvas, viewport, scale);
  if (warning) console.warn(warning);

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("nitpicker: could not get 2d context for composite");
  compositeRegion(ctx, selCss, scale);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("nitpicker: toBlob failed"))),
      "image/png",
    );
  });

  return { blob, canvas, thumb: makeThumb(canvas), warning };
}

/** Downscale the composited canvas into a tiny data URL for the panel snippet card. */
function makeThumb(canvas: HTMLCanvasElement, maxW = 160): string {
  const ratio = canvas.height / canvas.width;
  const t = document.createElement("canvas");
  t.width = maxW;
  t.height = Math.round(maxW * ratio);
  const tctx = t.getContext("2d");
  if (tctx) tctx.drawImage(canvas, 0, 0, t.width, t.height);
  return t.toDataURL("image/png");
}
