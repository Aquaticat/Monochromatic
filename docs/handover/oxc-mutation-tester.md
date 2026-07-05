# Handover: oxc mutation tester (issue 247)

Living doc for the ground-up rewrite of the mutation tester.
Update this file whenever a milestone lands or a decision changes.

## State

- Plan drafted and posted: <https://github.com/Aquaticat/Monochromatic/issues/247#issuecomment-4887670850>.
  The plan comment is the authoritative design record; issue body Status links to it.
- Implementation not started yet; task breakdown exists in the session task list and mirrors the checklist below.

## Decisions (from the design interview, all user-confirmed)

- Deliverable: plan, then implement in the same arc; close issue 247 explicitly when done.
- Full parity including the TypeScript type-check filter, not MVP-without-filter.
- Ground-up rewrite of everything; `packages/dev-script/mutation-test` deleted at the end.
- New home: `packages/cli/mutation-test`, npm `@monochromatic-dev/cli-mutation-test`, bin `mutation-test`,
  single package (engine plus orchestrator together).
- Architecture: sharded disposable containers with taint-aware re-runs.
  Trust model: once the first mutant executes in a container, that container is untrusted.
  Shards grouped by source file, chunk max initially 16 (engineering guess, benchmark later).
  Taint (per-mutant timeout, runtime/infra error, restore failure, container nonzero exit)
  re-runs the shard remainder as fresh half-size shards (bisection; position-1 results always final).
- Confirmation always on, no flag: every Survived and final Timeout re-verified as mutant number 1
  in a fresh container. Killed accepted from any position.
- Type-check filter: spawn `tsgo --noEmit --incremental --project` per mutant in-container
  (warm `.tsbuildinfo` from baseline). Measured 0.125 s warm on `packages/module/test`.
  Watch-daemon approach rejected on evidence: tsgo 7.0.1-rc watch output has no completion terminator
  and fanotify failed on the dev host.
- No mutation score anywhere. Native versioned JSON report: statuses killed/survived/timeout/compileError/runtimeError,
  per-mutant provenance (shard id, position, rerun count, confirmed flag). Exit 0 unless infra failure.
- Suppression support is a must-have (user request mid-session): comment directives
  `mutation-test-disable-next-line [families] [-- reason]` and `mutation-test-disable-file`,
  validated family names, suppressed mutants reported in an `ignored` bucket with reasons
  (partially reverses the earlier drop-Ignored decision).
- Mutant enumeration happens host-side with `oxc-parser`; containers receive a span manifest
  and never need oxc.
- CORRECTION to the posted plan (probe-verified, oxc-parser 0.138.0): the JS bindings return
  UTF-16 string offsets, not UTF-8 byte offsets. `source.slice(start, end)` is exact, including past
  astral characters; Buffer.subarray at those offsets is WRONG. Splice on JS strings, never Buffers.
  Mention this when closing the issue so the plan comment's Buffer claim doesn't mislead.
- Operators: port semantics of the ~15 Stryker mutator families as parity spec, fresh implementation.
- Deleting with Stryker: all `@stryker-mutator/*`, the whole `@babel` subtree, and the `typescript6`
  (`catalog:classic`) alias whose only consumer is Stryker's checker.

## Checklist

- [x] Stryker reference run captured: `packages/module/fs-path` (NOT async-time: old tool needs
      module-logger+module-test deps). Reports for 7 of 8 files in scratchpad
      `stryker-reference-fs-path/` (totals: 9 killed / 319 survived / 2 timeout / 109 compileError);
      `find-monorepo-root.ts` has environment-dependent tests that fail in-container (red baseline),
      so no tool can reference it. Two old-tool preflight fixes landed on the way (commits
      a28b34e41, 862e4ac66).
- [x] oxc-parser probed (UTF-16 spans confirmed) and added to pnpm catalog.
- [x] Package scaffolded per AP1-AP5 (commit 88a611826).
- [x] Engine complete with suppression must-have (user request): string-slice splicer,
      deterministic ids, work-stack walker, 15 families, mutation-test-disable-next-line/-file
      directives. Unit tests pass, oxlint 0/0, types clean. fs-path enumeration: 523 mutants
      vs Stryker 439 (superset; empty.ts exact match 41=41).
- [ ] Container-side shard runner: worktree, baseline (tests green + tsgo clean), per-mutant loop, shard report.
- [ ] Host orchestrator: CLI, selection, sharding, bounded podman spawns, bisection re-runs, confirmation, aggregation.
- [ ] Runtime image moved/adapted; root `mise.toml` PATH updated.
- [ ] Fixture package + end-to-end integration test.
- [ ] Verification: new tool on `async-time`, parity comparison vs reference, tsgo cost re-measured.
- [ ] Old package deleted, catalog purged, lockfile regenerated via pnpm, troubleshooting docs reviewed.
- [ ] Issue 247 closed with summary comment.

## Gotchas for future sessions

- The reference run must happen while the old tool still works; do not delete `packages/dev-script/mutation-test`
  before the report is captured and the comparison is done.
- `rg` reminder: `-r` is `--replace`, not recursive; use long-form flags.
- Old tool invocation surface: bin `mutation-test` from `packages/dev-script/mutation-test/node_modules/.bin`
  (on PATH via root `mise.toml`); requires its dist to be built (`mise run //packages/dev-script/mutation-test:build`).
- tsgo probe artifacts: a stray `dist/final/types/tsconfig.tsbuildinfo` write happened in
  `packages/module/test` during the timing probe (gitignored build cache, harmless).
