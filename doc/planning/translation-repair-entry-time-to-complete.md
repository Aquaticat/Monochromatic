# Translation-repair entry time to complete

## Decision state

Both generation-12 runs were stopped after correctness blockers were identified.
They are phase evidence,
not completion samples.
Before another `Carena0442` launch,
completion path must target fresh-run median below two hours without weakening quality.
Quality gates,
continuous correction,
distinct confirmation responsibility,
durable prompt payload replay,
and one-provider ordinary operation remain fixed measurement inputs.
Measured arms require both providers with `--require-providers synthetic,hyper`.

This work measures **entry time to complete**:
wall time from entry start through terminal `TALLY`,
including repair,
translate,
lane contest,
consolidation,
confirmation,
persistence,
and publication checks.
Only verified artifact and page count as successful completion.
`status=INCOMPLETE`,
quality rejection,
and operational error are censored unfinished outcomes rather than completion samples.

## Stopped measurements

Snapshot taken 2026-08-29 at 12:14 UTC.

### `Weideriche_`

- Process: `proc_a259`.
- Pipeline commit: `68c37da59c43529386cad78f3f8078d180d57f35`.
- Pipeline digest: `sha256-tree-v1:dc788a666af6bce37b37c55d4d674ac99185656795327d120413c3e1304aec9f58`.
- Run root: `~/temp/agent/validation-Weideriche-schema9-half-quorum-v12-20260829`.
- Log: `~/temp/agent/validation-Weideriche-schema9-half-quorum-v12-20260829.log`.
- Expected artifact: run root plus `artifacts/Weideriche_.json`.
- Expected page: run root plus `fixed/people/Weideriche_/page.en.md`.
- Verification log to create: `~/temp/agent/verify-Weideriche-schema9-half-quorum-v12-20260829.log`.
- State at snapshot: repair and translate complete; lane contest active; no terminal tally.
- First-attempt result after snapshot:
  `status=ERROR ms=4840305 aborted=false error=slice 1 did not meet absolute naturalness floor`.
- First attempt wrote no artifact or page and queued reattempt with 13 additional cache records.
- Process was stopped during non-conforming whole-entry second attempt.
- Repair slice costs recorded: 0.001, 927.787, 883.347, and 17.230 seconds.
- Translate slice costs recorded: 427.660, 250.694, 264.892, and 8.567 seconds.

### Pull request 386, `Carena0442`

- Process: `proc_3a1c`.
- Pull-request head: `a80634a674f94861ea3b7056fba054ca9eab1a2c`.
- Pipeline commit: `68c37da59c43529386cad78f3f8078d180d57f35`.
- Fixture pipeline digest: `sha256-tree-v1:2231798fcc453ccb9fe7ff688f4690ec7662e22ae70b833f91d70c7ec5cc9f58`.
- Run root: `~/temp/agent/validation-pr386-Carena0442-schema9-half-quorum-v12-20260829`.
- Log: `~/temp/agent/validation-pr386-Carena0442-schema9-half-quorum-v12-20260829.log`.
- Provenance: `~/temp/agent/pr386-Carena0442-run-provenance-20260829.md`.
- Expected artifact: run root plus `artifacts/Carena0442.json`.
- Expected page: run root plus `fixed/people/Carena0442/page.en.md`.
- Verification log to create: `~/temp/agent/verify-pr386-Carena0442-schema9-half-quorum-v12-20260829.log`.
- State at snapshot: 22 slices prepared; first non-metadata repair slice active; no terminal tally.
- Process was stopped after same-prompt repetition was rejected as independence mechanism.
- No artifact or page exists.

The pull-request run uses exact pull-request files in minimal Git fixture.
Throwaway pipeline source changes only supply pull-request commit and corpus location.
Its different pipeline digest makes it unsuitable as matched runtime arm against production-pinned run.

## Evidence to collect before and during fresh generation-13 runs

1.  Record terminal `TALLY`,
    process exit,
    entry wall time,
    artifact count,
    page count,
    and publication verification.
2.  Run `slice-cost-report` and `run-timing-report` against each complete log.
3.  Partition wall time into repair,
    translate,
    lane contest,
    consolidation,
    absolute review,
    confirmation,
    and persistence.
4.  Sum post-quorum grace separately from time to quorum.
5.  Count completed,
    unusable,
    retried,
    and abandoned calls per model without treating abandoned-call latency as completed latency.
6.  Record source characters,
    slice count,
    changed-slice count,
    correction count,
    and confirmation count.
7.  Read complete published page when one exists;
    terminal success without acceptable output is not performance success.
8.  Compare only runs with same pipeline digest,
    stage inventory,
    cache warmth,
    corpus input,
    and provider conditions.
9.  Require log line `REQUIRED-PROVIDERS synthetic,hyper status=wet`
    before model traffic for every timing arm.
10. Record prompt-payload replay count separately from provider calls;
    resumed replay is not cold-run generation time.

Completion criterion:
every recorded millisecond belongs to named phase or named uninstrumented remainder,
publication quality outcome sits beside timing result,
and median of at least three isolated fresh same-digest successful runs is below two hours.
Measure unchanged-run band before crediting optimization smaller than that band.

## Comparison rules

Stopped runs overlapped in wall clock and shared provider capacity.
They are partial operational traces,
not clean concurrency experiment or completion sample.
Do not infer speedup,
slowdown,
or provider capacity from their elapsed-time ratio.

Before attributing a change smaller than ordinary variation,
measure repeated unchanged-build runs and establish run-to-run band.
A single run does not characterize model latency,
straggler grace,
or correction demand.

Cache reuse changes question from cold entry completion to resumed entry completion.
Report cold and resumed runs separately.
A command exit code of zero remains insufficient;
`TALLY`,
artifact and page counts,
and `verify-published` decide terminal state.

## Questions for completion-path design

- Which phase owns largest measured share of each entry wall time?
- How much post-quorum grace bought usable evidence that affected outcome?
- How much grace ended with abandoned voice or duplicated decision evidence?
- Does serial slice ordering dominate entry time,
or do consolidation corrections dominate?
- Which observability gaps leave wall time unattributed?
- Can scheduling change reduce wall time without changing question,
quorum,
fidelity,
naturalness,
or failure semantics?
- Which proposed change can be tested as matched disposable arm before production adoption?

No new validation launches before partial Carena log is phase-attributed,
correctness changes are committed,
and matched optimization plan preserves strict quality.
