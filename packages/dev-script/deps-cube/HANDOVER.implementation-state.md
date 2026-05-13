# Handover: deps-cube implementation in progress

## What you are picking up

The package `packages/dev-script/deps-cube/` is being built per the approved plan at `/home/user/.claude/plans/make-a-new-workspace-serialized-puppy.md`. Read that plan first — it has the full design, the dimension mapping, the deck.gl scene composition, the UI/UX spec, the data-acquisition pipeline, the library-audit rationale (deck.gl approved at 72.7% TS as an explicit user-confirmed exception), and the verification checklist.

Tool premise: scatter-plot every catalog entry in the pnpm-workspace.yaml in 3D feature space (6 dims = 3 spatial + color + shape + size), with deck.gl WebGL rendering and a custom HTML control panel for dim swapping, 3-state boolean filtering, range sliders, name search, display toggles, and URL-hash bookmarking. Output: `./deps-cube-<YYYY-MM-DD>.html`. Stdout: exactly `Saved to <abs-path>`.

**Status (2026-05-12, fifth handover)**: tasks 1 through 10 done — package scaffolded, data layer (catalog + cache + probe pipeline), browser-side pure logic (filter mask + URL-hash state ser/deser), full deck.gl config (orbit view, scene bounds, six layer factories across five files), the Node-side HTML emitter for the control panel, the browser-side runtime controller (Deck instantiation, event wiring, picking, URL-hash sync), and the HTML composer + CLI entry point (`renderHtml` inlines a 754KB IIFE controller bundle + probes-as-JS-literal + control-panel HTML + native-CSS-nested styles into a single self-contained HTML file). Tasks 11 through 13 pending. Lint and types pass on every file (0 errors; ~338 stylistic warnings, all non-blocking).

**Last commits**:

- `a496f91c feat(dev-script/deps-cube): add browser-side scene controller` (task 9)
- `d8142cba feat(dev-script/deps-cube): add HTML control panel renderer` (task 8)
- `df8f7fb3 docs(dev-script/deps-cube): handover update — tasks 6–7 done, 8–13 pending` (second handover)
- `c2ce8e45 feat(dev-script/deps-cube): add deck.gl config + layer factories` (task 7)
- `a0609584 feat(dev-script/deps-cube): add browser-side filter + state modules` (task 6)
- `d6d1aae6 docs(dev-script/deps-cube): handover doc covering tasks 1-5 done, 6-13 pending` (first handover)
- `7c57662e feat(dev-script/deps-cube): scaffold package and probe pipeline` (tasks 1–5)

## Task tracker (matches TaskList IDs 1–13)

Done:

- ~~Task 1 (scaffold)~~ — `package.json` (bin `deps-cube` → `src/cli.ts`, deps on `@deck.gl/core`, `@deck.gl/layers`, `@cspotcode/outdent`, `@monochromatic-dev/module-es`, `find-up`, `nano-spawn`, `p-limit`, `yaml`), `mise.toml`, `tsconfig.json`, `README.md`.
- ~~Task 2 (catalog entry)~~ — `pnpm-workspace.yaml` carries `@deck.gl/core: '>=9.3.2'` and `@deck.gl/layers: '>=9.3.2'`.
- ~~Task 3 (catalog parser)~~ — `src/catalog.ts` exports `readCatalog({ startDir? })` parsing both default `catalog:` block and named `catalogs.<name>:` blocks; alias decoder exported as `decodeAlias`.
- ~~Task 4 (cache)~~ — `src/cache.ts` exports `createCache({ rootDir? })`. JSON file per (name, version) at `~/.cache/monochromatic/deps-cube/<name>/<version>.json`; per-field `{ value, fetchedAt }`; atomic tmp+rename writes.
- ~~Task 5 (probe)~~ — `src/probe.ts` (orchestrator) + `src/probe-fields.ts` (per-field probes + helpers) + `src/probe-transitive.ts` (depth-bounded dep walk). Failed entries return a stub via `failedProbe` with `unknownReason: 'private-or-404'`.
- ~~Task 6 (filter + state)~~ — `src/scripts/filter.ts` exports `computeVisibleIndices`, `extractDim`, `derivedBool`, `searchMatches`, plus the type vocabulary (`ToggleKey`, `ToggleValue`, `ToggleState`, `DataDimKey`, `ChannelKey`, `DimMapping`, `RangeState`). `src/scripts/state.ts` exports `defaultState({ probes })`, `encodeState`/`decodeState` (URL-encoded JSON, no base64), `readStateFromHash`/`writeStateToHash`, plus the `AppState`/`ViewState`/`DisplayToggleState` types. Both files are pure functions, no DOM, browser-bundle-safe.
- ~~Task 8 (HTML control panel)~~ — `src/render-controls.ts` exports `renderControls({ probes, state })` returning the full `<aside id="controls">` fragment: 6 dim `<select>` dropdowns (with channel-incompatible options rendered `disabled`), 7 three-state radio `<fieldset>`s, 6 range-slider pairs (`min`/`max` from full data extent; `value` from current state), search input with escaped value, 4 display checkboxes + `name-labels <select>`, visibility counter, reset button. Private helpers: `renderDimDropdown`, `renderToggleRow`, `renderRangeRow`, `renderDisplaySection`, `escapeAttr`, `computeChannelExtent`. Shared metadata extracted to `src/dim-meta.ts` (`DIM_DISPLAY_NAMES`, `DIM_KINDS`, `CHANNEL_ACCEPTED_KINDS`, `TOGGLE_LABELS`, `acceptsDim`); `deck-labels.ts` now imports `DIM_DISPLAY_NAMES` from there. Channel acceptance: `x`/`y`/`z`/`color` accept all kinds (renderer normalises gracefully); `shape` accepts binary+categorical; `size` accepts continuous only.
- ~~Task 9 (browser-side controller)~~ — split across four files to stay under the line cap:
  - `src/scripts/controller.ts` — entry point. Reads `window.__PROBES__`, runs `defaultState` overlaid with URL-hash state, instantiates `new Deck<OrbitView>({ views: orbitView, initialViewState, controller: true, layers, getTooltip, onClick })`, then wires `onViewStateChange` via `setProps` (deferred to avoid the `session` forward reference). Owns the `Session` type, `recomputeVisibility` / `rerenderLayers` / `syncHash` render-path helpers, and the `pickedProbe` runtime check for `info.object`. `start()` builds the session, runs `syncDomFromState`, defines a `commit` closure capturing `session` + `probes`, then calls every `wire*` function with that closure.
  - `src/scripts/controller-events.ts` — six `wire*` functions (`wireDimDropdowns`, `wireToggles`, `wireRanges`, `wireSearch`, `wireDisplay`, `wireReset`). Each registers DOM listeners that mutate `session.state` in place and call `commit()` (no args). Declares its own `Session` shape *without* the `deck` field, so the controller's full `Session` is structurally assignable with no cast. Dim swap also recomputes scene bounds and resets the channel's slider min/max/value to the new dim's extent.
  - `src/scripts/controller-dom.ts` — `el` / `elInput` / `elSelect` typed accessors using `instanceof` (no `as HTMLInputElement` casts at call sites), plus `syncDomFromState` which writes every state value back into the DOM after a reset / URL-hash overwrite.
  - `src/scripts/controller-tooltip.ts` — `formatTooltipHtml` (10-row tooltip table with HTML-escaped probe fields) + lazy-initialised `<aside id="pinned-tooltip">` with a close button, exposed as `pinTooltip` / `unpinTooltip`. Used by the deck.gl `getTooltip` hover callback (transient) and the `onClick` handler (pinned).
  - **`src/scripts/state.ts` change**: `ViewState.target` is now mutable `[number, number, number]` instead of `readonly`, because deck.gl's `OrbitViewState.target` requires mutable.
  - **Bundle smoke test**: `bun build src/scripts/controller.ts --format=iife --minify` produces a 754KB bundle (513 modules, including `@luma.gl/core` transitives). About 2× the audit estimate (~400KB); the extra comes from luma.gl + math.gl + probe.gl. Worth recording in `docs/decisions/deps-cube.md` under "implementation notes" when task 11 lands.
- ~~Task 7 (deck.gl config + layer factories)~~ — split across five files to stay under the line cap:
  - `src/deck-config.ts` — `orbitView` (OrbitView instance, `orbitAxis: 'Y'`, `fovy: 50`), `computeSceneBounds` (extent per channel from `extractDim`), `buildLayers` (assembles layer groups, filters by display toggles, returns `readonly Layer[]`). Exports `SceneBounds` type.
  - `src/deck-accessors.ts` — pure per-probe value accessors: `probePosition` (returns `[x, y, z] | null`), `probeFillColor` (red↔green linear RGB ramp + blue tint; mid-grey for unknown; alpha 13 ≈ 5% for filtered, 255 for visible), `probeRadius` (linear interp 3px↔30px), `probeIsFilled` (shape < 0.5 → filled), `unknownClusterPosition` (offset corner of bounds with per-index hash jitter).
  - `src/deck-layers.ts` — wireframe `PathLayer` (12 edges via `edge({ a, b })` helper) + threshold-plane `PolygonLayer`s at `log10(10000)` / `log10(365)` / `log10(100000)`; planes render only when the channel is mapped to its expected default dim (otherwise the heuristic value is meaningless).
  - `src/deck-scatter.ts` — `partitionProbes` helper buckets probes into `{ filled, stroked, unknown }` based on `probeIsFilled` and `unknownReason`. Three `ScatterplotLayer` factories: `buildLeafScatterLayer` (filled), `buildNonLeafScatterLayer` (stroked), `buildUnknownClusterLayer` (offset position, stroke+fill).
  - `src/deck-labels.ts` — `buildAxisLabelsLayer` (TextLayer at axis midpoints using `DIM_DISPLAY_NAMES` for the three spatial channels) + `buildNameLabelsLayer` (top-N by staleness or all visible probes, label above each glyph).

- ~~Task 10 (HTML composer + CLI)~~ — three files plus a CSS asset:
  - `src/render-html.ts` — `renderHtml({ probes })` builds the final document: calls `Bun.build({ entrypoints: ['src/scripts/controller.ts'], format: 'iife', minify: true, target: 'browser' })` to obtain the controller IIFE, inlines `window.__PROBES__ = <json>` ahead of the controller script, embeds the control-panel fragment from `renderControls`, and wraps everything in `<!doctype html>...</html>` with the CSS from `styles.css` in a `<style>` block. Helpers: `bundleController` (throws when `result.success === false`, joining `result.logs.map(log => log.message)`), `escapeForScriptTag` (replaces `</script` → `<\/script` and `<!--` → `<\!--` so the inline JS can't escape the script tag). Empty-probes smoke test: 770KB output, 513 modules, document terminates cleanly with `</html>`.
  - `src/cli.ts` — `#!/usr/bin/env bun` entry; top-level `await readCatalog()` → `createCache()` → `await probeAll({ entries, cache })` → `await renderHtml({ probes })` → `writeFile(absPath, html, 'utf8')` → `console.log(\`Saved to ${absPath}\`)`. `todaysOutputFilename()` returns `deps-cube-<YYYY-MM-DD>.html` in local time (date-only granularity so same-day re-runs overwrite). Each top-level `const` carries its own TSDoc (required at module root).
  - `src/index.ts` — re-exports the library surface (`readCatalog`, `decodeAlias`, `CatalogEntry`; `createCache`, `Cache`; `probeAll`, `PackageProbe`, `LicenseClass`, `UnknownReason`; `renderHtml`; `renderControls`). The CLI in `cli.ts` is bin-only and not re-exported.
  - `src/styles.css` — page CSS imported via `with { type: 'text' }`. Native nesting (3 levels max), logical properties (`inline-size`, `padding-inline`, `border-inline-start-*`), `rem` sizing, `:focus-visible` on every interactive element, `min-block-size: 3rem` touch targets, design-token custom properties at `:root` with `prefers-color-scheme: dark` overrides. No `border`/`padding`/`margin` shorthands — only single-axis (`padding-block`, `padding-inline`) or single-concept (`border-radius`) shorthands; sided borders use longhand `border-block-start-width` / `-style` / `-color`.
  - `src/css.d.ts` — ambient `declare module '*.css'` shim so TypeScript types the text import as `string` (mirrors the existing `svg.d.ts` shim in `inference-canary-viewer`).
  - **Layout**: HTML body is `display: flex` with `<main id="canvas-host">` (`flex-grow: 1; position: relative; min-block-size: 100vh`) and `<aside id="controls">` (`inline-size: 22rem`) side-by-side. The deck.gl canvas is supplied as `<canvas id="deck-canvas">` inside the main element; the controller passes `canvas: 'deck-canvas'` to `new Deck<OrbitView>({...})` so deck.gl uses the pre-existing canvas instead of creating its own attached to `document.body`. **Controller change**: `src/scripts/controller.ts` `createSession` now passes `canvas: 'deck-canvas'` to the `Deck` constructor (no other changes).

Pending:

- **Task 11**: `docs/decisions/deps-cube.md` — depth-matched audit per AGENTS.md. Plan file has the bullet list to expand. Key point: document the 72.7% TS exception for deck.gl with the user-screenshot evidence as the deciding factor.
- **Task 12**: `test/*.test.ts` — catalog, cache, probe (with stubbed gh/registry), filter, state, deck-config (snapshot layer count and accessor outputs), render-controls (snapshot HTML).
- **Task 13**: end-to-end smoke run — `mise run //packages/dev-script/deps-cube:run`, open the HTML in Firefox, exercise the full verification checklist from the plan.

## State on disk (verified before this handover)

```
packages/dev-script/deps-cube/
├── HANDOVER.implementation-state.md   ← this file
├── README.md
├── mise.toml
├── package.json
├── tsconfig.json
├── src/
│   ├── cache.ts                 ← JSON file cache, per-key TTL, atomic writes
│   ├── catalog.ts               ← pnpm-workspace.yaml parser + alias decode
│   ├── cli.ts                   ← #!/usr/bin/env bun; readCatalog → probeAll → renderHtml → writeFile
│   ├── css.d.ts                 ← ambient `declare module '*.css'` shim for text imports
│   ├── deck-accessors.ts        ← per-probe pure accessors (position/color/radius/shape)
│   ├── deck-config.ts           ← orbit view + computeSceneBounds + buildLayers orchestrator
│   ├── deck-labels.ts           ← axis + name label TextLayers (imports DIM_DISPLAY_NAMES)
│   ├── deck-layers.ts           ← wireframe PathLayer + threshold-plane PolygonLayers
│   ├── deck-scatter.ts          ← filled/stroked/unknown ScatterplotLayers + partition helper
│   ├── dim-meta.ts              ← shared display names, kinds, channel-acceptance, toggle labels
│   ├── index.ts                 ← library re-exports (readCatalog, createCache, probeAll, renderHtml…)
│   ├── probe.ts                 ← orchestration + PackageProbe type
│   ├── probe-fields.ts          ← per-field probes + helpers (gh + registry)
│   ├── probe-transitive.ts      ← depth-bounded dep walk
│   ├── render-controls.ts       ← Node-side HTML emitter for the control-panel <aside>
│   ├── render-html.ts           ← composes the final HTML (Bun.build bundle + probe literal + controls)
│   ├── styles.css               ← page CSS, native nesting, logical properties, design tokens
│   └── scripts/
│       ├── controller.ts        ← bootstrap, Deck instantiation, render path, pickedProbe, start()
│       ├── controller-dom.ts    ← el/elInput/elSelect typed accessors + syncDomFromState
│       ├── controller-events.ts ← wire* functions for every control surface
│       ├── controller-tooltip.ts← formatTooltipHtml + pinned-tooltip DOM management
│       ├── filter.ts            ← computeVisibleIndices + extractDim + derivedBool + searchMatches
│       └── state.ts             ← AppState, defaultState, URL-hash ser/deser
└── test/                        ← still empty; tests land in task 12
```

The split (probe.ts / probe-fields.ts / probe-transitive.ts and deck-config.ts / deck-accessors.ts / deck-layers.ts / deck-scatter.ts / deck-labels.ts) is enforced by the `eslint/max-lines: 300` rule. Keep new files under that — the rule is configured with `skipBlankLines: true, skipComments: true`, so raw line counts can exceed 300 as long as code-only lines stay under (verified `render-controls.ts` at 402 raw lines passes cleanly).

## Verification before declaring each task complete

After every code change, run all three in sequence (none can be skipped):

```sh
mise run //packages/dev-script/deps-cube:lint:types
mise run //packages/dev-script/deps-cube:lint:oxlint
mise run //packages/dev-script/deps-cube:test       # task 12 onwards
```

The first two pass cleanly now. oxlint reports ~278 stylistic warnings on the package (mostly `argument-per-line`, `tuple-per-line`, `array-element-per-line` against multi-arg helpers and tuple literals, plus `tsdoc/tag-lines` against doc blocks with adjacent `@param` lines); ignore those unless tidying for release. The blocking errors caught across sessions were:

- `eslint/prefer-template` (two pre-existing in `catalog.ts` — string concat in error messages) — fixed by switching to template literals.
- `tsdoc/check-tag-names` — TSDoc reads bare `@anthropic-ai` inside `@example` block as an unknown tag; escape with `\@`.
- `eslint/max-lines` — fix by splitting; never disable.
- `no-restricted-syntax/require-destructured-params` — function declarations with 2+ params must use destructured-object form; exempt only when the signature is dictated by external APIs (e.g. Array.prototype callbacks).
- `typescript-eslint/no-unsafe-type-assertion` — the disable comment must be on the line directly preceding the cast; if the cast spans multiple lines, extract the expression first so the cast is on a single line.

## Notable design constraints already enforced

- **No `let` at function-body root or module root**: `probeAll` uses `p-limit` instead of a counter; `unknownReason` is a named helper instead of an IIFE. Mutating-set patterns (`partitionProbes` push into three arrays) are fine — they don't trigger the rule since the lets aren't at the function root.
- **No arrow functions**: every callback is a named `function` expression. Array-prototype callbacks (`(value, index)`) are exempt from the destructured-object-param rule but still must be named functions.
- **No try-finally**: `fetchJson` uses `AbortSignal.timeout(30000)`. `decodeState` uses try-catch (allowed).
- **exactOptionalPropertyTypes**: all optional fields are `field?: T | undefined`.
- **JSON.parse / response.json() / `Object.fromEntries` casts**: surrounded by `// oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- <reason>` per AGENTS.md. The disable must be on the line directly before the cast — if `Object.fromEntries(...) as T` spans multiple lines, extract to a `const record` first.
- **deck.gl type quirks**: `PathGeometry`, `PolygonGeometry`, and `Position` are mutable in deck.gl's typings. Datum shapes must use `[number, number, number,][]` not `readonly (readonly [number, number, number,])[]`. Accessors that return positions must return mutable tuples too — `probePosition` and `unknownClusterPosition` both return mutable types.

## Notes for the next session

- **deck.gl bundling**: deck.gl is installed at `node_modules/@deck.gl/core` and `node_modules/@deck.gl/layers`. Don't try to inline the dist as raw text — `render-html.ts` calls `Bun.build({ entrypoints: ['src/scripts/controller.ts'], format: 'iife', minify: true, target: 'browser' })` so Bun resolves and bundles deck.gl transitively from the controller's imports. Output goes into a `<script>` block inside the generated HTML.
- **`Bun.build` log type**: `result.logs` is `Array<BuildMessage | ResolveMessage>`. Both classes carry a `message: string` field; use `log.message` rather than `String(log,)` (the latter triggers `typescript-eslint/no-base-to-string` because the type doesn't declare a custom `toString`).
- **`canvas: string` not `parent`**: deck.gl's `Deck` accepts either `parent?: HTMLDivElement | null` (creates its own canvas inside the supplied div) or `canvas?: HTMLCanvasElement | string | null` (uses the supplied element). The `string` form is the id of an existing `<canvas>` — simpler than typing through `HTMLDivElement`, no `as` cast needed. `controller.ts` passes `canvas: 'deck-canvas'`; `render-html.ts` emits `<canvas id="deck-canvas">` inside `<main id="canvas-host">`.
- **CSS asset via `with { type: 'text' }`**: `styles.css` is imported as a `string` from `render-html.ts`. Requires the ambient shim in `css.d.ts` (`declare module '*.css'`) so TypeScript types the import. Sibling-package precedent: `inference-canary-viewer/src/svg.d.ts` does the same for `.svg`.
- **CSS border rule**: AGENTS.md bans `border` / `padding` / `margin` shorthands (multi-axis + multi-sub-property). Single-axis (`padding-block`, `padding-inline`, `margin-inline-end`) and single-concept (`border-radius`, `inset`, `gap`) shorthands are fine; sided borders use longhand `border-block-start-width` / `-style` / `-color` (and the equivalent for `border-inline-*`). `outline` is similar — write `outline-width: 2px; outline-style: solid; outline-color: var(...); outline-offset: 2px;`.
- **Plan deviation worth recording in `docs/decisions/deps-cube.md`**: the chosen visual distinction for the "shape" channel is filled vs stroked (not circle vs diamond). Reason: ScatterplotLayer renders circles only; supporting diamonds means IconLayer with custom icon textures (more code, harder to type) or SimpleMeshLayer (3D geometry, overkill at 120 points). Filled/stroked is the simplest binary distinction that doesn't require auxiliary assets. Document under "implementation notes".
- **Display-name source**: `src/dim-meta.ts` owns `DIM_DISPLAY_NAMES`, `DIM_KINDS`, `CHANNEL_ACCEPTED_KINDS`, `TOGGLE_LABELS`, and the `acceptsDim` predicate. Both `deck-labels.ts` (axis labels) and `render-controls.ts` (dim dropdowns + toggle legends) import from here. Add new dim-meta there, not in either consumer.
- **Top-N name labels**: currently ranks by `daysSinceLastCommitOrNull` descending (oldest first). Subject to refinement once the audit-target scoring is formalised; could be a weighted score across staleness + small size + non-TS + low downloads.
- **Probes with all-zero continuous fields**: `failedProbe` returns zeroes (logSourceBytes=0, etc.). Combined with `Math.max(value, 1)` in `extractDim`, these render at `log10(1) = 0` on every spatial axis. They'll cluster at the origin if the unknown-cluster routing fails to catch them; cross-check by setting `unknownReason: 'private-or-404'` on all failed probes (already done) and ensure `partitionProbes` routes them to the unknown bucket via the `probe.unknownReason !== null` check.
- **Linguist `bytes(TypeScript) / sum(bytes)` is whole-repo**: monorepo-housed packages (`repository.directory` set) intentionally return `null` for `tsRatioOrNull` and `sourceBytesOrNull` — the viz must place these in the Unknown cluster region, not silently coerce to 0. This is already the case.
- **`oxlint-disable-next-line` placement**: must be on the line directly before the violation. If the violation spans multiple lines (e.g. a multi-line cast), extract the expression to a single-line `const` first and put the disable comment on the line directly above that. See `state.ts`'s `computeFullRanges` for the pattern.

Plan, README, this handover, and the audit doc (`docs/decisions/deps-cube.md`, task 11) are the source of truth. The README documents external behaviour; this handover documents in-progress state; the plan documents the design decisions; the audit doc will document the library trade-off.
