# Maybe and ABSENT sentinel triage handover

STATUS: IN PROGRESS (2026-05-31).
Resolving issue #214.
`aquaticat`, `terminal-title`, `import-attributes`, `terminal-exec`, `catalog-tighten` complete; 5 targets remaining.
Each package is triaged call-site by call-site into four buckets, committed independently, directly on `main`.

Resume record for the per-call-site triage of the 9 `src/maybe.ts` copies plus `packages/oxlint-plugins/tsdoc/src/sentinel.ts`.
A fresh agent should continue from here with no prior conversation context.
Background and the original framing live in issue #214 and `docs/handover/lint-sweep.md`.

## Goal

Replace each package's generic `ABSENT` / `Maybe<T>` with the correct absence shape per call site, rather than consolidating into one shared symbol.
Issue #214 establishes why a shared symbol instance is undesirable: no call site needs cross-package identity, sharing one identity already caused a regression (`module/memoize` reusing `kv-store`'s `ABSENT`), and descriptive per-purpose symbols already dominate the workspace 3:1.

## Triage rule

Classify every site that uses a package's `ABSENT` / `Maybe<T>` into one bucket.

### Bucket 1: stored field or param typed Maybe

Resolve to a `?:` optional property, populated under a guard.
A field or parameter can express absence with `?:`; the sentinel's whole justification ("function returns cannot use `?:`") does not apply.

### Bucket 2: accumulator or single-consumer return

Resolve to `reduce`, a filter, or an early return.
Absence here is a control-flow artifact (`let x = ABSENT` seeds, or a value narrowed by one `=== ABSENT` at the only call site), not a value worth representing.
No sentinel remains.

### Bucket 3: genuine multi-path function return

Keep a sentinel; a return type cannot be `?:`.
Rename the generic `ABSENT` to a descriptive per-purpose symbol.

### Bucket 4: reassignable state slot

A long-lived mutable slot reassigned between a present value and absence.
Not a function return (so not bucket 3) and not cleanly `?:` (clearing under `exactOptionalPropertyTypes` needs `delete`).
The workspace precedent (gold-blueprint `done`: `NO_TIMER`, `NO_ABORT`) keeps a descriptive sentinel here.
For #214, `doodle-widget` instead redesigns these slots to discriminated-union state; see the divergence section below.
Only `doodle-widget` has bucket-4 sites.

### Seam rule

Wherever an absent value crosses into a different function's `=== ABSENT` check, convert to `?:` / `undefined` / early-return at the seam rather than letting a renamed symbol flow into a stale check.
The codebase already does this at `packages/dev-script/deps-cube/src/probe.ts:258` (`repo = repoInfo === ABSENT ? undefined : repoInfo`).
No renamed symbol may reach a consumer that was not updated in lockstep; this preserves the "no behavior change, identity narrowing intact" acceptance criterion.

### Naming and placement

Symbol description format `Symbol('<package>/<reason>')`, export name in `UPPER_SNAKE_CASE`.
Co-locate the declaration in the file where the producing function lives (matching `packages/build-tool/css/src/package-resolver.ts`, which defines `PACKAGE_NOT_FOUND` / `PACKAGE_JSON_ABSENT` / `NO_EXPORT_MATCH` inline).
Use a local `const` when the symbol is consumed only within its file; `export` it only when another file in the same package consumes it.
Delete each `src/maybe.ts` once it is empty.

## doodle-widget divergence (deliberate)

The user chose to redesign `doodle-widget`'s reassignable state slots (`timerState.id`, `drawingState.current`, `textState.activeInput` / `layerElement`, `gestureState.longPressTimer` / `downEvent`, `eraseState.prevErasePoint`) into discriminated-union / domain-value state (for example `{ kind: 'idle' } | { kind: 'drawing', stroke }`) rather than the descriptive sentinel that bucket 4 and the gold-blueprint `done` package use (`NO_TIMER`, `NO_ABORT`).
This is an intentional choice to set a higher bar, made after the `done` precedent was surfaced.
A future reader should not "correct" these back to `NO_TIMER`-style sentinels: the divergence is the decision, not an oversight.

## Verification

Per package: `mise run //packages/<path>:lint` (oxlint + types) plus the package's own tests.
For `module`-style packages that build to `dist`, use `mise run buildAndTest` so tests import the fresh build.
`doodle-widget` (canvas) and `deps-cube` (deck.gl visualization) additionally get `agent-browser` verification of every rewritten handler path at the user boundary (drawing, eraser, text, zoom, undo/redo for `doodle-widget`; the rendered scatter and filter controls for `deps-cube`).
Bucket-3 renames are identity-preserving, so `lint:types` passing is the narrowing proof; bucket 1, 2, and 4 changes are behavioral and need the package's tests.

## Per-package triage

### aquaticat (COMPLETE)

`packages/typeface/aquaticat`.
One producer, all consumers local to `parse-svg.ts`.

- `attr(): Maybe<string>` (`parse-svg.ts`): bucket 3.
  Renamed to local `const ATTRIBUTE_ABSENT = Symbol('aquaticat/attribute-absent')`, co-located above `attr`.
  Empty string is a valid attribute value, so no falsy default works.
  Five local consumers (`transform`, `d`, `strokeAttr`, `fill`, `strokeWidthStr` checks) updated.
- `src/maybe.ts`: deleted.

Verification: `mise run //packages/typeface/aquaticat:lint` passes (0 warnings, 0 errors; types build). No tests in this package; no behavior change.

### terminal-title (COMPLETE)

`packages/pi/terminal-title`.
One absence concept ("no string field extracted") flows `stringField` to `field` to the `ToolTitleEntry.extract` callback type to the `title-builder.ts` consumer.

- `stringField`, `field`, `ToolTitleEntry.extract` (`formatter-utils.ts`): bucket 3, one shared symbol.
  Renamed to `export const NO_STRING_FIELD = Symbol('terminal-title/no-string-field')`, co-located in `formatter-utils.ts` above `ToolTitleEntry`.
  Single coherent flow with one semantic, so one shared symbol keeps producer and consumer in lockstep; no seam conversion needed.
- `title-builder.ts` consumer and `formatter-utils.unit.test.ts` import `NO_STRING_FIELD` from `formatter-utils.ts`.
- `src/maybe.ts`: deleted.

Verification: `mise run //packages/pi/terminal-title:lint` and `:test:unit` pass (0 warnings/errors; all tests PASS, exit 0).

### import-attributes (COMPLETE)

`packages/rolldown-plugins/import-attributes`.
Four genuinely distinct, non-interacting absence purposes, so "split by purpose" yields four descriptive symbols:

- `NON_STRING_NODE` (`ast-extract.ts`, exported): `getStringLiteralValue` / `getPropertyKeyName` ("AST node carries no usable string"). Narrowed in `ast-extract.ts` and as `sourceValue` in `transform.ts`.
- `NO_ATTR_TYPE` (`ast-extract.ts`, exported): `extractTypeFromAttributes` / `extractTypeFromOptions`; scan-importer's `found` accumulator and return; `attrType` checks in `transform.ts` and `index.ts`.
- `NO_QUERY_ATTR` (`patterns.ts`, exported): `extractAttrType` query decode; checked in `index.ts` (`resolveId`, `load`).
- `NO_TRANSFORM` (`transform.ts`, exported): `transformImportAttributes` return; `index.ts` converts it to `null` at the existing Rolldown `transform`-hook seam.

Triage correction: scan-importer's `let found = ABSENT` is the bucket-3 return accumulator (the `Visitor` API dictates the shape; the helper-shape allowlist permits the `let` because the function ends `return found`), not bucket 2 as the issue speculated.
`src/maybe.ts`: deleted.

Verification: `mise run //packages/rolldown-plugins/import-attributes:lint` passes (0 warnings/errors). The two unit test files (run with `bun <file>` since there is no `test:unit` task) pass, including the plugin behavioral test that transforms static/dynamic/re-export imports and ignores imports without a `with` clause (exercises the `NO_TRANSFORM` seam and the `NO_ATTR_TYPE` path).

### catalog-tighten (COMPLETE)

`packages/dev-script/catalog-tighten`.
The one bucket-1 reshape in the set, plus a propagated bucket-3 purpose.

- Bucket 1: `index.ts` `ProbedCandidate.version: Maybe<string>` became `version?: string`. The `.map` builds `{ name }` or `{ name, version }` under a guard, converting `readInstalledVersion`'s return-sentinel at the seam; `.find`/guard narrow with `!== undefined`. This removes the `.map`-widening problem the old TSDoc described, rather than working around it.
- Bucket 3 symbols: `NOT_A_RANGE` (`version-parse.ts`, `parseRange`); `NO_MANIFEST_VERSION` (`version-read.ts`, `readVersionFromPackageJson`); `NO_INSTALLED_VERSION` (`version-read.ts`, `readVersionFromBunStore`, propagated by `readInstalledVersion` in `version-resolve.ts` and consumed at the `index.ts` seam); `MALFORMED_ENTRY` (`yaml-parse.ts`, local). The `version.ts` barrel re-exports `NOT_A_RANGE` and `NO_INSTALLED_VERSION` for `index.ts`.
- Triage correction: `version-read.ts` `let bestVersion = ABSENT` is a bucket-3-return accumulator (returned by `readVersionFromBunStore`; helper-shape allowlist permits the `let`), not bucket 2 as the issue speculated.
- `version-resolve.ts` imports `NO_INSTALLED_VERSION` as `type` (used only in `typeof` for the return annotation; `typeof` works on a type-only import, confirmed by tsgo).
- `src/maybe.ts`: deleted.

Verification: `:lint` (0/0) and `:test:unit` pass. `--dry-run` against the real workspace runs cleanly; `readInstalledVersion` confirmed to resolve present packages (`oxlint` 1.67.0, `typescript` 6.0.3) and return `NO_INSTALLED_VERSION` for absent ones, so the bucket-1 reshape preserves behavior.
Pre-existing, out-of-scope observation: the dry-run reports all 118 catalog entries "Not found" because `yaml-parse.ts` `unquote` strips only double quotes while `pnpm-workspace.yaml` uses single-quoted keys; every probed name keeps literal quotes and never resolves. This predates #214 and was not changed.

### page-weight (PENDING)

`packages/dev-script/page-weight`.
`wireSize(): Promise<Maybe<number>>` is bucket 3 (`WIRE_SIZE_UNAVAILABLE`; `0` is a valid size so no falsy default).
`html.ts` `localUrlOrAbsent(raw: Maybe<string>): Maybe<string>` pipes one absence through another (a seam): convert the parameter side.
Other returns (`resolve`, `css` token reader, `collect` reader) are bucket 3.
Delete `maybe.ts`.

### terminal-exec (COMPLETE)

`packages/cli/terminal-exec`.
All bucket 3, but two granularity facts matter: one purpose can span many functions, and leaf purposes convert at their seams.

- `NO_TERMINAL` (defined in `validate.ts`, exported): the single "no usable terminal" purpose threaded through `validateEntry` to `tryEntry` to `resolveXdgTerminal` to `resolveTerminal`, and checked by `index.ts` and `launch.ts`. Five functions, one purpose, one symbol; no consumer branches differently on "entry invalid" vs "no terminal at all", so this is not under-splitting. `index.ts`/`launch.ts` import it from `validate.ts` (cycle-free; `validate.ts` imports nothing from them).
- Leaf seams, each defined in its producer and converted to `NO_TERMINAL` (or local control flow) by exactly one consumer along the existing import edge: `DESKTOP_ENTRY_UNREADABLE` (`desktop-entry.ts`, converted in `resolve.ts`'s `tryEntry`); `NO_KDE_TERMINAL` (`kde.ts`, converted in `resolve.ts`'s `resolveExplicitIds`); `INVALID_EXEC` (`tokenize.ts`, converted in `validate.ts`).
- Local-only symbols: `EXECUTABLE_NOT_ON_PATH` (two independent locals, one each in `windows.ts` and `validate.ts` `which`); `MALFORMED_DIRECTIVE` (`config.ts`); `DIR_UNREADABLE` (`scan.ts`); `KDEGLOBALS_UNREADABLE` (`kde.ts`, converted to `NO_KDE_TERMINAL` inside `kdeTerminalService`).

`src/maybe.ts`: deleted.
Leak check: each leaf symbol appears only in its producer plus its one converter file; `lint:types` confirms no symbol reaches a consumer where its type cannot occur (a leak would be a tsgo "no overlap" error).

Verification: `mise run //packages/cli/terminal-exec:lint` (0 warnings/errors) and `:test:unit` pass (exit 0).

### model-selection (PENDING)

`packages/pi-shared/model-selection`.
`core.ts` does `export * from './maybe.ts'`; 8 modules import from `./maybe.ts`, tests import `ABSENT` from `./core.ts`.
`exact-match` / `pattern-match` / `model-id` / `budget-selection` / `scope-resolver` / `settings-scope` / `argv-scope` return `Maybe<T>` (bucket 3, descriptive per resolver outcome).
Watch cross-module flow (`exactMatch` result consumed by `pattern-match`).
Update the `core.ts` re-export and all test imports. Delete `maybe.ts`.
Builds to `dist`; verify with `buildAndTest`.

### oxlint-plugins/tsdoc (PENDING)

`packages/oxlint-plugins/tsdoc/src/sentinel.ts`.
Not a `Maybe<T>` alias, a generic `ABSENT = Symbol('absent')` used across ~10 rule files (`findTsdocComment`, `parseTsdocForNode`, `parseTaggedLine`, `extractLeadingTag`, `readNamedChild`).
Distinct purposes share one symbol today.
Split per-purpose where consumed locally; where an absence flows across files keep one shared symbol for that flow or convert at the seam.
Update all importers and tests.

### deps-cube (PENDING)

`packages/dev-script/deps-cube`.
Largest; about 100 sites.
`probe.ts` params `repoInfo` / `languages` are bucket 1.
The `totalBytes` to `tsRatio` to `sourceBytes` to `unknownReason` pipeline and `parseRepository` to its consumer are seams: convert to `?:` / `undefined` (the `probe.ts:258` precedent).
Leaf parsers (`parseGithubShorthand`, `parseGithubUrl`, `pinnedOrLatest`, `extractDim`, `pickedProbe`, `validateAppState`, `decodeState`, `probePosition`) are bucket 3, descriptive.
Update the unit tests importing `ABSENT`. Delete `maybe.ts`.
Verify with tests plus `agent-browser` on the deck.gl scatter and filter controls.

### doodle-widget (PENDING)

`packages/webapp-productivity/doodle-widget`.
Heaviest.
Bucket-4 reassignable slots redesigned to discriminated-union state (see divergence section).
Genuine returns (`undo`, `redo`, `continueStroke`, `svgOverlayMeasure`) are bucket 3.
`eraser-text` / `eraser-strokes` `previousPoint: Maybe<NormalizedPoint>` param is bucket 1.
Delete `maybe.ts`.
Verify with `agent-browser`: drawing, eraser, text entry, zoom, undo/redo.
