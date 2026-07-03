---
name: Feature request
about: Suggest an idea or improvement for nitpicker
title: "[feature] "
labels: enhancement
---

## Problem

<!-- What are you trying to do that nitpicker makes hard or impossible today? -->

## Proposed solution

<!-- What you'd like to see. Be concrete about the developer-facing behavior. -->

## Alternatives considered

<!-- Other approaches you thought about, and why they fall short. -->

## Does it preserve the contract?

<!--
nitpicker is DEV-ONLY with a zero-production-footprint guarantee: everything is
NODE_ENV-gated, tree-shaken from `next build`, and the app never imports the
sidecar/CLI. Does your proposal keep that intact? If it needs to touch anything
that could reach a production bundle, call that out explicitly.
-->
