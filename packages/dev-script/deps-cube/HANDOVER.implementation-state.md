# Handover: deps-cube implementation in progress

## What you are picking up

The package `packages/dev-script/deps-cube/` is being built per the approved plan at `/home/user/.claude/plans/make-a-new-workspace-serialized-puppy.md`. Read that plan first — it has the full design, the dimension mapping, the deck.gl scene composition, the UI/UX spec, the data-acquisition pipeline, the library-audit rationale (deck.gl approved at 72.7% TS as an explicit user-confirmed exception), and the verification checklist.

Tool premise: scatter-plot every catalog entry in the pnpm-workspace.yaml in 3D feature space (6 dims = 3 spatial + color + shape + size), with deck.gl WebGL rendering and a custom HTML control panel for dim swapping, 3-state boolean filtering, range sliders, name search, display toggles, and URL-hash bookmarking. Output: `./deps-cube-<YYYY-MM-DD>.html`. Stdout: exactly `Saved to <abs-path>`.

**Status (2026-05-12, second handover)**: tasks 1 through 7 done — package scaffolded, data layer (catalog + cache + probe pipeline), browser-side pure logic (filter mask + URL-hash state ser/deser), and the full deck.gl config (orbit view, scene bounds, all six layer factories split across five files to stay under the 300-line cap). Tasks 8 through 13 pending. Lint and types pass on every file in the package (0 errors; warnings exist but are non-blocking stylistic nits like missing `@example` tags on internal helpers).

**Last commits**:

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
- ~~Task 7 (deck.gl config + layer factories)~~ — split across five files to stay under the line cap:
  - `src/deck-config.ts` — `orbitView` (OrbitView instance, `orbitAxis: 'Y'`, `fovy: 50`), `computeSceneBounds` (extent per channel from `extractDim`), `buildLayers` (assembles layer groups, filters by display toggles, returns `readonly Layer[]`). Exports `SceneBounds` type.
  - `src/deck-accessors.ts` — pure per-probe value accessors: `probePosition` (returns `[x, y, z] | null`), `probeFillColor` (red↔green linear RGB ramp + blue tint; mid-grey for unknown; alpha 13 ≈ 5% for filtered, 255 for visible), `probeRadius` (linear interp 3px↔30px), `probeIsFilled` (shape < 0.5 → filled), `unknownClusterPosition` (offset corner of bounds with per-index hash jitter).
  - `src/deck-layers.ts` — wireframe `PathLayer` (12 edges via `edge({ a, b })` helper) + threshold-plane `PolygonLayer`s at `log10(10000)` / `log10(365)` / `log10(100000)`; planes render only when the channel is mapped to its expected default dim (otherwise the heuristic value is meaningless).
  - `src/deck-scatter.ts` — `partitionProbes` helper buckets probes into `{ filled, stroked, unknown }` based on `probeIsFilled` and `unknownReason`. Three `ScatterplotLayer` factories: `buildLeafScatterLayer` (filled), `buildNonLeafScatterLayer` (stroked), `buildUnknownClusterLayer` (offset position, stroke+fill).
  - `src/deck-labels.ts` — `buildAxisLabelsLayer` (TextLayer at axis midpoints using `DIM_DISPLAY_NAMES` for the three spatial channels) + `buildNameLabelsLayer` (top-N by staleness or all visible probes, label above each glyph).

Pending:

- **Task 8**: `src/render-controls.ts` — Node-side HTML-string emitter for the control panel. Inputs: `{ probes, state }`. Output: an HTML fragment string ready to be embedded in the output HTML by `render-html.ts`. Markup:
  - 6 `<select>` dropdowns for dim mapping (ids `dim-x` … `dim-size`); options filtered by channel-accepted type (shape: binary only; size: continuous only; x/y/z/color: any).
  - 7 three-state toggle rows (radios with names `toggle-isLeaf`, …, `toggle-hasKnownRepo`; values `any`/`yes`/`no`).
  - 6 range slider pairs (`range-x-min`, `range-x-max`, …) initialised to the current `state.ranges[channel]`.
  - Search `<input type="text" id="search">`.
  - Display toggles: `<input type="checkbox" id="display-wireframe">`, `display-planes`, `display-axis-labels`, `display-unknown`; plus `<select id="name-labels">` with options `none`/`topN`/`all`.
  - `<span id="visibility-counter">N of M visible</span>`.
  - `<button id="reset">Reset filters</button>`.
  - No JS in this file — that's the controller's job. Plan helpers: `renderDimDropdown`, `renderToggleRow`, `renderRangeRow`, `renderDisplaySection`. Include `DIM_DISPLAY_NAMES` + `TOGGLE_LABELS` + per-channel accepted-type allowlist (constants — possibly worth a shared `dim-meta.ts` if duplicated with `deck-labels.ts`'s `DIM_DISPLAY_NAMES`).
- **Task 9**: `src/scripts/controller.ts` — browser-side runtime entry. Lifecycle:
  1. Read embedded `__PROBES__` global (data literal injected by `render-html.ts`).
  2. Compute initial state via `defaultState({ probes })`, then overlay any URL-hash state via `readStateFromHash`.
  3. Instantiate `new Deck({ views: [orbitView], initialViewState, controller: true, layers: buildLayers(...) , onViewStateChange })`.
  4. Wire every control: dim dropdowns → swap `state.dimMapping`, re-compute bounds, re-call `buildLayers`. Toggles/sliders/search → re-compute `visibleIndices` only (no bounds recompute needed). Display checkboxes → re-call `buildLayers`. Reset button → reset state to `defaultState`.
  5. After every state change, re-encode to URL hash via `writeStateToHash`.
  6. Visibility counter updates on every filter change.
  7. Pickable click handler for pinned tooltip; hover handler via `getTooltip`.
- **Task 10**: `src/render-html.ts` (Node) composes the final HTML — inlines deck.gl bundle (`Bun.build` with `controller.ts` as entry, IIFE format), the data literal (`window.__PROBES__ = …`), the control-panel HTML from `render-controls`, minimal CSS (canvas main area + sidebar; native nesting; logical properties). `src/cli.ts` is the `#!/usr/bin/env bun` entry: top-level `await readCatalog()` → `await probeAll()` → write file → `console.log('Saved to ' + absPath)`. `src/index.ts` re-exports.
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
│   ├── deck-accessors.ts        ← per-probe pure accessors (position/color/radius/shape)
│   ├── deck-config.ts           ← orbit view + computeSceneBounds + buildLayers orchestrator
│   ├── deck-labels.ts           ← axis + name label TextLayers
│   ├── deck-layers.ts           ← wireframe PathLayer + threshold-plane PolygonLayers
│   ├── deck-scatter.ts          ← filled/stroked/unknown ScatterplotLayers + partition helper
│   ├── probe.ts                 ← orchestration + PackageProbe type
│   ├── probe-fields.ts          ← per-field probes + helpers (gh + registry)
│   ├── probe-transitive.ts      ← depth-bounded dep walk
│   └── scripts/
│       ├── filter.ts            ← computeVisibleIndices + extractDim + derivedBool + searchMatches
│       └── state.ts             ← AppState, defaultState, URL-hash ser/deser
└── test/                        ← still empty; tests land in task 12
```

The split (probe.ts / probe-fields.ts / probe-transitive.ts and deck-config.ts / deck-accessors.ts / deck-layers.ts / deck-scatter.ts / deck-labels.ts) is enforced by the `eslint/max-lines: 300` rule. Keep new files under that — the rule counts code lines (skipping blanks and TSDoc comments).

## Verification before declaring each task complete

After every code change, run all three in sequence (none can be skipped):

```sh
mise run //packages/dev-script/deps-cube:lint:types
mise run //packages/dev-script/deps-cube:lint:oxlint
mise run //packages/dev-script/deps-cube:test       # task 12 onwards
```

The first two pass cleanly now. oxlint reports ~258 stylistic warnings on the package; ignore those unless tidying for release. The blocking errors caught in this session were:

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

- **deck.gl bundling for task 10**: deck.gl is installed at `node_modules/@deck.gl/core` and `node_modules/@deck.gl/layers`. Don't try to inline the dist as raw text — use `Bun.build({ entrypoints: ['src/scripts/controller.ts'], format: 'iife', minify: true })` so Bun resolves and bundles deck.gl transitively from the controller's imports. Output goes into a `<script>` block inside the generated HTML.
- **Plan deviation worth recording in `docs/decisions/deps-cube.md`**: the chosen visual distinction for the "shape" channel is filled vs stroked (not circle vs diamond). Reason: ScatterplotLayer renders circles only; supporting diamonds means IconLayer with custom icon textures (more code, harder to type) or SimpleMeshLayer (3D geometry, overkill at 120 points). Filled/stroked is the simplest binary distinction that doesn't require auxiliary assets. Document under "implementation notes".
- **Display-name duplication**: `deck-labels.ts` has a `DIM_DISPLAY_NAMES` table and `render-controls.ts` (task 8) will need the same. If the duplication is unwelcome, extract to `src/dim-meta.ts` and import from both — but only do this in task 8, not retroactively.
- **Top-N name labels**: currently ranks by `daysSinceLastCommitOrNull` descending (oldest first). Subject to refinement once the audit-target scoring is formalised; could be a weighted score across staleness + small size + non-TS + low downloads.
- **Probes with all-zero continuous fields**: `failedProbe` returns zeroes (logSourceBytes=0, etc.). Combined with `Math.max(value, 1)` in `extractDim`, these render at `log10(1) = 0` on every spatial axis. They'll cluster at the origin if the unknown-cluster routing fails to catch them; cross-check by setting `unknownReason: 'private-or-404'` on all failed probes (already done) and ensure `partitionProbes` routes them to the unknown bucket via the `probe.unknownReason !== null` check.
- **Linguist `bytes(TypeScript) / sum(bytes)` is whole-repo**: monorepo-housed packages (`repository.directory` set) intentionally return `null` for `tsRatioOrNull` and `sourceBytesOrNull` — the viz must place these in the Unknown cluster region, not silently coerce to 0. This is already the case.
- **`oxlint-disable-next-line` placement**: must be on the line directly before the violation. If the violation spans multiple lines (e.g. a multi-line cast), extract the expression to a single-line `const` first and put the disable comment on the line directly above that. See `state.ts`'s `computeFullRanges` for the pattern.

Plan, README, this handover, and the audit doc (`docs/decisions/deps-cube.md`, task 11) are the source of truth. The README documents external behaviour; this handover documents in-progress state; the plan documents the design decisions; the audit doc will document the library trade-off.
