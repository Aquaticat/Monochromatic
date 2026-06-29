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

Catalog-tighten commits seen in history are user work,
not part of this sweep.
Do not stage or alter catalog-tighten changes.

## Current status

`git status --short` was clean immediately before the last root lint rerun,
and after the penpot/stdio fix commit.
Keep checking before edits because user catalog-tighten work may reappear.

`mise run //packages/figma-parsers/kiwi:lint` passed after commit `f36c3efd3`.
`node packages/figma-parsers/kiwi/src/index.unit.test.ts` also passed.

The last `mise run lint` run failed on:

- `packages/figma-parsers/penpot`:
  `catch-binding` in `src/uuid.ts`,
  low-information `SKIP` Symbol description,
  and Figma document absence narrowing after figma-kiwi introduced `FIGMA_DOCUMENT_ABSENT`.
- `packages/mcp/stdio`:
  low-information `NO_RESPONSE` Symbol description.

Those failures were fixed and package-verified together:

```bash
mise run //packages/figma-parsers/penpot:lint //packages/mcp/stdio:lint
```

The command exited 0 with `Found 0 warnings and 0 errors`.

## Next recommended steps

1. Run `mise run lint` again.
2. If failures appear outside catalog-tighten,
   fix and commit them with explicit pathspecs.
3. If catalog-tighten is the only failure,
   do not fix it in this sweep;
   leave issue #259 as the tracker and report that root lint is blocked by the skipped package.
4. Update this handover after the next meaningful package boundary or root-lint result.

## GitHub issue created

- #259:
  `fix(catalog-tighten): track lint cleanup separately`.
  Created because the user asked to skip catalog-tighten while they work on it.
