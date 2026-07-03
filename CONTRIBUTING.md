# Contributing to nitpicker

Thanks for wanting to help. This guide is short and practical — read it once and you'll know how to
land a change.

## What you're working on

`nitpicker` is an **installable Claude skill** (`SKILL.md` + `assets/`), **not a runnable app**. Nothing
in this repo builds, serves, or deploys on its own. The portable overlay lives under `assets/nitpicker/`;
the skill copies that tree into a target React/Next repo as `<repo>/nitpicker/`. So you don't "run
nitpicker" here — you change the assets, then verify them by **installing into a throwaway app**.

Two things stay true of every change: everything nitpicker installs is **dev-only** and leaves **zero
production footprint**. If a change could reach a `next build` output, it's wrong. See the prod-safety
greps below.

## Verifying a change (the portability loop)

The design contract is "installs into any React/Next repo with no hand-wiring", so verify by actually
installing — not by reading. This mirrors the loop in `AGENTS.md`:

1. Scaffold a scratch app:

   ```bash
   npx create-next-app@latest <scratch>/verify-app \
     --ts --app --no-src-dir --no-eslint --use-npm --turbopack
   ```

2. Follow `SKILL.md` into it: copy `assets/nitpicker` to the app root, add the `html2canvas @babel/core
   tsx` devDeps and the two `nitpicker:*` scripts, mount `<NitpickerOverlay/>` in the root layout behind the
   `process.env.NODE_ENV !== "production"` guard, and wire the source-stamp loader into `next.config`
   for **both** turbopack and webpack.

3. Run the three processes and drive the overlay in a browser:

   ```bash
   npm run nitpicker:server                       # sidecar (127.0.0.1:5178)
   npm run dev                                   # the app
   npm run nitpicker:poll -- --session nitpicker     # the AI session's long-poll
   ```

   - **Region** drag → a red-boxed PNG is delivered to the running `nitpicker poll`.
   - **Element** click → `source`/`selector` are recorded on the queued item.

4. Prove there's no prod footprint. Run `next build`, then both of these must come back **empty**:

   ```bash
   grep -r html2canvas .next/static
   grep -r data-nitpicker-source .next        # excluding cache/ and dev/
   ```

5. **Remove the throwaway app before committing.** Only the skill + assets + README + these governance
   files are committed — never a scratch app.

## Running the unit tests

`assets/nitpicker/tests/` are portable vitest units (sidecar drain semantics, red-box device-pixel math,
selector fallback chain, React source glue). From the repo root:

```bash
npm test
```

Run these for any change to the assets, and add or update a unit when you touch the behavior it covers.
They're fast and don't need a scratch app — but they don't replace the install loop above for anything
touching the overlay, the source stamp, or `next.config` wiring.

## Conventions

- **Keep it dev-only and prod-safe.** Never widen a gate. The `NODE_ENV` mount guard and the `isDev`
  `next.config` wiring are the two things that keep nitpicker out of production — treat them as load-bearing.
- **Match the existing comment style:** thorough and lowercase-leaning, explaining the *why* (especially
  the sharp edges). When you hit a non-obvious constraint, leave a note the way `AGENTS.md` and the
  existing sources do.
- **Mind the sharp edges in `AGENTS.md`** — the dynamic `import()` of `@babel/core`, the empty
  `turbopack: {}` key next to a `webpack` function, and Turbopack's stale-loader cache (`rm -rf .next`).
- **No new runtime deps.** The sidecar/CLI are Node built-ins under `tsx`; keep it that way.

## Branch / PR etiquette

- Fork the repo, or push a branch — don't commit to `main` directly.
- Open a PR against `main` and fill in the template. **Describe the verification you actually did**:
  which tests you ran, whether you drove the overlay in a scratch app, and that the two prod-safety
  greps came back empty.
- Keep PRs focused. One concern per PR is much easier to verify.

## Reporting bugs / requesting features

Use the issue templates under `.github/ISSUE_TEMPLATE/`. Remember nitpicker is **dev-only** — include your
framework + version (Next.js App Router? Vite? React version), package manager, OS, and node version, so
the behavior is reproducible.

By contributing you agree your contributions are licensed under the repository's [MIT License](LICENSE).
