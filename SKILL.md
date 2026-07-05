---
name: nitpicker
description: Install the nitpicker in-app dev-feedback overlay into a React/Next repo. Use when a developer wants to visually mark up their running app (region screenshots with a red box, or click-to-pick an element's component/source) and batch-send that feedback straight to the AI coding session — with no hand-wiring. Installs a framework-agnostic overlay, a Next/React adapter, a dev-only source-stamp transform, and a local sidecar + `poll` CLI. Next.js (App Router) / React 19 target; dev-only and tree-shaken from production.
user-invocable: true
---

# nitpicker

Install the nitpicker feedback overlay end to end into the **current** React/Next repo. When done, a
developer running the app sees a bottom-center dock with three modes — **Cursor** (passive), **Region**
(drag to screenshot, red box burned in), **Element** (click to record component/source/selector) — plus
a docked, width-reserving feedback pane that batch-sends the queue to a local sidecar the AI session
long-polls. A global
**`⌘/Ctrl+Shift+X`** shortcut jumps straight into Region mode and freezes the viewport at that instant,
so hover-only UI (chart hover-cards, tooltips, menus that vanish on mouse-move) can be screenshotted.

Everything is **dev-only**: the overlay is `NODE_ENV`-gated and tree-shaken from `next build`, the
source-stamp transform is wired only in dev, and the sidecar/CLI are Node built-ins run under `tsx` that
the app never imports.

This skill assumes a **Next.js App Router app on React 18/19**. It's the primary (and verified) target;
the design also anticipates a future iframe-harness adapter for Streamlit / non-owned apps, which this
skill does **not** install.

## What ships where

The portable assets live under this skill's `assets/nitpicker/`. Installing = copy that tree to
`<repo>/nitpicker/`, add deps + scripts, mount one component, and wire `next.config`. The tree:

- `nitpicker/core/` — `@nitpicker/core`, framework-agnostic TS (no React import): shadow-DOM dock, region
  capture + red-box compositor, element picker + descriptor builder, docked feedback pane, transport client.
- `nitpicker/react/` — the Next/React adapter: `dev-overlay.tsx` (the dev-only `"use client"` mount) and
  `react-source.ts` (the `resolveElement` seam: fiber-walk component name + `data-nitpicker-source` read).
- `nitpicker/next/` — `nitpicker-source-plugin.cjs` + `nitpicker-source-loader.cjs`: the dev-only Babel
  transform that stamps `data-nitpicker-source="file:line:col"` onto host JSX (React 19 removed
  `_debugSource`, so this build-time stamp is the only reliable way to recover file:line from a click).
- `nitpicker/server/` + `nitpicker/cli/` + `nitpicker/bin/` — the sidecar transport server and the `nitpicker`
  CLI (`serve`/`poll`/`health`/`shutdown`/`verify`).
- `nitpicker/tests/` — vitest units (drain semantics, red-box device-pixel math, selector fallback, React
  glue). Optional; skip if the target has no test runner.

## Install steps

Run these **inside the target repo**. Adjust paths to the repo's shape (src-dir vs. root app dir).

### 1. Copy the assets

Copy this skill's `assets/nitpicker/` directory to the repo root as `nitpicker/`. Keep it at the **repo
root** (next to `next.config.*`): the `next.config` loader path and the layout import both assume that.

```bash
cp -R <skill-dir>/assets/nitpicker ./nitpicker
```

### 2. Add dependencies + scripts

Add three **devDependencies** (keeping `html2canvas` out of `dependencies` reinforces that it never
reaches prod) and two scripts. Use the repo's package manager.

```bash
npm install -D html2canvas @babel/core tsx
```

- `html2canvas` — region screenshot rasterizer (dynamically imported inside the dev-only path).
- `@babel/core` — used by the source-stamp bundler loader.
- `tsx` — runs the TypeScript sidecar + CLI without a build step.

Add to `package.json` `scripts`:

```jsonc
{
  "scripts": {
    "nitpicker:server": "tsx nitpicker/server/index.ts",
    "nitpicker:poll": "tsx nitpicker/bin/nitpicker.ts poll"
  }
}
```

### 3. Mount the overlay in the root layout (dev-only)

In the App Router root layout (`app/layout.tsx` or `src/app/layout.tsx`), render `<NitpickerOverlay/>` as a
sibling of `{children}` inside `<body>`, gated so it's dead-code-eliminated from prod. Import it with a
**relative path** from the layout to `nitpicker/react/dev-overlay` (nitpicker lives at the repo root):

- from `app/layout.tsx` → `../nitpicker/react/dev-overlay`
- from `src/app/layout.tsx` → `../../nitpicker/react/dev-overlay`

```tsx
import { NitpickerOverlay } from "../nitpicker/react/dev-overlay"; // adjust depth for your layout location

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        {/* Dev-only feedback overlay; DCE'd from prod via the NODE_ENV guard. */}
        {process.env.NODE_ENV !== "production" && <NitpickerOverlay />}
      </body>
    </html>
  );
}
```

`process.env.NODE_ENV` is statically `"production"` under `next build`, so the whole subtree **and its
import chain** (core + html2canvas) are eliminated from the prod bundle. Do not turn the guard into a
runtime-only check — the static `!==` literal is what lets the bundler drop the branch.

### 4. Wire the dev-only source-stamp into `next.config`

The element picker's `file:line:col` comes from a `data-nitpicker-source` attribute stamped onto host JSX
by a dev-only bundler loader. Wire it into **both** bundlers so it works under the default `next dev`
(Turbopack) and `next dev --webpack`, **gated on `NODE_ENV !== "production"`**.

If the repo has no `next.config`, drop in `assets/next.config.nitpicker.ts` (rename to `next.config.ts`).
Otherwise **merge** these three additions into the existing config:

```ts
import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const isDev = process.env.NODE_ENV !== "production";
const here = path.dirname(fileURLToPath(import.meta.url));
const nitpickerSourceLoader = path.join(here, "nitpicker", "next", "nitpicker-source-loader.cjs");

const nextConfig: NextConfig = {
  // …your existing config…

  // Turbopack (default bundler): stamp app JSX in dev only.
  turbopack: isDev
    ? { rules: { "*.tsx": { loaders: [{ loader: nitpickerSourceLoader }] } } }
    : {}, // NOTE: keep this key present-but-empty — see the gotcha below.

  // webpack fallback (`next dev --webpack`): same loader, dev only.
  webpack(config, { dev }) {
    if (dev) {
      config.module.rules.push({
        test: /\.tsx$/,
        exclude: /node_modules/,
        use: [{ loader: nitpickerSourceLoader }],
      });
    }
    return config;
  },
};

export default nextConfig;
```

**Next 16 gotcha — keep an empty `turbopack` key when you add `webpack`.** Next 16 errors if a config
defines a `webpack` function with **no** `turbopack` config present. So in prod (where `isDev` is false)
we set `turbopack: {}` rather than omitting it. Don't drop the empty-object branch.

Notes:
- No `as:` on the Turbopack rule — the loader preserves the `.tsx` type; renaming would double the
  extension.
- If the config is a `.mjs`/CommonJS file, translate the `import`s accordingly (`require`,
  `__dirname`). The loader path just needs to resolve to `nitpicker/next/nitpicker-source-loader.cjs`.
- A `.tsx`-only rule misses `.jsx` files; if the app uses `.jsx`, widen the `test`/glob to match.

### 5. (Optional) set a session id

`nitpicker poll --session <id>` and the app must agree on a session string. The mount defaults the app
side to `"nitpicker"`; to run several apps at once, set `NEXT_PUBLIC_NITPICKER_SESSION` (e.g. the repo name)
in `.env.local` and poll with the same value. The endpoint defaults to `http://127.0.0.1:5178`; override
with `NEXT_PUBLIC_NITPICKER_ENDPOINT` (app) / `NITPICKER_PORT` (sidecar).

## Run it

Three processes:

```bash
npm run nitpicker:server                       # 1. sidecar (127.0.0.1:5178; NITPICKER_PORT to change)
npm run dev                                   # 2. the app
npm run nitpicker:poll -- --session nitpicker     # 3. the AI session's long-poll (use your session id)
#   add --watch to keep receiving batches; --timeoutMs <n> to bound one poll
```

Open the app → the feedback pane is **docked** to the right edge, reserving its width (~320px) so the app
reflows beside it — it never covers page content. The dock is bottom-center over the app area. **Region**:
drag → the viewport freezes, dims gray except the selection, a red box is composited on, type a note,
**Queue**. To capture **hover-only UI** (a tooltip or chart hover-card that a trip to the dock would
dismiss), hover it and press **`⌘/Ctrl+Shift+X`** — that enters Region mode with the viewport frozen at
the keypress, then drag your box over the preserved hover state. **Element**: hover outlines the node,
click records its descriptor (the click is swallowed so the app doesn't fire), type a note, **Queue**.
**Queue** just appends the mark to the docked pane's list + ticks the dock's queue-count badge, and the
overlay returns to **Cursor** so the page is immediately interactive again (Region and Element both snap
back). Screenshots only ever capture the **app area** — never the pane. Hide the pane with its top-left
**⟩** toggle (the app expands to full width; state persists across reloads) and re-show it from the dock's
**feedback-queue** button. Under 720px the pane drops to a bottom sheet. **Send to agent** POSTs the whole
batch; the running `poll` prints it and exits (re-run, or `--watch`).

## How the AI session consumes feedback

`nitpicker poll` returns a batch of items. Act on each by `kind`:

- **region** — `item.image.path` is a **local PNG** with the red box already burned in. Open it directly
  with your image-reading tool; `selectionRect` (CSS px) and `route`/`pageUrl` locate the area on the
  page. Fix what's boxed.
- **element** — `item.element` carries an agent-grade descriptor: `component` (React name, dev only, when
  a client component owns the node), `source` (`file:line:col` from the stamp), `selector` (short CSS
  path preferring testid/id/stable class), `testid`, `tag`, `role`, `text`, `rect`, plus `route`. Use
  `source` first; fall back to `component`/`selector`/`text` + `route` to grep the code.
- **message** — plain `text` feedback, with `route`/`pageUrl` for context.

The queue survives a killed/re-issued poll (it's only cleared on an actual delivery), so feedback is
never lost — just re-run `poll` if it dies before the developer hits Send.

## Verify the install

1. `grep -rn "NitpickerOverlay" <layout file>` — mounted behind the `NODE_ENV !== "production"` guard.
2. `npm run nitpicker:server` then `curl -s localhost:5178/health` → `{"ok":true,...}`.
3. `npm run dev`, open the app — the dock appears; a region drag yields a red-boxed queue item; **Send**
   makes a running `nitpicker poll --session <id>` print the batch with a local PNG path.
4. Element mode: click a node rendered by one of your components → the queued item carries
   `component`/`source`/`selector`.
5. Prod-safety: `next build` then either run the bundled scanner —
   `npx tsx nitpicker/bin/nitpicker.ts verify` (exits nonzero if nitpicker leaked into `.next`) — or the manual
   greps: `grep -r html2canvas .next/static` and `grep -r data-nitpicker-source .next` (outside `cache/`) →
   both empty. Wire `nitpicker verify` into CI after the build step to make a prod leak a red build.
6. (Optional) if the repo runs vitest, `nitpicker/tests/` should pass.

## Prod-safety recap

Two independent gates keep everything out of production: the `NODE_ENV !== "production"` mount guard
(with the dynamic `import()` inside the same static block, so the async chunk + html2canvas are dropped),
and the `isDev`-gated `next.config` wiring (so `next build` adds no loader and stamps no attribute). The
sidecar/CLI are never imported by the app.

Two defense-in-depth backstops sit behind those gates in case an install is hand-wired incorrectly:
`Nitpicker.mount()` refuses to build the overlay when `NODE_ENV === "production"` (it warns and returns a
no-op handle), and `nitpicker verify` (step 5 above) fails a build that leaked nitpicker's fingerprint into
shipped output. Backstops catch a mistake; they don't replace the gates.
