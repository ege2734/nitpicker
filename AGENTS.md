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
- **Region: pre-rasterize, then annotate on mouse-up — don't collapse the two steps.** Both entries
  rasterize the viewport *early* into `frozenCanvas` (via `freezeViewport` → `rasterizeViewport`, tracked
  by `freezePromise`) and only do the cheap red-box crop (`annotateRegion`, via `captureFromFrozen`) on
  mouse-up. The `⌘/Ctrl+Shift+X` hotkey rasterizes *at key-press time* so hover-only UI (tooltips/
  hover-cards) is preserved; the dock drag rasterizes *at drag-start* (`onDragStart`) so the raster
  overlaps the drag and the queue card opens instantly. Neither path re-rasterizes on mouse-up (the hover
  state is gone; and it's the ~1–2s stall we removed). `region.ts` stays split into `rasterizeViewport` +
  `annotateRegion` for exactly this; `captureRegion`/`freezeAndCapture` (rasterize-on-mouse-up) survives
  only as a defensive fallback. The frozen snapshot lives in a `.np-snapshot` layer that MUST stay ordered
  *below* `.np-interaction` in `build()`, so the dim bands + dashed outline render on top of it while dragging.
- **The feedback pane is a docked sidebar that reserves width on `<html>` (`margin-right`) — screenshots
  must exclude it.** `appWidth()` = `innerWidth − reservedWidth()` is the app's rendered area; region
  capture (`rasterizeViewport`/`captureRegion` take an `appWidth` arg) and the drag selection are both
  clamped to it so the pane (and its gutter) never lands in a screenshot. The reserved margin is restored
  to its pre-mount value on `unmount()`. Below 720px the pane is a bottom sheet and reserves 0 width.

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
