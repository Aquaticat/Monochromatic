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
- Mutant enumeration happens host-side with `oxc-parser`; containers receive a byte-span manifest
  and never need oxc. Splice on Buffers (oxc spans are UTF-8 byte offsets, JS strings are UTF-16).
- Operators: port semantics of the ~15 Stryker mutator families as parity spec, fresh implementation.
- Deleting with Stryker: all `@stryker-mutator/*`, the whole `@babel` subtree, and the `typescript6`
  (`catalog:classic`) alias whose only consumer is Stryker's checker.

## Checklist

- [ ] Stryker reference run on `packages/module/async-time` captured to scratchpad (must precede deletion).
- [ ] oxc-parser probed (span semantics verified) and added to pnpm catalog.
- [ ] Package scaffolded per AP1-AP5.
- [ ] Engine: types, operators, Buffer splicer, deterministic ids, manifest; unit tests incl. multibyte.
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
