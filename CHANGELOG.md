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
  The dock's Region button (rasterize on mouse-up) is unchanged.

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
