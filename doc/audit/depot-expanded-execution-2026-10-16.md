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

## Native results

The native job `sfjhrbwvrs`,
attempt `2gv4q0p1bd`,
finished successfully in 157.920 seconds on 4 CPUs and 16 GiB RAM.
The parent run is marked cancelled because its separate browser preparation job was cancelled;
the native job's own terminal conclusion is success.

- Default features:
  58 passed,
  zero skipped.
- Fingerprint only:
  67 passed,
  zero skipped.
- Service only:
  71 passed,
  zero skipped.
- All features:
  80 passed,
  zero skipped.
- Existing all-features,
  all-targets Clippy task:
  passed with warnings denied.

These are 276 test executions covering 80 distinct test names across feature configurations.
The [companion evidence](depot-expanded-execution-2026-10-16.evidence.json)
preserves every test name,
raw resource samples,
API timestamps,
and the log hash.
The 68 historical events already classified as `musicCore` are the corresponding workload selector.
Use this expanded job as a replacement for the previous core all-features baseline when modeling cost;
adding both would count the old all-features test twice.

## Browser setup failure

The [matching-image run][browser-rootless] stopped before browser tests.
Podman exited 125 because `newuidmap` rejected the process identity:
`uid:1001 pw_uid:1001 st_uid:1001, gid:1001 pw_gid:117 st_gid:1001`.
The isolated [rootful Podman probe][browser-rootful] is testing whether the existing container tasks
work without that rootless user-mapping step.
The image version mismatch is tracked by [issue #1045][image-issue].

## Work remaining

The jobs are in progress.
Terminal outcomes,
browser counts,
timing evidence,
and remaining issue links will replace this section after verification.

[first-run]: https://depot.dev/orgs/l4zncjjbj5/workflows/p9sfmw70wq
[browser-rootless]: https://depot.dev/orgs/l4zncjjbj5/workflows/t3jdjq2nd3
[browser-rootful]: https://depot.dev/orgs/l4zncjjbj5/workflows/5f1hbcxtws
[image-issue]: https://github.com/Aquaticats/Monochromatic/issues/1045
