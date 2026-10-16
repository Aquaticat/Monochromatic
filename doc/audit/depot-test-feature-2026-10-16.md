# Depot Test feature trial on 2026-10-16

## Scope and status

This is an isolated trial of Depot's Test feature,
not a CI migration.
The trial branch is `trial/depot-tests-20261016`.
Its workflow is `.depot/workflows/depot-tests-trial.yml`.
It exercises repository Rust tests through nextest,
JUnit ingestion,
controlled failure,
skipped tests,
same-commit retry,
CLI retrieval,
analytics,
and timing-based splitting.

The initial report upload succeeded and exposed duplicate ingestion.
The clean failure/retry and timing-split trials are still running.
No speedup or billing-total conclusion is established.

## Initial report evidence

[Run `lw9hrglt00`][initial-run] used trial commit `2e1c21b01f`
as a local patch over `46effff65ab4193b4311d7675e301c97007176d1`.
The first attempt is `cp6tk4gdh6`.
The task changed an existing `window_frames` assertion inside the disposable sandbox,
ran nextest with default crate features,
and restored the source in `finally`.
Nextest reported 58 cases:
57 passed and the intended assertion failed.
The action uploaded native nextest JUnit after the failing step.

Uploading that same file again with the same `audio-core` key produced another accepted upload.
`depot tests cp6tk4gdh6 --ci --org l4zncjjbj5 --page-size 500 --output json`
returned 116 rows,
58 distinct test names,
114 passing results,
and 2 failing results,
with no continuation token.
See the [duplicate-ingestion investigation][duplicates].

The initial skip filter named the source file's module rather than the compiled Rust module.
It matched no test,
so this run does not establish skipped-test handling.
The corrected fixture excludes `gain::tests::silence_gives_unity_gain`.

The first retry retained the deliberate failure because a branch-scoped trial variable did not match.
`depot ci run show` reported a SHA in `ref`.
The retry log did establish `GITHUB_RUN_ATTEMPT=2`,
so the subsequent fixture uses the observed attempt number directly.
The temporary trial variable was removed.

## Pending verification

- Run `qlmb7szd5v` exercises the corrected skipped-test filter and attempt-controlled assertion.
- Timing splitting uses the real `truepeak-core`,
  `monochromatic-jsonc-edit`,
  and `forbidden-regex` test binary identities across 2 matrix shards.
  The first launch rejected an incorrect `--split-key` argument to `depot tests split`.
  The corrected task uses that subcommand's `--key` flag
  and retains `--split-key` for `depot tests run`.
- Retrieve complete result sets and analytics after the clean retry.
- Repeat the splitting job after native JUnit reports provide timing history.
- Record billing semantics separately from account usage,
  which requires authenticated usage evidence.

## Sources

[Depot's test-results documentation][test-docs] describes JUnit ingestion,
dashboard history,
CLI filters,
and billing.
[The splitting guide][split-docs] describes candidate identities,
historical timing assignment,
and `depot tests run`.
The installed CLI used for local collection is Depot `2.102.22`.
The report action is pinned to `2ad5779840a9c63e884fa26f11d019768a27a941`.

[initial-run]: https://depot.dev/orgs/l4zncjjbj5/workflows/lw9hrglt00
[duplicates]: ../troubleshooting/depot-test-report-duplicate-ingestion.md
[test-docs]: https://depot.dev/docs/ci/observability/depot-ci-test-results
[split-docs]: https://depot.dev/docs/ci/how-to-guides/split-tests
