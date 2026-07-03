import { defineConfig } from "vitest/config";

// The portable skill assets carry their own vitest units under assets/nitpicker/tests. This root config
// exists only so the units are runnable from the repo root (`npm test`) and in CI.
//
// Environment: jsdom globally. The DOM-facing units (elements/redbox/react-source/guard) drive fake
// element/canvas/fiber objects rather than a real document, but jsdom is the safe default and covers any
// unit that reaches for a DOM global. The node sidecar unit only touches `node:events`, which is still
// available under the jsdom environment (vitest's jsdom env runs on Node and keeps its builtins), so a
// single global environment is enough — no per-file `// @vitest-environment` override is needed.
//
// `html2canvas` is a devDependency of this repo purely so `core/region.ts` (which reaches it through a
// dev-only dynamic `import("html2canvas")`) resolves at transform time and typechecks. No unit ever
// executes that path — the prod-guard test imports Nitpicker → overlay → region for the module graph, but
// never calls captureRegion.
export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["assets/nitpicker/tests/**/*.test.ts"],
    globals: false,
  },
});
