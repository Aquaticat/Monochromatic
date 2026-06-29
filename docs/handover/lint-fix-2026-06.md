# Lint fix handover

## Current human instructions

- Fix repo-wide `mise run lint` failures.
- Do not satisfy `catch-binding` with an unused `catch (error)`.
  Log the caught value,
  even when the error is expected,
  or rethrow.
- Skip `packages/dev-script/catalog-tighten` in this sweep.
  The user is working there.
  Issue #259 tracks that package separately.
- Keep this handover updated from time to time.
- Current pause request:
  update this handover,
  commit it,
  then pause.

## Commits made in this session

- `7a0d8c9a7`:
  mutation-test catch bindings and Symbol descriptions.
- `9d85256c0`:
  vm-builder catch bindings.
- `3197fd056`:
  logged expected catch paths in mutation-test and vm-builder,
  added AGENTS/CLAUDE rule LG2.
- `97a574293`:
  deps-cube lint diagnostics,
  including logged catch paths.
- `359640a17`:
  page-weight lint diagnostics,
  including logged catch paths.
- `61b724390`:
  created this handover.
- `f36c3efd3`:
  split figma-kiwi into focused modules,
  replaced sync decompression,
  and refreshed unit seams.
- `ff6490a2a`:
  fixed figma-penpot and mcp/stdio lint surfaced by the next root run.
- `1c459b445`:
  refreshed this handover after kiwi,
  penpot,
  and stdio progress.

Catalog-tighten commits seen in history are user work,
not part of this sweep.
Do not stage or alter catalog-tighten changes.

## Current working tree state at pause

Latest `git status --short` before this handover edit showed only catalog-tighten work:

```txt
 M packages/dev-script/catalog-tighten/src/index.ts
?? packages/dev-script/catalog-tighten/src/yaml-rewrite.ts
?? packages/dev-script/catalog-tighten/src/yaml-rewrite.unit.test.ts
```

Those files are out of scope for this sweep.
Do not add or edit them unless the human explicitly changes the skip instruction.

## Verified package progress

- `mise run //packages/dev-script/mutation-test:lint` passed after mutation-test fixes.
- `mise run //packages/dev-script/vm-builder:lint` passed after vm-builder fixes.
- `mise run //packages/dev-script/deps-cube:lint` passed after deps-cube fixes.
- `mise run //packages/dev-script/page-weight:lint` passed after page-weight fixes.
- `mise run //packages/figma-parsers/kiwi:lint` passed after commit `f36c3efd3`.
- `node packages/figma-parsers/kiwi/src/index.unit.test.ts` passed after the kiwi split.
- `mise run //packages/figma-parsers/penpot:lint //packages/mcp/stdio:lint` passed after commit `ff6490a2a`.

## Last root lint result

`mise run lint` was rerun as process `root-lint-2` after the penpot/stdio fix.
It failed because `packages/dev-script/catalog-tighten` reported a warning in user-owned work:

```txt
packages/dev-script/catalog-tighten/src/yaml-rewrite.ts:80
stylistic(chain-per-line)
Found 1 warning and 0 errors.
```

This package is explicitly skipped for the current sweep,
so do not fix that warning here.
The same root run showed kiwi,
penpot,
and the earlier fixed packages passing before the aggregate stopped.
Do not overclaim full repo success from that run because the aggregate aborted while other lint fanout work was still in progress.

## Failed skip-verification attempts

I tried to verify all lint tasks except catalog-tighten,
but the ad hoc commands were flawed and should not be treated as evidence:

- `lint-excluding-catalog` walked through `node_modules` symlink loops and crashed with `ELOOP`.
- `lint-excluding-catalog-2` discovered `mise.toml` files that do not define `:lint`,
  then crashed on `//packages/test-fixture/toml-edit:lint`.
- `lint-excluding-catalog-3` passed many tasks as positional arguments to one root lint child,
  causing `dprint` to receive task names as file paths and fail with no files found.

Next agent should use a correct skip strategy,
for example parse `mise tasks ls --all --json` for package `:lint` task names and run them one at a time or in small explicit batches,
then run root lint children separately without appending task names as arguments.

## Next recommended steps

1. Keep pausing until the human resumes the sweep.
2. On resume,
   check `git status --short` and continue avoiding catalog-tighten files.
3. Verify non-catalog lint with a correct skip strategy,
   or run root `mise run lint` and treat catalog-tighten as the expected skipped blocker.
4. Fix and commit only non-catalog failures.
5. If catalog-tighten remains the only root-lint blocker,
   report that root lint is blocked by the skipped package and cite issue #259.

## GitHub issue created

- #259:
  `fix(catalog-tighten): track lint cleanup separately`.
  Created because the user asked to skip catalog-tighten while they work on it.
