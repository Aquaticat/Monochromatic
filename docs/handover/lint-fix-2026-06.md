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

## Commits already made in this session

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

Later catalog-tighten commits are user work,
not part of this sweep.
Do not stage or alter catalog-tighten changes.

## Current working tree state

`git status --short` most recently showed:

```txt
 M packages/dev-script/catalog-tighten/package.json
 M packages/figma-parsers/kiwi/scripts/verify.ts
 M packages/figma-parsers/kiwi/src/index.ts
 M packages/figma-parsers/kiwi/src/index.unit.test.ts
 M packages/figma-parsers/kiwi/tsconfig.json
?? packages/figma-parsers/kiwi/src/binary-reader.ts
?? packages/figma-parsers/kiwi/src/canvas.ts
?? packages/figma-parsers/kiwi/src/decode.ts
?? packages/figma-parsers/kiwi/src/error-format.ts
?? packages/figma-parsers/kiwi/src/meta.ts
?? packages/figma-parsers/kiwi/src/parse.ts
?? packages/figma-parsers/kiwi/src/schema.ts
?? packages/figma-parsers/kiwi/src/types.ts
?? packages/figma-parsers/kiwi/src/zip.ts
```

The catalog-tighten file is out of scope and likely user-owned.
All kiwi files listed above are current-session work.

## Current package in progress: figma-parsers/kiwi

Root lint advanced past mutation-test,
vm-builder,
deps-cube,
and page-weight.
It then failed on `packages/figma-parsers/kiwi` with many diagnostics.
The main structural problem was `src/index.ts` over max-lines,
so it is being split instead of bypassing the line limit.

New files created so far:

- `src/types.ts`:
  shared domain types and absence sentinels.
- `src/binary-reader.ts`:
  factory-based binary reader replacing the banned class.
- `src/schema.ts`:
  schema parser and type-name resolver.
- `src/decode.ts`:
  document decoding and absence sentinels.
- `src/canvas.ts`:
  canvas.fig header and payload parsing.
- `src/meta.ts`:
  safe meta.json parsing from `unknown`.
- `src/zip.ts`:
  ZIP entry extraction.
- `src/parse.ts`:
  top-level `parseFigmaFile` orchestration.
- `src/error-format.ts`:
  caught-error formatter for required logging.

`src/index.ts` is now a barrel re-exporting those modules.
`src/index.unit.test.ts` was simplified to cover the main exported seams.
`tsconfig.json` was edited to add Node types,
but `mise run //packages/figma-parsers/kiwi:lint` still says `process` is unknown in `scripts/verify.ts`,
so confirm the package task is reading that setting or adjust config correctly.

## Last kiwi verification result

`mise run //packages/figma-parsers/kiwi:lint` still fails.
The latest reported classes include:

- many remaining `src/index.unit.test.ts` warnings,
  mostly fixture-builder mutation and non-null assertions from the old test shape.
  The test was rewritten afterward,
  so rerun before fixing stale diagnostics.
- `prefer-readonly-parameter-types` on functions accepting the mutable `BinaryReader` type.
  A partial refactor changed `BinaryReader.pos` to readonly and hides cursor state in a closure,
  but one edit failed and the file needs inspection.
- `require-await` on `extractZipEntries` and `decompressZstd`.
  Either make them synchronous and update call sites,
  or keep an actual async boundary if needed.
- `scripts/verify.ts` still has Node `process` type failures and unsafe access on narrowed `object` values.
  Convert narrowed records to `Record<string, unknown>` with a type guard,
  and fix Node types.
- TSDoc `@param options` is wrong for destructured params.
  Document destructured property names instead.

## Next recommended steps

1. Inspect `packages/figma-parsers/kiwi/src/binary-reader.ts` around the failed partial edit.
   Finish hiding mutable cursor state behind closure,
   or use a narrow suppression only if source inspection proves it is the right shape.
2. Rerun `mise run //packages/figma-parsers/kiwi:lint`.
3. Fix fresh diagnostics in kiwi only,
   keeping the split files under max-lines.
4. Commit kiwi changes with explicit pathspecs once its package lint passes.
5. Continue `mise run lint`.
   If catalog-tighten appears,
   skip it and leave issue #259 as the tracker.

## Verification already passed

- `mise run //packages/dev-script/mutation-test:lint` passed after the mutation-test fixes.
- `mise run //packages/dev-script/vm-builder:lint` passed after vm-builder fixes.
- `mise run //packages/dev-script/deps-cube:lint` passed after deps-cube fixes.
- `mise run //packages/dev-script/page-weight:lint` passed after page-weight fixes.

## GitHub issue created

- #259:
  `fix(catalog-tighten): track lint cleanup separately`.
  Created because the user asked to skip catalog-tighten while they work on it.
