// Drop-in `next.config.ts` for a repo that doesn't have one yet. If the repo already has a config,
// don't use this file — instead merge the three nitpicker additions (the `isDev`/`here`/loader consts,
// the `turbopack` key, and the `webpack` function) into the existing config. See the nitpicker SKILL.
//
// nitpicker element-picker source stamp: a DEV-ONLY transform that adds
// `data-nitpicker-source="file:line:col"` to host JSX so the picker can report where an element is
// defined. Gated on NODE_ENV, so `next build` (NODE_ENV=production) never wires it in — prod stays on
// the normal SWC path and the attribute is absent. Wired for both bundlers so it works under the default
// `next dev` (Turbopack) and `next dev --webpack`.
import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const isDev = process.env.NODE_ENV !== "production";
const here = path.dirname(fileURLToPath(import.meta.url));
const nitpickerSourceLoader = path.join(here, "nitpicker", "next", "nitpicker-source-loader.cjs");

const nextConfig: NextConfig = {
  // Turbopack (default bundler) — apply the source-stamp loader to app JSX in dev only. In prod the key
  // is present-but-empty (Next 16 errors on a `webpack` config with no `turbopack` config), so
  // `next build` gets no rule and never stamps.
  turbopack: isDev
    ? {
        rules: {
          // No `as:` — the loader preserves the .tsx type; renaming would double the extension.
          "*.tsx": { loaders: [{ loader: nitpickerSourceLoader }] },
        },
      }
    : {},
  // webpack fallback (`next dev --webpack`): same loader, dev only. Ignored when Turbopack runs.
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
