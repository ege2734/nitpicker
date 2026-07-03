<!--
Thanks for contributing to nitpicker! nitpicker is a dev-only skill with a zero-production-footprint
contract — please verify accordingly. See CONTRIBUTING.md for the full portability loop.
-->

## Summary

<!-- One or two sentences: what this PR does and why. -->

## What changed

<!-- Bullet the concrete changes (assets, skill instructions, tests, etc.). -->

-

## Verification

<!-- Check what you actually did. Don't check a box you didn't run. -->

- [ ] Ran `npm test` (the vitest units under `assets/nitpicker/tests`) — passing.
- [ ] Installed into a scratch Next app and drove the overlay (region drag → red-boxed PNG delivered to a running `nitpicker poll`; element click → `source`/`selector` recorded).
- [ ] Ran the two prod-safety greps after `next build` — **both empty**:
  - [ ] `grep -r html2canvas .next/static`
  - [ ] `grep -r data-nitpicker-source .next` (excluding `cache/` and `dev/`)
- [ ] Removed the throwaway app — only the skill + assets + README + governance files are committed.

## Notes

<!-- Anything reviewers should know: trade-offs, follow-ups, sharp edges touched. -->
