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
  An earlier classification called it equivalent because serialization and accessors do not read that field.
  That was too broad:
  `TomlEditState.blocks` exposes the parsed entry structure,
  so a caller can distinguish the extra comment directly.
  Added `inline-entry-state.unit.test.ts` to assert the public state has no phantom comments.
  The recheck killed that mutant and reported no surviving `build-value.ts` mutants
  (one killed,
  34 compile errors,
  no infrastructure errors).
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

A repository-wide symbol and subpath search found no callers of these exports outside `emit-value.ts` itself.
`package/module/toml-edit/package.json` still exposes `./ts/*` and ships `src`,
 so these helpers were reachable through source-subpath imports despite not being root exports.
The unauthenticated public npm registry returned `E404` for this package on 2026-09-24;
 that alone does not prove that no authenticated or Git-based consumer exists.
Their removal is a deliberate source-API design change,
 not proof of backwards compatibility.

- `emitArrayWithoutIndex`:
  previously described array-element omission from a parser AST.
  Live owner is `delete-value.ts`'s immutable tree update followed by
  `renderValueNode` in `emit-value-node.ts` and `assembleArrayParts` in `emit-value.ts`.
  The nested-array deletion cases in `toml-delete.unit.test.ts` cover the live edit path.
  The array-content property separately covers re-emission,
  but the mutation runner does not include that sidecar as a killer.
  Retire the direct AST-helper contract,
  including its array-input and index behavior.
- `emitArrayWithSkipPath`:
  previously described recursive nested-array omission,
  with no non-recursive callers.
  The same live tree-update and rendering path owns nested deletion;
  `toml-delete.unit.test.ts` covers nested deletion,
  including deeper nesting and inline-table elements.
  Retire the direct AST-helper contract and its empty-path/non-array diagnostics.
- `emitInlineTableWithExtra`:
  previously described adding an entry to a parser AST inline table.
  Live owner is `set-value-inline.ts`'s immutable entry append,
  rendered by `renderValueNode` and `assembleInlineTableParts`.
  `toml-set.unit.test.ts` covers inline-table extension and conflicts.
  Retire the direct AST-helper contract and its error diagnostic.

`assembleArrayParts`,
 `assembleInlineTableParts`,
 `emitContentNode`,
 and the live `emitInlineTable` path remain consumed.
Most `emit-value.ts` survivors in the former AST-only functions cannot be killed by package behavior;
 removal avoids mislabeling this dead code as weak assertions.

## Verification and remaining limits

- Removed `emitArrayWithoutIndex`,
  `emitArrayWithSkipPath`,
  and `emitInlineTableWithExtra` from `emit-value.ts` after the coverage ledger.
  The package build,
  unit suite,
  type check,
  and oxlint passed after removal.
- Added built-artifact tests for parsed boolean values,
  inclusive array layout thresholds,
  nested multiline indentation,
  empty containers,
  quoted inline-table keys,
  exact multi-line headers,
  and trailing comments at EOF.
- The post-removal emitter recheck produced 113 killed,
  14 confirmed survivors,
  one timeout,
  and 117 compile errors.
  A further `emit-value.ts` run after adding built-artifact formatting tests produced
  41 killed,
  one confirmed survivor,
  and 57 compile errors.
  The two live dotted-key and nested-depth mutations were killed.
- A package-produced `TOMLTable` passed to the exposed `_emitContentNode` seam reaches the invalid-node diagnostic.
  A built-artifact test now checks its error class and exact message.
  The final `emit-value.ts` run reported 42 killed,
  no survivors,
  57 compile errors,
  and no infrastructure errors;
  the diagnostic mutant was killed.
- Remaining `emit-document.ts` survivors were traced to package-factory construction invariants,
  not universal equivalence for caller-composed structural states passed to `_emitDocument`:
  `build-document.ts` creates parsed key-values and tables with clean origins,
  so `emit-document.ts` returns their original source before synthetic comment rendering.
  `set-create.ts`,
  `build-input.ts`,
  and `set-aot.ts` create synthetic nodes with empty `commentsBefore` and no `commentAfter`;
  `tomlInsertCommentBefore` inserts filler blocks instead,
  and `tomlInsertCommentAfter` uses `trailingCommentAppend`.
  `set-value.ts`,
  `set-replace.ts`,
  and `delete-value.ts` preserve enclosing key-value/header origins when replacing nested values.
  `set-aot.ts` is the only synthetic table-header constructor and makes array tables,
  so the standard synthetic bracket spelling is unreachable.
  Forcing the `trailingCommentAppend` guard false passes `append: undefined`,
  which `appendTrailing` handles identically to an omitted field.
  The two surviving loop-bound changes still stop when `text[-1]` is `undefined`;
  the forced-true entire loop condition times out and is not a survivor.
- The deterministic coverage gate reported `emit-value.ts` falling from 191 to 133 covered lines
  after removing the unconsumed helper bodies.
  The baseline was refrozen with `fuzz:coverage --write` after inspecting that change;
  the surviving file now has 133 covered lines out of 218 code lines.
  The coverage gate then passed in check mode.
- Final `buildAndTest`,
  package and sidecar types and oxlint,
  sidecar bounded property tests,
  and the coverage gate passed.
  TOML 1.0 and 1.1 conformance passed after retiring the unused emitter helpers.
  A separate sidecar consumer imported `tomlFloat` from the built package and observed
  `trailingNewline: false` output `ratio = 1.0` without a final newline.
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

## Continuing runtime scan

The initial named campaigns did not exhaust the runtime source list.
A further container run is now active on read,
 error,
 and comment sources:
 `basic-escape.ts`,
 `keys.ts`,
 `errors.ts`,
 `toml-get-node.ts`,
 `toml-get-raw.ts`,
 `toml-get-comments.ts`,
 `toml-get.ts`,
 `types.ts`,
 `wrappers.ts`,
 and `comments.ts`.
Its report is `/var/home/user/temp/agent/toml-mutation-remaining-a.json` (process `proc_a45d`).
After triage,
 scan the remaining parser,
 document,
 editing,
 comment API,
 and value-encoding files not named in completed batches.
Do not claim a full-runtime verdict before those campaigns and their survivor rechecks finish.

## Remaining scope

The `emit-document.ts` recheck retains equivalent or factory-state-unreachable mutants,
 plus one forced-true-loop timeout.
`TomlEditState` is structural and `_emitDocument` is exposed as an unstable seam;
 a caller-composed state could distinguish some synthetic comment/header mutants.
The campaign does not claim universal equivalence for such inputs.
These are not counted as killed assertions.
The `emit-value.ts` final recheck has no survivors.
No full-runtime campaign was run,
 so the evidence applies only to the named files and documented branches.
The final coverage gate was run without a pipeline so its exit status was checked directly;
 it passed.
Commit only explicit paths in scope.
The full runtime scan was not run:
 the initial dry run enumerated 2,675 mutants over 45 runtime files,
 so conclusions here apply only to the named campaigns.
