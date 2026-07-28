# `prefer-readonly-parameter-type` reports different findings on repeated identical runs under oxlint 1.75.0 multi-threaded linting

Running the same lint twice over the same unmodified sources produces different diagnostics.
The difference is a whole finding appearing or disappearing, not a reordering.
Passing `--threads 1` removes it entirely.

## Symptom

`mise run //package/desktop-app/electron-infra:lint:oxlint`,
run repeatedly with no edit between runs,
alternates between eight and nine `prefer-readonly-parameter-type` findings.
The ninth is an offer:

```text
x prefer-readonly-parameter-type(prefer-readonly-parameter-types): Parameter "{
  | expected,
  | observed,
  | }" should be readonly: index signature is writable.
   ,-[src/wayland-state.ts:166:3]
```

`stateMatches` in `package/desktop-app/electron-infra/src/wayland-state.ts:165`
reads `Object.entries(expected)` and `observed[key]` and writes nothing,
so the offer is correct and the runs that omit it are the wrong ones.
The direction is therefore safe here,
a withheld offer rather than an offer for written state,
but nothing about a scheduling-dependent result guarantees that direction in general.

The same flip is visible at workspace scale.
Two full sweeps of the same commit reported 1837 findings with 27 offers and
1838 findings with 28 offers,
the difference being exactly this one diagnostic.

## Root cause

Not yet pinned to a line.
What is established by measurement:

- The flip is controlled by oxlint's thread count, and by nothing else tested.
- It is not the persistent effect cache. Deleting
   `node_modules/.cache/prefer-readonly-parameter-type` before every run leaves the
   multi-threaded flip rate unchanged, and leaves single-threaded runs deterministic.
- It is not the analysis budget in `effect-analysis-budget.ts`. That fails closed through
   `SemanticBridgeError`, which `prefer-readonly-parameter-types.ts:204` logs as
   `semantic rule failed`, and no run of either kind emitted one.
- Raw output order differs between multi-threaded runs, so files reach the rule in a
   different order each time. Under `--threads 1` that order is fixed.

The rule holds process-local state that outlives a single file:
`finalIndexesByProject` in `effect-final-index-cache.ts:29`,
keyed by the TypeScript project snapshot and a file-list digest,
and `summariesByProject` in `effect-summary-cache.ts:59`.
An answer that depends on which files were analyzed first would explain everything measured,
and those are the places such a dependence could live.
That is a hypothesis, not a trace:
nothing here yet demonstrates which piece of that state changes the answer.

## Verification

oxlint 1.75.0, from the pnpm catalog.
Sixteen logical CPUs, so the default thread count is sixteen.
Every run is the same command over the same unmodified working tree at commit `54a1d06d4`:

```bash
mise run //package/desktop-app/electron-infra:lint:oxlint 2>&1 \
  | rg --count 'should be readonly'
```

The single-threaded form injects `--threads 1` through the wrapper's
`OXLINT_THREADS` environment variable, read at
`package/dev-script/task-util/src/oxlint-wrapper.ts:50`:

```bash
OXLINT_THREADS=1 mise run //package/desktop-app/electron-infra:lint:oxlint 2>&1 \
  | rg --count 'should be readonly'
```

Measured, counting runs that reported the offer:

- Default threads, cache left warm: four of twelve.
- Default threads, `node_modules/.cache/prefer-readonly-parameter-type` deleted before
   each run: three of five.
- `--threads 1`, cache left warm: six of six.
- `--threads 1`, cache deleted before each run: four of four.

So seventeen multi-threaded runs split seven to ten,
and ten single-threaded runs agreed unanimously on the answer that is correct by inspection.

Every other finding in the package was identical across all runs.
Comparing sorted `location + message` pairs rather than raw output is necessary,
because multi-threaded runs also emit the same findings in a different order.

## Verified workarounds

Set `OXLINT_THREADS=1` for any run whose output is being compared against another run:

```bash
OXLINT_THREADS=1 mise run //:lint:oxlint
```

Tradeoff: the workspace sweep is the slowest thing in the repo already,
and this serializes it.
It buys a comparable result and buys nothing else,
so it belongs on measurement runs rather than on ordinary linting.

There is no workaround that keeps parallelism.
Reducing the thread count without reaching one narrows the window rather than closing it.

## What does not work

- Deleting the persistent cache before each run. The flip rate is unchanged, which is what
   rules the cache out as the cause rather than fixing anything.
- Comparing a single pair of runs. Two multi-threaded runs agreeing proves nothing, and the
   stage-one slot refactor was checked exactly that way: baseline and refactor both reported
   1837 findings and 27 offers with identical offer sets, which now reads as two samples from
   a distribution rather than as evidence the refactor changed nothing.
- Reading the run's warnings. The rule's fail-closed path logs
   `semantic rule failed, so <file> has no readonly analysis this run`, and neither the runs
   that produce the offer nor the runs that omit it log anything.

## Upstream filing decision

Nothing to file.
The first constraint decides it:
the defect is in this repository's own rule,
not in oxlint.
oxlint's contribution is scheduling files across threads,
which is its documented behaviour and is deterministic in the only sense it promises.
A rule whose answer depends on the order its files arrive in is the rule's bug.

`.out-of-scope/` was checked and holds no entry for oxlint or for this bug class.
The remaining five constraints are not reached,
because a report would be addressed to ourselves.

The repository-side work is tracked as a task rather than an issue,
and this document is the record a future session should read before trusting any sweep
comparison.
