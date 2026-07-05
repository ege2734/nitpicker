# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

## What this repo is

`nitpicker` is an **installable Claude skill** (`SKILL.md` + `assets/`), not an app. `assets/nitpicker/` is
the portable tree the skill copies into a target React/Next repo as `<repo>/nitpicker/`. Nothing here is
built or deployed on its own — changes are validated by installing into a throwaway app (see below).

## Sharp edges

- **The source-stamp loader must load `@babel/core` via dynamic `import()`, not `require()`.**
  `@babel/core@8` is ESM-only, so `require("@babel/core")` throws "ES Module not supported" and breaks
  `next dev` for any repo that installs a modern babel. `assets/nitpicker/next/nitpicker-source-loader.cjs`
  imports it dynamically (cached), which works for both the CJS 7.x and ESM 8.x releases. Keep it that
  way — do not "simplify" back to `require`.
- **Next 16 config gotcha:** a `next.config` that defines a `webpack` function must also have a
  `turbopack` key present (even `{}`), or Next errors. The nitpicker wiring sets `turbopack: isDev ? {…} :
  {}` for exactly this reason — keep the empty-object branch.
- **Turbopack caches the loader.** After editing `nitpicker/next/*.cjs`, a stale-loader error can persist;
  `rm -rf .next` and restart `next dev`.
- **Region has two DIFFERENT raster timings — do not unify them.** The dock drag rasterizes at
  **Queue-commit** (`captureRegionShot` → `captureRegion`, kicked from `openCard`'s Queue handler): the
  selection box is a live overlay rect drawn with NO freeze (instant to draw), and a drag the user cancels
  captures nothing. The `⌘/Ctrl+Shift+X` hotkey rasterizes at **key-press** (`freezeViewport` →
  `rasterizeViewport`, tracked by `freezePromise`, cropped on mouse-up via `captureFromFrozen`) because it
  must preserve transient hover-only UI. A past attempt to rasterize the dock path at drag-start moved the
  ~1–2s stall from after-release to before-draw — don't reintroduce it. The dock item is enqueued
  *optimistically* (`enqueueRegion` takes a `Promise`), shows a "capturing…" placeholder, and `send()`
  awaits `_pending` so the blob is attached before upload. The hotkey snapshot lives in a `.np-snapshot`
  layer that MUST stay ordered *below* `.np-interaction` in `build()` so the dim bands render on top of it.
- **Red-box coordinate space: composite in FULL-viewport space, then crop the pane gutter — never remap
  the box math into the app-area.** `rasterizeViewport` captures the full `innerWidth×innerHeight` and
  `compositeRegion` draws the box in that same space (the space the selection is measured in), so the box
  always frames exactly what was dragged. Excluding the docked pane is a pure right-edge trim
  (`cropToAppWidth` in `annotateRegion`, driven by `appWidth`) that can't shift the box. Shrinking the
  raster to the app area instead (an earlier attempt) mispositioned the red box in real apps — don't.
- **The feedback pane is a docked sidebar that reserves width on `<html>` (`margin-right`).** `appWidth()`
  = `innerWidth − reservedWidth()` is the app's rendered area; the drag selection is clamped to it and it
  is passed to `captureRegion`/`annotateRegion` as the crop width. The reserved margin is restored to its
  pre-mount value on `unmount()`. Below 720px the pane is a bottom sheet and reserves 0 width.

## Local dev (tooling quirk)

The committed lockfile pins `vite@7` (ESM-only), so `npm test` needs Node ≥22.12 (or Node 22.4 +
`NODE_OPTIONS=--experimental-require-module`); otherwise vitest fails to load its config with
`ERR_REQUIRE_ESM`. `typecheck` is unaffected. CI runs a compatible Node.

## Verifying a change (portability)

The design contract is "installs into any React/Next repo with no hand-wiring", so verify by actually
installing, not by reading:

1. `npx create-next-app@latest <scratch>/verify-app --ts --app --no-src-dir --no-eslint --use-npm --turbopack`
2. Follow `SKILL.md` into it (copy `assets/nitpicker`, add `html2canvas @babel/core tsx` devDeps + the two
   `nitpicker:*` scripts, mount `<NitpickerOverlay/>` in the root layout behind the `NODE_ENV` guard, wire the
   loader into `next.config` for turbopack + webpack).
3. Run the three processes; drive the overlay in a browser (region drag → red-boxed PNG delivered to a
   running `nitpicker poll`; element click → `source`/`selector` recorded).
4. Prod-safety: `next build`, then `grep -r html2canvas .next/static` and
   `grep -r data-nitpicker-source .next` (excluding `cache`/`dev`) must be empty.
5. **Remove the throwaway app before committing** — only the skill + assets + README are committed.

`assets/nitpicker/tests/` are portable vitest units (drain semantics, red-box device-pixel math, selector
fallback, React source glue); run them with `vitest run nitpicker/tests` inside a repo that has vitest.
