// nitpicker — the dock Region path must feel INSTANT. The lag it fixes: onDragEnd used to
// `await captureRegion(...)` (a full-page rasterization) *before* opening the queue card, so the card
// appeared ~1-2s after the drag release. The fix pre-rasterizes at drag-start (mouse-down) so the raster
// overlaps the drag, and mouse-up only does the cheap annotateRegion crop. We pin that here by spying on
// the region module: rasterizeViewport must fire at drag-start, and mouse-up must take the annotateRegion
// crop path — NOT the rasterize-on-mouse-up captureRegion path (which is the thing that made it slow).
import { describe, it, expect, afterEach, vi } from "vitest";

// vi.hoisted so these spies exist when the hoisted vi.mock factory runs.
const { rasterizeViewport, annotateRegion, captureRegion } = vi.hoisted(() => ({
  rasterizeViewport: vi.fn(async () => ({
    canvas: document.createElement("canvas"),
    warning: null,
  })),
  annotateRegion: vi.fn(async () => ({
    blob: new Blob(["x"], { type: "image/png" }),
    thumb: "data:image/png;base64,AAAA",
  })),
  // The slow mouse-up rasterizer. If this ever fires on the dock path, the flow regressed to blocking.
  captureRegion: vi.fn(async () => ({
    blob: new Blob(["x"], { type: "image/png" }),
    canvas: document.createElement("canvas"),
    thumb: "",
    warning: null,
  })),
}));

vi.mock("../core/region", () => ({ rasterizeViewport, annotateRegion, captureRegion }));

import { Nitpicker } from "../core";
import type { NitpickerHandle } from "../core";

const ORIGINAL_ENV = process.env.NODE_ENV;
let handle: NitpickerHandle | null = null;

afterEach(() => {
  handle?.unmount();
  handle = null;
  process.env.NODE_ENV = ORIGINAL_ENV;
  document.querySelectorAll('[data-nitpicker="root"]').forEach((n) => n.remove());
  rasterizeViewport.mockClear();
  annotateRegion.mockClear();
  captureRegion.mockClear();
});

function mount(): ShadowRoot {
  process.env.NODE_ENV = "development";
  handle = Nitpicker.mount({ session: "t" });
  const host = document.querySelector('[data-nitpicker="root"]');
  if (!host?.shadowRoot) throw new Error("overlay host / shadowRoot missing");
  return host.shadowRoot;
}

function mouse(type: string, x: number, y: number): MouseEvent {
  return new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true });
}

describe("dock Region path is pre-rasterized so the card opens instantly", () => {
  it("rasterizes at drag-start (mouse-down), not on release", () => {
    const root = mount();
    (root.querySelectorAll(".np-dock button")[1] as HTMLButtonElement).click(); // Region

    expect(rasterizeViewport).not.toHaveBeenCalled();
    root.querySelector(".np-interaction")!.dispatchEvent(mouse("mousedown", 60, 80));
    // The moment the drag starts, the viewport raster is already kicked off — it runs concurrently with
    // the user dragging out their box, so it's done (or nearly) by the time they release.
    expect(rasterizeViewport).toHaveBeenCalledTimes(1);
  });

  it("mouse-up crops the pre-frozen canvas (annotateRegion) and never rasterizes on release", async () => {
    const root = mount();
    (root.querySelectorAll(".np-dock button")[1] as HTMLButtonElement).click(); // Region

    root.querySelector(".np-interaction")!.dispatchEvent(mouse("mousedown", 60, 80));
    window.dispatchEvent(mouse("mousemove", 300, 260));
    window.dispatchEvent(mouse("mouseup", 300, 260));

    // The queue card opens off the fast crop path…
    await vi.waitFor(() => expect(annotateRegion).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(root.querySelector(".np-card")).not.toBeNull());
    // …and the slow rasterize-on-release path was never taken (that was the ~1-2s stall).
    expect(captureRegion).not.toHaveBeenCalled();
    // still exactly one raster total — the drag-start one, reused; no double work.
    expect(rasterizeViewport).toHaveBeenCalledTimes(1);
  });

  it("a too-small drag clears the frozen snapshot so the page returns live (no stuck freeze)", () => {
    const root = mount();
    (root.querySelectorAll(".np-dock button")[1] as HTMLButtonElement).click(); // Region

    root.querySelector(".np-interaction")!.dispatchEvent(mouse("mousedown", 100, 100));
    window.dispatchEvent(mouse("mouseup", 102, 102)); // <6px → not a selection

    expect(root.querySelector(".np-snapshot")?.classList.contains("np-show")).toBe(false);
    expect(root.querySelector(".np-card")).toBeNull();
    // still in Region mode, ready for another drag
    expect(root.querySelector(".np-interaction")?.classList.contains("np-armed")).toBe(true);
  });
});
