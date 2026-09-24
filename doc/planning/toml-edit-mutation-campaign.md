# TOML edit mutation campaign

## Goal and scope

The user requested mutation testing against `package/module/toml-edit` and fixes for actionable findings.
Use the opt-in `test:mutation` task with `--full-suite` and reports under private scratch.
The package task scans `src/conformance/` by default,
 but the upstream conformance runner does not execute inside the mutation container.
The targeted campaigns here name runtime source files explicitly.

## Completed evidence

- Initial container smoke on `src/toml-has.ts`:
  one killed,
  five compile errors,
  no infrastructure errors.
- Accessor batch on `empty-toml-edit.ts`,
  `toml-get-value.ts`,
  `toml-set-header-comment.ts`,
  `toml-keys.ts`,
  and `toml-stringify.ts`:
  nine killed,
  three confirmed survivors,
  and 42 compile errors.
  Added a canonical-options test and scalar-path key test in `canonical.unit.test.ts` and `toml-keys.unit.test.ts`.
  Recheck killed both actionable mutants.
- The remaining `toml-keys.ts` condition mutant skips `result === MISSING`.
  `MISSING` is a symbol (`document-materialize.ts`),
  so the same input falls through to the final empty-array return.
  Keep the explicit guard as documentation of missing-path handling.
- A direct built-artifact probe found that `trailingNewline: false` did not remove final newlines from canonical output,
  and canonical parsed output without a newline did not gain one when enabled.
  Added red tests in `canonical.unit.test.ts`,
  fixed the final-output boundary in `emit-document.ts`,
  and verified through `buildAndTest` and a built-artifact call.
- Core batch on `path.ts`,
  `path-prefix.ts`,
  `resolve-block.ts`,
  and `build-value.ts`:
  12 killed,
  19 confirmed survivors,
  and 96 compile errors.
  Added built-artifact assertions for `_formatPath` and `_isStrictPrefix`.
  Recheck on the path files produced 26 killed,
  one confirmed equivalent survivor,
  and 31 compile errors.
- The `path-prefix.ts` equivalent mutant forces the non-strict length check to true.
  For valid string or numeric path segments,
  any candidate past the end compares against `undefined` and fails the `every` check anyway.
- The `build-value.ts` survivor fills `commentsBefore` on inline-table entries.
  `emit-value-node.ts` renders those entries using keys and values,
  never `commentsBefore`;
  top-level blocks use `emit-document.ts` instead.
  No public behavior distinguishes this mutant.
- Package wrappers named in the unit tests were missing from the published entrypoint.
  A package-root import failed for `tomlLocalDate` before `index.ts` exported the wrappers.
  Unit tests now import the built package,
  and the fuzz coverage driver reaches the exported wrapper factories.
- Package and sidecar type checks and oxlint are clean.
  The package build and unit suite,
  sidecar bounded property suite,
  TOML 1.0 and 1.1 conformance,
  and the refrozen fuzz coverage gate have passed after the runtime changes.

## Emitter campaign and removal ledger

The container run on `src/emit-document.ts` and `src/emit-value.ts` completed with
 87 killed,
 59 confirmed survivors,
 one timeout,
 147 compile errors,
 and no infrastructure errors.
The timeout is a forced-true loop condition at `emit-document.ts:40`,
 not a successful assertion.
The remaining loop-bound mutants forcing `end > 0` to true or changing `>` to `>=`
 are equivalent because an out-of-range index is `undefined` and fails the newline comparison.

Searches of `package/module/toml-edit/src` found no callers of these exports outside `emit-value.ts` itself:

- `emitArrayWithoutIndex`:
  previously described array-element omission from a parser AST.
  Live owner is `delete-value.ts`'s immutable tree update followed by
  `renderValueNode` in `emit-value-node.ts` and `assembleArrayParts` in `emit-value.ts`.
  The nested-array deletion cases in `toml-delete.unit.test.ts` and the new array-content property cover the live path.
  Retire the unused AST-only helper and its behavior.
- `emitArrayWithSkipPath`:
  previously described recursive nested-array omission,
  with no non-recursive callers.
  The same live tree-update and rendering path owns nested deletion;
  `toml-delete.unit.test.ts` covers nested deletion,
  including deeper nesting and inline-table elements.
  Retire the unused helper and its empty-path/non-array diagnostics.
- `emitInlineTableWithExtra`:
  previously described adding an entry to a parser AST inline table.
  Live owner is `set-value-inline.ts`'s immutable entry append,
  rendered by `renderValueNode` and `assembleInlineTableParts`.
  `toml-set.unit.test.ts` covers inline-table extension and conflicts.
  Retire the unused AST-only helper and its error diagnostic.

`assembleArrayParts`,
 `assembleInlineTableParts`,
 `emitContentNode`,
 and the live `emitInlineTable` path remain consumed.
Most `emit-value.ts` survivors in the former AST-only functions cannot be killed by package behavior;
 removal avoids mislabeling this dead code as weak assertions.

## In progress

- Triage actionable emitter survivors after removing the unconsumed helpers.
  The report is at `/var/home/user/temp/agent/toml-mutation-emitter.json`.
- Additional tests now pin empty and header-only canonical output,
  multiple terminal newlines,
  multiline string contents,
  empty-source splice behavior,
  and edited nonempty splice preservation.
  `emit.property.unit.test.ts` compares reparsed nested array and inline-table contents through the built `_emitContentNode` seam.
  The targeted tests passed;
  rerun full scoped verification after triaging emitter mutants.
- Never delete or stage unrelated changes under other packages;
  concurrent agents have been editing `deepmerge-ts.fuzz` and other areas.

## Next action

Remove the unconsumed AST-only emitter helpers,
 then add assertions or production fixes for surviving live behavior,
 then rerun the affected mutation files and package/sidecar verification.
Commit only explicit paths in scope.
The full runtime scan was not run:
 the initial dry run enumerated 2,675 mutants over 45 runtime files,
 so conclusions here apply only to the named campaigns.
