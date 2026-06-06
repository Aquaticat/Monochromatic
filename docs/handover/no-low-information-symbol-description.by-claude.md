# No low information symbol description: implementation handover

Session wrap-up for the oxlint rule implementation, paused mid-verification.
The companion files in this directory are `no-low-information-symbol-description.md` (the calibration
handover) and `no-low-information-symbol-description.plan.md` (the execution plan, copied from the
authoring session). This document records what the implementation session built and what remains.

## Where the work lives

The implementation is committed on a feature branch in a separate worktree, not on `main`.

- Worktree: `/var/home/user/worktrees/oxlint-low-info-symbol`
- Branch: `feat/oxlint-low-info-symbol`
- Checkpoint commit: `a2e8a99c` ("feat(*): implement no-restricted-syntax/no-low-information-symbol-description")

The commit is a tested checkpoint, not a finished PR. Resume in that worktree, not in a fresh one,
because a fresh worktree cannot bootstrap its own toolchain yet (see "Toolchain gotchas").

## What was implemented

- `packages/oxlint-plugins/no-restricted-syntax/src/rules/no-low-information-symbol-description.ts`:
  new `CreateOnceRule`, a faithful port of the benchmark classifier (the `classifyDescription`
  function in the `.benchmark.html`, not the threshold sweep). Eight message ids, one per failure
  branch. No regex; tokenizer is an index scan using the helper-shape exemption of
  `no-function-root-let` for its one root `let`. Static descriptions are read from string literals
  and zero-expression template literals; absent, dynamic, and non-string descriptions are skipped
  via a `NO_STATIC_DESCRIPTION` Symbol sentinel.
- `packages/oxlint-plugins/no-restricted-syntax/src/index.ts`: registered alphabetically between
  `no-hasownproperty` and `no-module-root-let`.
- `packages/test-fixture/oxlint-no-restricted-syntax/.oxlintrc.fixture.json`: rule enabled as error.
- `packages/test-fixture/oxlint-no-restricted-syntax/src/invalid/no-low-information-symbol-description.ts`:
  minimal `Symbol('meow')` violation for the generic substantive-rule test.
- `packages/oxlint-plugins/no-restricted-syntax/src/oxlint-no-restricted-syntax.unit.test.ts`: added
  the rule to `SUBSTANTIVE_RULES` and a dataset-driven describe block. The tests read the
  `.pass.txt` / `.fail.txt` / `.borderline.txt` files directly, generate one `Symbol(<json>)` call
  per row into a disposable temp file, and lint it with the fixture config. `runOxlint` was extracted
  so it can lint an absolute temp path.
- `packages/test-fixture/oxlint-no-restricted-syntax/src/valid/no-nullish-union.ts` and
  `.../valid/no-optional-escape.ts`: raised the `Symbol('not-found')` sentinel to
  `Symbol('requested key not found in store')` so the existing valid-fixture tests still pass.
- `packages/config/oxlint/src/rules/restriction.ts`: rule enabled repo-wide as `warn` (not `error`)
  pending remediation.
- `packages/oxlint-plugins/no-restricted-syntax/README.md`: rule bullet and a dedicated section with
  pass / fail / borderline examples and the no-compression, no-vocabulary-list notes.

## Verified

- Plugin unit tests pass (run with `bun` directly, oxlint on PATH): 145 pass rows produce zero
  diagnostics, 217 fail rows produce exactly one each, every failure branch emits a distinct message,
  and the borderline rows stay out of the pass and fail data. This confirms the port matches the
  benchmark classifier exactly.
- Type check passes (`tsgo --build` in the package).
- A throwaway user-boundary smoke test agrees with the unit tests (a copy lives at
  `/tmp/agent/lowinfo-smoke.ts`; run it from inside the worktree so `nano-spawn` resolves).

## Remaining (paused)

1. Full `lint:oxlint` over the new source. It could not run in the fresh worktree because the root
   `oxlint.config.ts` imports the unbuilt `config-oxlint` dist (see issue below). Type check is clean,
   so the likely gaps are style or TSDoc nits only.
2. Package `build` verification (plan step 4).
3. Repo-wide remediation scan: enable the rule and lint real source. Known offenders already labeled
   as fail rows include `Symbol('no-static-method-name')` in `rules/no-regex.ts` (a borderline row)
   and `Symbol('outside-string')` in `rules/arrow-function-params.ts`. The plan is explicit: rewrite
   the real Symbol descriptions to carry more context rather than weaken the classifier or move rows
   into the borderline file.
4. Benchmark re-confirm via `agent-browser` on the `file://` URL. The benchmark was not changed this
   session, so this only re-confirms the existing zero-error state.
5. Flip `restriction.ts` from `warn` to `error` once the repo reports no violations outside intended
   fixtures.

## Key implementation decisions

- The tokenizer keeps one root `let current` and ends with `return words`, which the
  `no-function-root-let` helper-shape exemption allows. `arrow-function-params.ts` uses the same
  pattern, so this is consistent with the package.
- The grammar hooks (`no`, `not`, `because`, `ed`, `ing`) and the dot/underscore specificity markers
  are named constants so future reviews can challenge them, per the plan.
- Tests generate temp sources rather than hand-maintaining hundreds of `Symbol` calls; the `.txt`
  files are the source of truth.

## Toolchain gotchas discovered

- The Bash tool's working directory resets to the primary checkout between commands when operating in
  a worktree, so unprefixed `mise` / `pnpm` / `git` / `bun` silently target `main`. This now has a
  rule: `WCD` in AGENTS.md, with the detail under "Command execution conventions: cwd resets in
  worktrees (WCD)" in `docs/philosophy/agents.md`. Always prepend `cd <worktree-abs-path> &&`.
- A fresh worktree cannot bootstrap its own lint/type/build toolchain:
  `task-tsgo` / `task-oxlint` bin shims are missing until the tooling packages are built, the root
  `oxlint.config.ts` imports the unbuilt `config-oxlint` dist, and `mise run build` fails at
  `//packages/dev-script/inference-canary-*:build`. Filed as
  [issue #243](https://github.com/Aquaticat/Monochromatic/issues/243). Until that is resolved, run
  unit tests with `bun <file>` and type checks with `tsgo --build` directly.

## How to resume

1. `cd /var/home/user/worktrees/oxlint-low-info-symbol` (and keep prepending `cd` to every command).
2. Re-run the plugin unit tests with `bun` to confirm the checkpoint is intact.
3. Build the tooling closure needed for `config-oxlint` (or wait on issue #243), then run
   `lint:oxlint`, the package `build`, and the repo-wide remediation scan.
4. Remediate real-source Symbol descriptions, then flip the repo config to `error`.
5. Follow `no-low-information-symbol-description.plan.md` as the checklist for anything not covered here.
