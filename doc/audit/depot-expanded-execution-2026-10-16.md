# Expanded Depot execution on 2026-10-16

## Purpose and scope

This report records actual browser and native checks in an isolated trial branch,
`trial/depot-expanded-20261016`,
based on `d6deca5fa570d6ba71afdab837e508a9f7ff6b0e`.
It does not authorize production routing or a billing-plan change.

The execution queue is:

- Run the existing logger and filesystem browser suites in Chromium,
  Firefox,
  and WebKit with explicit nonempty result counts.
- Run the native audio core with default,
  fingerprint-only,
  service-only,
  and all features,
  then run its existing Clippy task.
- Preserve failures,
  skipped cases,
  setup costs,
  and missing surfaces separately.
- Verify the test reporter with a deliberate assertion failure where necessary.
- File distinct discovered problems after checking existing issues.

## Initial evidence

`pnpm-lock.yaml` resolves `@playwright/test` to `1.64.0` at the trial base,
while `playwright.Dockerfile` selects `1.63.0`.
The experiment will use the published `1.64.0-noble` OCI index digest
`sha256:06a9939e57531807f8d5fd76ce44b53165ffb7d7501d87ab10e285c20b1e971f`.
Registry verification required an Accept header that included OCI image indexes;
a bare HEAD request returned 404,
while the OCI-aware request returned 200 and this digest.
The first response does not establish that the image is unavailable.

The first [Depot run][first-run] uses revision
`a21e6369936689a962de528dce0a0f8b9e22f4fe`.
The native job continues independently.
The browser preparation job was cancelled to replace an unnecessary browser-install workaround
with the verified matching image.
No test outcome is claimed from that cancelled browser job.

## Work remaining

The jobs are in progress.
Terminal outcomes,
counts,
timing evidence,
issue links,
and the companion evidence file will replace this section after verification.

[first-run]: https://depot.dev/orgs/l4zncjjbj5/workflows/p9sfmw70wq
