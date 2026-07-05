# nitpicker — in-app dev feedback overlay

A **dev-only** overlay that lets you visually mark up the running app and batch-send that feedback
(text + region screenshots with a red box burned in, or a picked element's component/source) straight
to the AI coding session that built it. Nothing here ships to production — the sidecar is a local
process and the overlay is `NODE_ENV`-gated + tree-shaken from `next build`.

This directory was installed by the **nitpicker skill**. See that skill (or the top-level README of the
nitpicker repo) for install steps; this file is a quick local reference.

## Layout

| Path                              | What                                                                                                                                    |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `server/`                         | the sidecar transport server (`node:http` only, zero deps): `store.ts` (queue + drain), `blobs.ts` (temp-dir screenshot storage), `index.ts` (HTTP). |
| `cli/poll.ts` + `bin/nitpicker.ts`  | the `nitpicker` CLI (`poll`/`serve`/`health`/`shutdown`).                                                                                 |
| `core/`                           | `@nitpicker/core` — the framework-agnostic overlay (shadow-DOM dock + region capture + red-box compositor + element picker + docked feedback pane + transport client). No React dependency. |
| `react/react-source.ts`           | the React/Next glue for the picker's `resolveElement` seam: component name (fiber walk) + source file:line (from the `data-nitpicker-source` stamp). |
| `react/dev-overlay.tsx`           | the Next `"use client"` glue that mounts core in dev only and supplies `resolveElement`.                                                |
| `next/nitpicker-source-*.cjs`       | the **dev-only** Babel plugin + bundler loader that stamps `data-nitpicker-source="file:line:col"` onto host JSX (wired in `next.config`, gated on `NODE_ENV`). |
| `tests/`                          | vitest unit tests for the sidecar drain semantics, red-box device-pixel math, selector fallback chain, and the React source glue.       |

## Run it (three terminals)

```bash
# 1. the sidecar transport server (default 127.0.0.1:5178; override with NITPICKER_PORT)
npm run nitpicker:server

# 2. the app
npm run dev

# 3. the AI session's long-poll — blocks until you hit "Send to agent", then prints the batch
#    (text + a LOCAL red-boxed PNG path the agent opens directly) and exits. Re-run to keep receiving.
npm run nitpicker:poll -- --session <your-session-id>
#   add --watch to loop; --timeoutMs <n> to bound a single poll
```

Pick a session id (e.g. your repo name) and use the SAME value for the app
(`NEXT_PUBLIC_NITPICKER_SESSION`, default `nitpicker`) and for `nitpicker poll --session`.

Then open the app: a dock appears bottom-center with three modes — **Cursor** (passive, default),
**Region** (drag to screenshot), **Element** (hover to outline, click to record). Drag a region on the
live page (no freeze) → it dims gray except your selection; type a note and **Queue** it, and the red-boxed
screenshot rasterizes at that moment (a drag you cancel captures nothing). The mark lands in the **docked
feedback pane** on the right (a width-reserving sidebar the app reflows beside; a bottom sheet under 720px)
and the overlay snaps back to Cursor. Click a queued item to view + edit it; add freeform messages; hit
**Send to agent** to POST the whole batch to the sidecar. Your running `nitpicker poll` prints it.

`Esc` returns to Cursor mode. Only one mode is active at a time (radio semantics). Press
**`⌘/Ctrl+Shift+X`** to jump straight into Region mode with the viewport frozen at that instant — the way
to screenshot **hover-only UI** (tooltips, chart hover-cards) that a trip to the dock would dismiss.

## Transport contract

- `POST /blob` — raw binary screenshot upload (`X-Nitpicker-Mime` header) → `{ id, path, url }`. Images
  are written to a temp dir and referenced by **path**, so the poll JSON never carries base64.
- `POST /feedback` — enqueue one item or a batch: `{ session, items: [...] }`.
- `GET /poll?session=…[&timeoutMs=…]` — long-poll that **drains** the session queue and returns
  `{ status: "feedback", items: [...] }`, heartbeating every ~15 s, indefinite by default. The queue is
  only cleared on an actual delivery, so a killed/re-issued poll never loses feedback.
- `GET /blob/:id` — serve a stored blob (a fallback; items normally carry the local **path** directly).
- `GET /health`, `POST /shutdown`.

Session identity is a **caller-supplied id** (the `--session` string), not a file path — multiple dev
apps + agents coexist.

## Prod-safety

- The overlay is mounted only behind `process.env.NODE_ENV !== "production"` in the root layout, and
  `dev-overlay.tsx` puts the `import("../core")` inside the same static guard so webpack drops the async
  chunk (html2canvas included) from `next build`. Verify: `grep -r html2canvas .next/static` → none.
- The `data-nitpicker-source` stamp transform is wired in `next.config` only when
  `NODE_ENV !== "production"`, so `next build` adds no loader/rule and emits no attribute. Verify:
  `grep -r data-nitpicker-source .next` (outside `cache/`) → none.
- The sidecar and CLI run under `tsx` (a devDependency) and use only Node built-ins; they are never
  imported by the app. The Babel plugin/loader are `.cjs` under `next/` and are loaded only by the dev
  bundler.
