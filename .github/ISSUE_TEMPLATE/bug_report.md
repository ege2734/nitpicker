---
name: Bug report
about: Report something that doesn't work when installing or using nitpicker
title: "[bug] "
labels: bug
---

<!--
Reminder: nitpicker is DEV-ONLY. It is NODE_ENV-gated and tree-shaken from `next build`,
so it should never run (or appear) in a production build. If your report is about
something showing up in production, please say so explicitly under "prod-safety" below.
-->

## What happened

<!-- A clear description of the bug. -->

## What you expected

<!-- What you expected to happen instead. -->

## Steps to reproduce

1.
2.
3.

## Environment

- Framework + version: <!-- Next.js App Router? Vite? which version? -->
- React version:
- Package manager: <!-- npm / pnpm / yarn / bun -->
- OS:
- Node version: <!-- node -v -->

## Prod-safety relevant?

<!--
Does this involve nitpicker leaking into production, or the prod-safety greps failing?
    grep -r html2canvas .next/static
    grep -r data-nitpicker-source .next   (excluding cache/ and dev/)
If yes, paste what those greps returned.
-->

## Logs / output

<!-- Relevant console output, sidecar logs, `nitpicker poll` output, or a stack trace. -->
