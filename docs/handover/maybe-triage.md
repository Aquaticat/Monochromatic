# Maybe and ABSENT sentinel triage handover

STATUS: COMPLETE (2026-05-31).
Resolving issue #214.
`aquaticat`, `terminal-title`, `import-attributes`, `terminal-exec`, `catalog-tighten`, `page-weight`, `model-selection` (with `advisor` + `auto-mode` lockstep), `tsdoc`, `deps-cube`, `doodle-widget` complete; all 10 targets done. Run `gh issue close 214` once these commits land.
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

### page-weight (COMPLETE)

`packages/dev-script/page-weight`.
Seven distinct absence purposes; one bucket-1 field reshape; one parameter-side seam conversion.

- `WIRE_SIZE_UNAVAILABLE` (`size.ts`, exported): `wireSize` return. Bucket 3, not a falsy default because `0` is a valid wire size (empty file). Consumed in `collect.ts` (the `Promise.all(map(wireSize))` then `reduce`).
- `UNRESOLVABLE_REFERENCE` (`resolve.ts`, exported): `resolveReference` return ("not a servable path under root: external, escapes, or malformed"). Consumed at three `collect.ts` sites (`walkCss` plus both `weighPage` loops).
- `NON_LOCAL_REF` (`css.ts`, local) and `NO_MORE_TOKENS` (`css.ts`, local): `localUrlOrAbsent` return and the `nextSemanticToken` scanner's end-of-stream. Both consumed only within `css.ts`.
- `CSS_UNREADABLE` (`collect.ts`, local): `readCssOrAbsent` return on read failure; consumed only in `walkCss`.
- `html.ts` (all local):
  - `NO_ASSET_URL`: one cohesive "no candidate asset URL" flow shared by `attr` (missing/non-string/empty attribute, and every attribute this file reads is URL-bearing), `firstSrcsetUrl` (empty srcset), and `ownAssetUrl` (tag carries no own asset). One purpose across three functions, one symbol, like terminal-exec's `NO_TERMINAL`; the producers chain (`ownAssetUrl` returns `attr`/`firstSrcsetUrl` results directly), so a single identity keeps them in lockstep.
  - `NON_LOCAL_REF`: `localUrlOrAbsent` return ("candidate present but external/empty/fragment"). Distinct purpose from `css.ts`'s same-named local (two independent locals, like terminal-exec's two `EXECUTABLE_NOT_ON_PATH`).
  - `BLANK_STYLE`: `inlineStyleText` return (blank `<style>` block).
- Bucket 1: `collectMedia`'s return-object `url` field became `url?: string` (omitted when absent, the `exactOptionalPropertyTypes`-correct shape). Each producing branch converts its sentinel: `firstSrcsetUrl` result is `url === NO_ASSET_URL ? { styles } : { url, styles }`, the no-pick path returns `{ styles }`.
- Seam: `localUrlOrAbsent(raw: Maybe<string>)` became `localUrlOrAbsent(raw?: string)`. The `walk` consumer converts `ownAssetUrl`'s `NO_ASSET_URL` to `undefined` at the call (`localUrlOrAbsent(own === NO_ASSET_URL ? undefined : own)`), and `collectMedia.url` (now `?:`) passes through directly. No producer sentinel reaches `localUrlOrAbsent`'s narrowing. The `raw?: string` optional param passes lint (`no-nullish-union` targets union annotations, `no-optional-escape` targets `Partial<T>`; a declared `?:` param is neither).
- `src/maybe.ts`: deleted.

Verification: `mise run //packages/dev-script/page-weight:lint` passes (0 warnings/errors; types build). The two unit files (`html.unit.test.ts`, `url-detect.unit.test.ts`, run with `bun <file>`) pass, but they cover only `firstNonWhitespaceToken` / `startsWithUriScheme`, not the seam. The behavioral `collectMedia`/`walk` seam was proven by diffing `extractHtmlRefs` output against the `HEAD` original across 33 fixtures (media parents, srcset early-return, external/protocol-relative/data/fragment filtering, no-asset elements, nested media, blank-style omission, empty input): all 33 identical. The bucket-3 renames are identity-preserving, so `lint:types` is their proof.

### terminal-exec (COMPLETE)

`packages/cli/terminal-exec`.
All bucket 3, but two granularity facts matter: one purpose can span many functions, and leaf purposes convert at their seams.

- `NO_TERMINAL` (defined in `validate.ts`, exported): the single "no usable terminal" purpose threaded through `validateEntry` to `tryEntry` to `resolveXdgTerminal` to `resolveTerminal`, and checked by `index.ts` and `launch.ts`. Five functions, one purpose, one symbol; no consumer branches differently on "entry invalid" vs "no terminal at all", so this is not under-splitting. `index.ts`/`launch.ts` import it from `validate.ts` (cycle-free; `validate.ts` imports nothing from them).
- Leaf seams, each defined in its producer and converted to `NO_TERMINAL` (or local control flow) by exactly one consumer along the existing import edge: `DESKTOP_ENTRY_UNREADABLE` (`desktop-entry.ts`, converted in `resolve.ts`'s `tryEntry`); `NO_KDE_TERMINAL` (`kde.ts`, converted in `resolve.ts`'s `resolveExplicitIds`); `INVALID_EXEC` (`tokenize.ts`, converted in `validate.ts`).
- Local-only symbols: `EXECUTABLE_NOT_ON_PATH` (two independent locals, one each in `windows.ts` and `validate.ts` `which`); `MALFORMED_DIRECTIVE` (`config.ts`); `DIR_UNREADABLE` (`scan.ts`); `KDEGLOBALS_UNREADABLE` (`kde.ts`, converted to `NO_KDE_TERMINAL` inside `kdeTerminalService`).

`src/maybe.ts`: deleted.
Leak check: each leaf symbol appears only in its producer plus its one converter file; `lint:types` confirms no symbol reaches a consumer where its type cannot occur (a leak would be a tsgo "no overlap" error).

Verification: `mise run //packages/cli/terminal-exec:lint` (0 warnings/errors) and `:test:unit` pass (exit 0).

### model-selection (COMPLETE, three packages)

`packages/pi-shared/model-selection`.
Heavier than first sketched: deleting its `maybe.ts` forces lockstep edits in two other packages, because `ABSENT` / `Maybe` cross the package boundary as a callback contract and as incidental coupling.
This is deps-cube-tier. Blast radius is exactly three packages (verified: the only external importers of `pi/advisor` and `pi/auto-mode` are markdown docs, and neither re-exports `ABSENT` / `Maybe`).

#### Ten internal sentinels (per purpose)

- `NO_EXACT_MATCH` (`exact-match.ts`, export): `findExactModelReferenceMatch` plus internal `matchProviderModelReference` (one purpose, both functions). Cross-module seam: `pattern-match.ts`'s internal `tryMatchModel` imports it and narrows `exact !== NO_EXACT_MATCH` before returning the model, so it never leaks past that check. Also consumed by `exact-match.unit.test.ts`. Exported because the function is public (declaration emit).
- `NO_PATTERN_MATCH` (`pattern-match.ts`, local): internal `tryMatchModel` return. `parseModelPattern` itself returns `PatternResolution` (already `model?:` / `thinkingLevel?:`), so it is not a sentinel site.
- `NO_THINKING_LEVEL` (`pattern-match.ts`, local): the `for (let … thinkingLevel = ABSENT; ;)` accumulator inside `parseModelPattern`. Kept as a sentinel, not converted to `undefined`: it is a loop-`init` `let` (exempt from `no-function-root-let`) whose only `undefined`-based alternative would need a `ScopedThinkingLevel | undefined` annotation, which `no-nullish-union` bans.
- `MALFORMED_SLUG` (`model-id.ts`, export): `parseProviderModelSlug`. Cross-module seam: `budget-override.ts` narrows `parsed === MALFORMED_SLUG`. Also `model-id.unit.test.ts`. Exported (public function).
- `NO_ARGV_MODELS` (`argv-scope.ts`, export): `parseArgvModelPatterns`. Cross-module seam: `scope-resolver.ts` narrows `argvPatterns !== NO_ARGV_MODELS`. Also `argv-scope.unit.test.ts`. Exported (public function).
- `NO_LIVE_SCOPE` (`scope-resolver.ts`, local): internal `readLiveScope`.
- `NO_SETTINGS_FILE` (`settings-scope.ts`, local): internal `loadSettingsFile`. `loadSettingsScopePatterns` returns `SettingsScopePatterns` (already `patterns?:`), so it is not a sentinel site. (Named `NO_SETTINGS_FILE`, not `SETTINGS_FILE_ABSENT`, to keep every new symbol free of the `ABSENT` substring so a stray `replace_all` cannot corrupt one.)
- `NO_CANDIDATE` (`budget-selection.ts`, export): `findCheapestCandidate`, narrowed in internal `cheapestOverallContext`. Exported because `findCheapestCandidate` is public (declaration emit would otherwise reference a private symbol).

#### Two cross-package public contract symbols

A callback return type cannot be `?:` and `T | undefined` is banned, so these stay shared exported sentinels (one genuine purpose each, the cross-package analog of terminal-exec's `NO_TERMINAL`; not the generic-`ABSENT` reuse #214 bans).

- `NO_AUTH`: returned by `ResolveBudgetAuth` (`types.ts`) and `ResolveBudgetOverrideAuth` (`budget-override.ts`); checked in `budget-selection.ts` (`findSameProvider` / `findAnyProvider` auth walk) and `budget-override.ts`; **implemented by `auto-mode`'s `resolveBudgetAuth`** (`packages/pi/auto-mode/src/budget-model-auth.ts`); plus `budget-selection.unit.test.ts` / `budget-override.unit.test.ts` mock resolvers.
  Home: `types.ts`. Constraint: `ResolveBudgetAuth` references both `typeof NO_AUTH` and `BudgetModelAuth` (both in `types.ts`), so the symbol must be reachable from `types.ts` cycle-free; after `maybe.ts` is deleted `types.ts` imports nothing internal, so it is the only existing leaf. Placing it in `budget-selection` / `budget-override` would form a `types → budget → types` cycle. If a lint rule rejects a runtime `const` in `types.ts`, fall back to a one-symbol `auth-sentinel.ts` leaf that `types.ts` imports (purpose-scoped, not the banned generic module).
- `NO_OVERRIDE_MODEL`: returned by `FindBudgetOverrideModel` (`budget-override.ts`), checked in `budget-override.ts`, **implemented by `auto-mode`'s `findBudgetOverrideModel`**; plus `budget-override.unit.test.ts`. Home: `budget-override.ts` (co-located; only it references the symbol).

#### Barrels

`core.ts` `export * from './maybe.ts'` is removed. `core.ts` `export type * from './types.ts'` and `budget.ts` `export type { … } from './types.ts'` are type-only and will NOT carry the runtime `NO_AUTH`; add `export { NO_AUTH, } from './types.ts'` to `budget.ts`. `NO_OVERRIDE_MODEL` flows automatically through `budget.ts`'s `export * from './budget-override.ts'`. Tests import each sentinel directly from its producer file rather than via `core.ts`.

#### advisor decoupling (prerequisite)

`pi/advisor` imports model-selection's `ABSENT` / `Maybe` for its OWN unrelated absence purposes (`context.ts` ×8 sites across two `Maybe<AdvisorAgentMessage>` functions and a `latestExcerpt`; `context-user.ts` one `Maybe<string>`; `config.ts` a `Maybe<AdvisorConfigFile>` reader plus a `readonly Maybe<AdvisorConfigFile>[]` field). This is the incidental coupling #214 targets. Give advisor its own per-purpose local sentinels and explicit `T | typeof SENTINEL` returns; do NOT reintroduce a local `Maybe<T>` alias (that is the same coupling one layer down). `config.ts`'s `readonly Maybe<AdvisorConfigFile>[]` array field becomes `readonly (AdvisorConfigFile | typeof <sentinel>)[]`.

#### Sequencing (two commits)

1. advisor decouple. Builds green against unchanged model-selection (model-selection still exports `ABSENT` / `Maybe`, now unused by advisor).
2. model-selection triage + auto-mode contract, atomic in one commit (the `NO_AUTH` / `NO_OVERRIDE_MODEL` identity must change on both sides together). Verify all three packages with `mise run buildAndTest` (model-selection builds to `dist`; auto-mode and advisor consume it), then the dependents' own lint + tests.

#### Outcome

Executed as planned. Advisor decouple landed as commit 1 with three advisor-local symbols (`MESSAGE_EXCLUDED`, `NO_USER_PROMPT`, `NO_CONFIG_FILE`), no `Maybe` alias. model-selection triage + auto-mode contract landed as commit 2 (the lockstep). `loadSettingsFile`'s sentinel is `NO_SETTINGS_FILE`. All ten model-selection symbols and the two advisor flows behave by `lint:types` (identity narrowing is the proof for these renames; a contract-identity mismatch across the package boundary would surface as a tsgo "no overlap" error). Verification: `mise run //packages/pi-shared/model-selection:lint` (0/0) and `:buildAndTest` (all suites pass, including `resolveEffectiveScope`, budget, exact/pattern); `//packages/pi/auto-mode:lint` (0/0, types build confirms the `NO_AUTH` / `NO_OVERRIDE_MODEL` contract aligns) and `:test:unit`; `//packages/pi/advisor:lint` (0/0) and `:test:unit`.

### oxlint-plugins/tsdoc (COMPLETE)

`packages/oxlint-plugins/tsdoc/src/sentinel.ts` deleted; the generic `ABSENT = Symbol('absent')` it exported is gone.
The five producers triaged into four per-purpose symbols:

- `NO_TSDOC` (`Symbol('tsdoc/no-tsdoc')`, home `tsdoc-comments.ts`, re-exported via `tsdoc-utils.ts`): shared by `findTsdocComment` and `parseTsdocForNode`. One symbol, not two, because `parseTsdocForNode`'s absence is derived directly from `findTsdocComment`'s (the parser only runs once a comment exists); same purpose spanning two functions, per the seam rule. Consumed across `tag-types.ts`, `tsdoc-visitors.ts`, `yields.ts`, `require-example.ts`, `node-extraction.ts`.
- `NO_LEADING_TAG` (`Symbol('tsdoc/no-leading-tag')`, exported from `structural-tags.ts`): `extractLeadingTag`. Exported because the function is public and the unit test imports the symbol.
- `UNTAGGED_LINE` (`Symbol('tsdoc/untagged-line')`, exported from `empty-tags.ts`): `parseTaggedLine`. Same export rationale.
- `NO_NAMED_CHILD` (`Symbol('tsdoc/no-named-child')`, local in `node-extraction.ts`, not exported): `readNamedChild`. Local because the function is internal and its absence never crosses a file boundary; never appears in an exported type, so no declaration-emit pressure to export.

`node-extraction.ts` was the only mixed file: it both consumes `findTsdocComment` (the `NO_TSDOC` seam) and produces `readNamedChild` (the local `NO_NAMED_CHILD`).
`ABSENT` was internal-only (never re-exported from `src/index.ts`), so no public-API break.
Verified: `:lint` 0/0 (oxlint + tsgo build), `:test:unit` exit 0 (all suites including the renamed `extractLeadingTag`/`parseTaggedLine` cases).

### deps-cube (COMPLETE)

`packages/dev-script/deps-cube`.
Largest; ~100 sites across 21 files (16 source, 5 test).
`src/index.ts` is the only public surface and re-exports nothing that names a sentinel (`probeAll`, `PackageProbe`, `renderHtml`, `renderControls`, `readCatalog`, `createCache`), so deleting `maybe.ts` breaks no public API.
The package builds to `dist` with declaration emit, so every exported function whose signature names a sentinel must export that sentinel.

Do not reuse the `tsdoc` technique here.
The `tsdoc` triage was uniform bucket 3, so a per-file `replace_all 'ABSENT'` into one symbol was safe.
deps-cube is the opposite: a single file mixes bucket-1 `?:` param conversions, seam conversions to `?:`/`undefined`, and descriptive symbols on the leaf parsers only.
A blanket `replace_all 'ABSENT'` is actively wrong here; it must be per-site triage.
Re-run `lint:types` after each file (the seam check: a renamed symbol leaking into a stale `=== ABSENT` surfaces as a tsgo "no overlap" error).

Verify with `:test:unit` plus `agent-browser` on the deck.gl scatter and filter controls.

#### Symbol inventory (per-site triage)

Nine exported descriptive symbols (each referenced by an exported function's signature, so declaration-emit forces the export):

- `REPO_UNPARSEABLE` (`probe-field-parsers.ts`, re-exported via `probe-fields.ts`): `parseRepository` return. Consumed at `probe.ts:256/258` (collapsed to `undefined` at the `:258` seam) and both probe tests.
- `VERSION_UNRESOLVED` (`probe-field-parsers.ts`, re-exported via `probe-fields.ts`): `resolveVersion` return. Consumed at `probe.ts:219` (seam to the raw range string) and `probe-field-parsers.unit.test.ts`'s `pinnedOrLatest` annotation.
- `LANGUAGES_UNKNOWN` (`probe-fields.ts`): `probeLanguages` return. Consumed at `probe.ts:281` (fallback) and `:303` (seam to `undefined`).
- `LAST_COMMIT_UNKNOWN` (`probe-fields.ts`): `probeLastCommit` return. Consumed at `probe.ts:292` (fallback) and `:334` (seam to `undefined`).
- `DIM_UNKNOWN` (`scripts/filter.ts`): `extractDim` return. Widest blast radius: consumed in `scripts/filter.ts` (passesRanges), `deck-accessors.ts` (5 accessors), `deck-config.ts`, `scripts/state.ts`, `scripts/controller-range-events.ts`, `render-controls.ts`, and `filter.unit.test.ts`.
- `DERIVED_BOOL_UNKNOWN` (`scripts/filter.ts`): `derivedBool` return. Consumed by passesToggles and `filter.unit.test.ts`.
- `POSITION_UNKNOWN` (`deck-accessors.ts`): `probePosition` return. Consumed by `deck-scatter.ts:160`, `deck-scatter-helpers.ts:92`, and `deck-config.unit.test.ts`.
- `NO_THRESHOLD_LAYER` (`deck-planes.ts`): `buildThresholdLineLayer` return. One symbol shared by the toggle-off branch and the return-absent branch in `deck-config.ts:244/253` (same purpose: "no threshold layer to add").
- `STATE_INVALID` (`scripts/state.ts`): shared by `validateAppState` (local) and `decodeState` (exported) because `decodeState` propagates `validateAppState`'s absence directly (`return validateAppState(parsed)`); one purpose spanning two functions, per the seam rule. Consumed by `readStateFromHash:450` and `state.unit.test.ts`.

Five local (unexported) descriptive symbols (never appear in an exported signature):

- `parseGithubShorthand` / `parseGithubUrl` (`probe-field-parsers.ts`): two independent local symbols (siblings, not chained), each consumed only inside `parseRepository`.
- `readManifestSilent` (`probe-transitive.ts`): one local symbol, two consumers inside the same file (manifest + depPkg checks).
- `pickedProbe` (`scripts/controller.ts`): one local symbol, two consumers (`getTooltipForInfo`, `onCanvasClick`).
- `computeUnknownReason` (`probe.ts`): `NO_UNKNOWN_REASON` local, single consumer at the `:365` spread.

Bucket 1 / 2 (no sentinel):

- `computeUnknownReason` params `repoInfo` / `languages` become `?:` optionals; the call site passes the already-collapsed `repo` (`:258`) and `knownLanguages` (`:303`) via conditional spread (matching probe.ts's own `...(x === ABSENT ? {} : { x })` idiom, which is the exactOptionalPropertyTypes-correct shape).
- probe.ts locals `resolvedVersion`, `repo`, `knownLanguages`, `totalBytes`, `tsRatioOrNull`, `sourceBytesOrNull`, `daysSinceLastCommitOrNull` drop their explicit `Maybe<…>` annotations and become ternary-inferred `T | undefined` locals (the `:258` precedent), consuming the upstream sentinels and emitting `undefined`.
- The `Promise.resolve<Maybe<…>>(ABSENT)` fallbacks (`:281`, `:292`) keep an explicit type arg so both ternary branches unify: `Promise.resolve<Record<string, number> | typeof LANGUAGES_UNKNOWN>(LANGUAGES_UNKNOWN,)` and the `LAST_COMMIT_UNKNOWN` analog.
- `PackageProbe`'s `*OrNull?` fields are already `?:`; no change.

#### Outcome

Executed as planned. `src/maybe.ts` deleted; the gate `rg 'ABSENT|Maybe' src/` returns zero.
Nine exported descriptive symbols and five local ones (the four planned plus `NO_PICKED_PROBE`) landed per-site; `probe.ts`'s `computeUnknownReason` took the bucket-1 `?:` params with the conditional-spread call site (no tsgo fight, so the fallback was not needed).
TSDoc convention matched the workspace: `{@link SYMBOL}` in multiline declaration blocks (text-first `@returns` to avoid the `tsdoc(no-types)` parse), plain backticks were initially used for one-line comments but the project standard is `{@link}` with the comment expanded to multiline, so every one-line sentinel comment became a multiline block.
`probe-field-parsers.unit.test.ts` imports `VERSION_UNRESOLVED` as `type` (used only in `typeof`).
Verification: `:lint` 0/0 (oxlint type-aware + tsgo `--build`, which is the seam-leak proof) and `:test:unit` exit 0 (11 suites, including the renamed `REPO_UNPARSEABLE`/`DERIVED_BOOL_UNKNOWN`/`POSITION_UNKNOWN`/`STATE_INVALID` cases).
`agent-browser` confirmed the rendered scatter at the user boundary against a three-probe fixture render (`renderHtml`): no console/page errors, full controller bootstrap (deck.gl WebGL + hash round-trip), `extractDim`/`DIM_UNKNOWN` extents correct in the serialized state, search filter `searchMatches` (3 to 1 to 3), and `derivedBool`/`DERIVED_BOOL_UNKNOWN` exclusion (`tsMajority='no'` to 2 of 3, the unknown-`tsRatio` probe dropped).

### doodle-widget (COMPLETE)

`packages/webapp-productivity/doodle-widget`.
Heaviest target; all `ABSENT` / `Maybe` lived in `src/client/`.

Bucket 4, redesigned to discriminated unions (the deliberate divergence), one named `type` per slot, documented on the alias only (matching `messages-demo`'s union convention, member fields bare):

- `drawing.ts` `drawingState`: the former `current: Maybe<DrawingStroke>` slot and its companion `drawing: boolean` flag are **folded** into one `mode: { kind: 'idle' } | { kind: 'drawing'; stroke }`. Proven safe first: `drawing` had exactly one reader (`continueStroke`), so folding cannot change observable behavior and additionally normalizes a latent `clearStrokes` desync (it left `drawing` stale-true while clearing `current`; the union now idles both). `startStroke` keeps the same `DrawingStroke` object aliased into `strokes[]` so the points-mutation aliasing is preserved.
- `zoom-toast.ts` `timerState.current` -> `ToastTimer` (`idle` | `pending` with the handle). Dropped a dead intermediate `= idle` store that was immediately overwritten by the re-arm.
- `pointer-handlers-zoom.ts` `gestureState`: `longPressTimer` -> `LongPressTimer` and `downEvent` -> `DownEvent`, modelled as **two independent per-slot unions** (not one gesture FSM): the timer clears on move/up while `downEvent` clears on up/cancel, so "timer idle, downEvent present" is reachable and a single union would misrepresent the coupling. `longPressFired` stays a plain boolean (genuinely independent, not an absence marker).
- `pointer-handlers.ts` `eraseState.prevErasePoint` -> `PrevErasePoint` (`none` | `at` with the point). `erasing` / `erasedInGesture` stay booleans.
- `text.ts`: `activeInput` -> `ActiveInput` (`idle` | `editing` with the input). `layerElement` is **not** a union: it is set once by `setTextLayer` and never reassigned to absence (lines confirm write-once, read-only after), so it fails the bucket-4 definition and is a set-once `?:` optional property (no `delete` ever needed, no nullish-union annotation). This `?:` is not a sentinel, so it does not contradict the divergence's "do not revert to sentinels" warning.

The general rule applied: an absence-bearing slot becomes a union (or `?:` if set-once); a boolean that *redundantly* encodes that slot's presence (`drawing`) folds in; genuinely-independent booleans (`erasing`, `erasedInGesture`, `longPressFired`) stay booleans.

Bucket 3, genuine multi-path returns, descriptive exported `unique symbol`s co-located with the producer:

- `NO_SNAPSHOT` (`undo-history.ts`): shared by `undo` and `redo` (one "no state to move to" semantic). Consumed at four sites in `undo-handlers.ts`.
- `NO_SEGMENT` (`drawing.ts`): `continueStroke` return. Its former internal `current === ABSENT` check is now the union discriminant (`mode.kind !== 'drawing'`), so the slot check and the return sentinel cleanly separate. Consumed in `pointer-handlers.ts`.
- `NO_SVG_OVERLAY` (`svg-overlay-measure.ts`): `measureSvgOverlay` return. Consumed in `export.ts` and `export-svg.ts`.

Bucket 1, params -> `?:`:

- `eraseStrokesAt` / `eraseTextAt` `previousPoint: Maybe<NormalizedPoint>` -> `previousPoint?: NormalizedPoint`. Seam conversions at the `pointer-handlers.ts` call sites: the first-event call omits the property entirely; the move call spreads conditionally (`...(prev.kind === 'at' ? { previousPoint: prev.point, } : {})`), `exactOptionalPropertyTypes`-correct. The `eraser-text` derived `prev` local became a bucket-2 `undefined` ternary.

`tsgo` caveat honored: every union-slot read captures the container property to a local `const` before narrowing (`const mode = drawingState.mode; if (mode.kind !== 'drawing') ...`), since tsgo loses narrowing on mutable container properties across re-reads.

`src/maybe.ts`: deleted. Completion gate `rg -n 'ABSENT|\bMaybe\b' src/client/` returns zero.

Concurrent tsdoc-rule interaction: a parallel session made `oxlint-plugins/tsdoc`'s `multiline-blocks` rule flag every single-line `/** ... */` (383 pre-existing warnings across the package, in files unrelated to #214). Fixed with `task-oxlint --type-aware --fix` via a new package-scoped `format:oxlint` task added to `mise.toml`. Multiline tsdoc is valid under both the old and new rule, so it is safe on `main` regardless of when the rule change lands. The 27 non-#214 files touched contain only comment reformatting (verified: zero non-comment diff lines); committed separately as `style(doodle-widget)`.

Verification: `mise run //packages/webapp-productivity/doodle-widget:lint` passes (oxlint 0/0 + tsgo `--build` clean, the seam-leak proof); `build` produces the self-contained `dist/final/index.html`. `agent-browser` drove every rewritten path at the user boundary with zero console errors: draw + the `NO_SEGMENT` idle no-op; undo/redo through `NO_SNAPSHOT` including both at-start/at-end no-op branches; `eraseStrokesAt`/`eraseTextAt` `?:` seams (omit + conditional-spread) with actual stroke/text removal; text place, finalize-keep (-> readonly), discard (Escape), empty-finalize (removal); zoom click-in, long-press zoom-out (`fireLongPress` reading `downEvent`), and pan (drag -> `continuePan` -> `clearLongPress`); clear. Canvas pointer capture intercepts coordinate clicks, so gestures were synthesized via `dispatchEvent`; the long-press timer was driven by holding across its 500 ms timeout.
