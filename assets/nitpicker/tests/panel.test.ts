// nitpicker — the feedback pane is a DOCKED sidebar, not an overlay. Invariants pinned here:
//   (1) The pane is shown by default and RESERVES its width on <html> (margin-right) so the host app
//       reflows beside it and it never covers page content.
//   (2) Queuing a Region/Element mark just appends to the always-visible pane list + ticks the dock
//       badge — no overlay pops over the page, and the shown/hidden state is untouched by enqueue.
//   (3) A hide/show toggle (pane top-left to hide, dock queue button to re-show) reserves/releases the
//       width both ways.
//   (4) Screenshots exclude the pane: region capture is clipped to the app area (viewport − pane width).
//   (5) After a completed Region/Element mark the overlay snaps back to Cursor mode.
import { describe, it, expect, afterEach, vi } from "vitest";

// The dock Region path rasterizes via core/region, which needs a real canvas 2d context (absent in
// jsdom). Spy-mock the module so the drag→capture→queue flow runs headlessly and we can assert the
// capture width (which must exclude the docked pane). vi.hoisted keeps the spies available to the
// hoisted vi.mock factory. The 3rd arg is typed as appWidth so we can read it off .mock.calls.
const { rasterizeViewport, annotateRegion, captureRegion } = vi.hoisted(() => ({
  rasterizeViewport: vi.fn(async (_scale?: number, _host?: unknown, _appWidth?: number) => ({
    canvas: document.createElement("canvas"),
    warning: null,
  })),
  annotateRegion: vi.fn(async () => ({
    blob: new Blob(["x"], { type: "image/png" }),
    thumb: "data:image/png;base64,AAAA",
  })),
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

const PANE_W = 320; // keep in sync with overlay.ts PANE_W

const ORIGINAL_ENV = process.env.NODE_ENV;
let handle: NitpickerHandle | null = null;

afterEach(() => {
  handle?.unmount();
  handle = null;
  process.env.NODE_ENV = ORIGINAL_ENV;
  document.querySelectorAll('[data-nitpicker="root"]').forEach((n) => n.remove());
  document.querySelectorAll("[data-probe]").forEach((n) => n.remove());
  try {
    window.localStorage.clear();
  } catch {
    /* ignore */
  }
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

const badge = (r: ShadowRoot): string => r.querySelector(".np-badge")?.textContent ?? "";
const paneShown = (r: ShadowRoot): boolean =>
  r.querySelector(".np-panel")?.classList.contains("np-shown") ?? false;
const reservedMargin = (): string => document.documentElement.style.marginRight;
const cursorActive = (r: ShadowRoot): boolean =>
  r.querySelectorAll(".np-dock button")[0]?.classList.contains("np-active") ?? false;
const items = (r: ShadowRoot): number => r.querySelectorAll(".np-list .np-item").length;

const clickDockBtn = (r: ShadowRoot, i: number): void =>
  (r.querySelectorAll(".np-dock button")[i] as HTMLButtonElement).click();
const dockQueueBtn = (r: ShadowRoot): HTMLButtonElement => {
  const b = r.querySelectorAll(".np-dock button");
  return b[b.length - 1] as HTMLButtonElement; // chat/queue button is last
};

function mouse(type: string, x: number, y: number): MouseEvent {
  return new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true });
}

async function queueFromCard(root: ShadowRoot, text: string): Promise<void> {
  const card = await vi.waitFor(() => {
    const c = root.querySelector(".np-card");
    if (!c) throw new Error("queue card not open");
    return c;
  });
  (card.querySelector("textarea") as HTMLTextAreaElement).value = text;
  const queueBtn = Array.from(card.querySelectorAll("button")).find(
    (b) => b.textContent === "Queue",
  ) as HTMLButtonElement;
  queueBtn.click();
}

async function dragRegionAndQueue(root: ShadowRoot, note: string): Promise<void> {
  clickDockBtn(root, 1); // Region
  root.querySelector(".np-interaction")!.dispatchEvent(mouse("mousedown", 40, 60));
  window.dispatchEvent(mouse("mousemove", 240, 200));
  window.dispatchEvent(mouse("mouseup", 240, 200));
  await queueFromCard(root, note);
}

describe("docked feedback pane", () => {
  it("is shown by default and reserves its width on <html> so the app reflows", () => {
    const root = mount();
    expect(paneShown(root)).toBe(true);
    expect(reservedMargin()).toBe(`${PANE_W}px`);
  });

  it("queuing a Region mark appends to the list + ticks the badge, staying docked (no overlay)", async () => {
    const root = mount();
    expect(badge(root)).toBe("0");

    await dragRegionAndQueue(root, "fix the padding");

    expect(badge(root)).toBe("1");
    expect(items(root)).toBe(1);
    // still docked and reserving width — the mark never covered the page
    expect(paneShown(root)).toBe(true);
    expect(reservedMargin()).toBe(`${PANE_W}px`);
  });

  it("queuing an Element mark appends + ticks the badge", async () => {
    const root = mount();
    const probe = document.createElement("button");
    probe.setAttribute("data-probe", "");
    document.body.appendChild(probe);

    clickDockBtn(root, 2); // Element
    probe.dispatchEvent(mouse("click", 20, 20));
    await queueFromCard(root, "rename this");

    expect(badge(root)).toBe("1");
    expect(items(root)).toBe(1);
    expect(paneShown(root)).toBe(true);
  });

  it("the pane's top-left toggle hides it and releases the reserved width", () => {
    const root = mount();
    (root.querySelector(".np-pane-toggle") as HTMLButtonElement).click();
    expect(paneShown(root)).toBe(false);
    expect(reservedMargin()).toBe(""); // app back to full width
  });

  it("the dock queue button re-shows a hidden pane", () => {
    const root = mount();
    (root.querySelector(".np-pane-toggle") as HTMLButtonElement).click();
    expect(paneShown(root)).toBe(false);

    dockQueueBtn(root).click();
    expect(paneShown(root)).toBe(true);
    expect(reservedMargin()).toBe(`${PANE_W}px`);
  });

  it("persists the hidden state across mounts (localStorage)", () => {
    const root1 = mount();
    (root1.querySelector(".np-pane-toggle") as HTMLButtonElement).click();
    handle?.unmount();
    handle = null;
    document.querySelectorAll('[data-nitpicker="root"]').forEach((n) => n.remove());

    const root2 = mount();
    expect(paneShown(root2)).toBe(false);
    expect(reservedMargin()).toBe(""); // stays released on remount
  });

  it("restores the host <html> margin when unmounted", () => {
    mount();
    expect(reservedMargin()).toBe(`${PANE_W}px`);
    handle?.unmount();
    handle = null;
    expect(reservedMargin()).toBe("");
  });
});

describe("screenshots exclude the docked pane", () => {
  it("clips the region raster to the app area (viewport width − pane width)", async () => {
    const root = mount();
    await dragRegionAndQueue(root, "note");

    // freezeViewport → rasterizeViewport(scale, host, appWidth). appWidth must exclude the pane.
    expect(rasterizeViewport).toHaveBeenCalled();
    const appWidthArg = rasterizeViewport.mock.calls[0][2];
    expect(appWidthArg).toBe(window.innerWidth - PANE_W);
    expect(appWidthArg).toBeLessThan(window.innerWidth);
  });
});

describe("mode resets to cursor after a completed mark", () => {
  it("Region enqueue snaps back to Cursor mode", async () => {
    const root = mount();
    clickDockBtn(root, 1);
    expect(root.querySelector(".np-interaction")?.classList.contains("np-armed")).toBe(true);

    root.querySelector(".np-interaction")!.dispatchEvent(mouse("mousedown", 40, 60));
    window.dispatchEvent(mouse("mousemove", 240, 200));
    window.dispatchEvent(mouse("mouseup", 240, 200));
    await queueFromCard(root, "fix this");

    expect(root.querySelector(".np-interaction")?.classList.contains("np-armed")).toBe(false);
    expect(cursorActive(root)).toBe(true);
  });

  it("Element enqueue snaps back to Cursor mode", async () => {
    const root = mount();
    const probe = document.createElement("button");
    probe.setAttribute("data-probe", "");
    document.body.appendChild(probe);

    clickDockBtn(root, 2);
    probe.dispatchEvent(mouse("click", 20, 20));
    await queueFromCard(root, "tweak this");

    expect(cursorActive(root)).toBe(true);
  });
});
