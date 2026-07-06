# Changelog

All notable changes to nitpicker are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Region hotkey (`⌘/Ctrl+Shift+X`)** — a global, capture-phase keyboard shortcut that jumps straight
  into **Region** mode from any mode and any focus, **freezing the viewport at the instant of the
  keypress**. This is the only way to screenshot **hover-only UI** — chart hover-cards, tooltips, and
  menus that vanish the moment you move the mouse toward the dock's Region button: the snapshot preserves
  whatever was hovered when you pressed the key, and you draw the selection box over that frozen state.
- **Click a queued mark to view + edit it.** Each item in the docked pane opens a modal showing its
  region screenshot (or element descriptor) with the message in an editable field that saves back in
  place, plus a Remove action. Close with the ✕ or `Esc`.

### Changed

- **The feedback pane is now a docked, width-reserving sidebar — not an overlay.** It's shown by default
  and reserves ~320px on the right (via `<html>` `margin-right`), so the host app reflows *beside* it and
  it never covers page content. A **⟩** toggle at the pane's top-left hides it (the app expands to full
  width; the choice persists in `localStorage`); the dock's feedback-queue button re-shows it. Below 720px
  it drops to a bottom sheet. This replaces the old slide-over panel and resolves the dogfooding complaint
  that queuing a mark covered the page.
- **Region screenshots exclude the pane** — and the red box frames exactly what you dragged. The capture
  rasterizes the full viewport and composites the red box in that same coordinate space (so the box is
  never mispositioned), then crops the pane's reserved gutter off the right edge of the output. The
  selection is clamped to the app area.
- **Queuing a mark just appends to the docked pane + ticks the badge** — no overlay pops over the page.
- **The overlay snaps back to Cursor after a completed mark.** Once a Region (or Element) mark is queued,
  the overlay returns to **Cursor** mode, so the page is immediately interactive again instead of staying
  armed for another capture.
- **The dock Region flow is instant to draw AND instant to card.** Dragging the selection box happens on
  the live page with no freeze (the earlier "rasterize at drag-start" attempt just moved the stall to
  before the draw). The screenshot is now rasterized **only when you commit with Queue**, per mark and
  asynchronously — so a drag you cancel captures nothing, the queue card opens instantly with a
  "capturing…" placeholder, and the blob is guaranteed attached before **Send to agent** fires. (The
  hotkey path still freezes at key-press, which is required to preserve hover-only UI.)
- **The `⌘/Ctrl+Shift+X` mode switch is now instant.** The viewport raster is deferred off the keypress
  (it used to run inline, landing in the keypress microtask *before* the first paint and stalling the
  mode switch for the whole raster). Region now arms and paints on the very next frame — measured
  keydown→paint dropped from ~150 ms to ~0.7 ms on a heavy (~23k-node) page — while the raster still fires
  a couple of frames later, before the cursor can move, so hover-only UI is still captured. The scheduled
  raster is cancelled if you bail (Esc / mode switch / unmount) before it runs.
- **A `Freezing viewport…` cue** now appears the instant you press `⌘/Ctrl+Shift+X`, so the ~1–2 s it
  takes html2canvas to snapshot a heavy DOM reads as a deliberate step rather than a hang. It clears the
  moment the frozen view is ready (you then draw the box over it) or if you cancel.

### Fixed

- **A click (no drag) in Region mode now returns to Cursor** instead of staying armed — the same outcome
  as pressing `Esc`, and it clears any hotkey freeze snapshot. Applies to both the dock and hotkey paths.

## [0.1.0] — 2026-07-03

First public release: the nitpicker in-app dev-feedback overlay, packaged as an installable Claude skill
that drops into any React/Next repo with no hand-wiring.

### Added

- **The overlay** (`@nitpicker/core`) — a framework-agnostic, shadow-DOM-isolated dock with three modes:
  **Cursor** (passive), **Region** (drag to screenshot; the viewport freezes and dims, and a red box is
  composited onto the capture at the correct device-pixel scale), and **Element** (hover to outline,
  click to record an agent-grade descriptor: React component name, source `file:line:col`, a stable CSS
  selector, testid, text, role, and route). A right-side chat panel batches marks and sends them.
- **Next/React adapter** — dev-only `<NitpickerOverlay/>` mount plus the `resolveElement` seam that recovers
  the React component name (fiber walk) and source location.
- **Source-stamp transform** — a dev-only Babel plugin + bundler loader that stamps
  `data-nitpicker-source="file:line:col"` onto host JSX (the durable fix after React 19 removed
  `_debugSource`), wired for both Turbopack and webpack.
- **Sidecar transport** — a zero-dependency (`node:http` only) local server with long-poll **drain**
  semantics so feedback is delivered exactly once and survives a killed poll, plus the `nitpicker` CLI
  (`serve` / `poll` / `health` / `shutdown`).
- **Prod-safety guardrails** — beyond the `NODE_ENV`-gated mount and dev-only bundler wiring:
  `Nitpicker.mount()` now refuses to run in production (defense-in-depth), and a new **`nitpicker verify`**
  command scans a build for overlay leakage so it can gate CI.
- **Docs & project setup** — README with quickstart, support matrix, and troubleshooting; `docs/DESIGN.md`
  architecture report; live screenshots; MIT license, contributing guide, code of conduct, and issue/PR
  templates; a repo-root vitest harness (`npm test`) and GitHub Actions CI (typecheck + tests).

[unreleased]: https://github.com/ege2734/nitpicker/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/ege2734/nitpicker/releases/tag/v0.1.0
