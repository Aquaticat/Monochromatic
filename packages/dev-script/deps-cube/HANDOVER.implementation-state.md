# Handover: deps-cube implementation in progress

## What you are picking up

The package `packages/dev-script/deps-cube/` is being built per the approved plan at `/home/user/.claude/plans/make-a-new-workspace-serialized-puppy.md`. Read that plan first — it has the full design, the dimension mapping, the deck.gl scene composition, the UI/UX spec, the data-acquisition pipeline, the library-audit rationale (deck.gl approved at 72.7% TS as an explicit user-confirmed exception), and the verification checklist.

Tool premise: scatter-plot every catalog entry in the pnpm-workspace.yaml in 3D feature space (6 dims = 3 spatial + color + shape + size), with deck.gl WebGL rendering and a custom HTML control panel for dim swapping, 3-state boolean filtering, range sliders, name search, display toggles, and URL-hash bookmarking. Output: `./deps-cube-<YYYY-MM-DD>.html`. Stdout: exactly `Saved to <abs-path>`.

**Status (2026-05-12)**: tasks 1 through 5 done — package scaffolded and data layer (catalog parser, JSON file cache, registry+gh probe pipeline split across probe.ts/probe-fields.ts/probe-transitive.ts to stay under the 300 max-lines cap). Tasks 6 through 13 pending. Lint and types pass on the data layer (0 errors, 64 warnings — warnings are missing @example tags on internal helpers and stylistic per-line nits, all non-blocking).

**Last commit**: `7c57662e feat(dev-script/deps-cube): scaffold package and probe pipeline`. The pnpm catalog now carries `@deck.gl/core` and `@deck.gl/layers` at `>=9.3.2`; `pnpm install` has already been run outside the sandbox.

## Task tracker (matches TaskList IDs 1–13)

Done:

- ~~Task 1 (scaffold)~~: `package.json` (bin `deps-cube` → `src/cli.ts`, private, deps on `@deck.gl/core`, `@deck.gl/layers`, `@cspotcode/outdent`, `@monochromatic-dev/module-es`, `find-up`, `nano-spawn`, `p-limit`, `yaml`; devDeps on `@monochromatic-dev/config-typescript`, `@monochromatic-dev/module-test`, `@types/bun`); `mise.toml` (`[tasks.run]` → `bun src/cli.ts`, `[tasks.test]` → `bun test`, plus `extends = "lint"`/`"lint:types"`/`"lint:oxlint"`); `tsconfig.json` extends `@monochromatic-dev/config-typescript/dom`; `README.md` documents the chosen viz, control panel, dims, cache location, manual verification checklist.
- ~~Task 2 (catalog entry)~~: `pnpm-workspace.yaml` gains `@deck.gl/core: '>=9.3.2'` and `@deck.gl/layers: '>=9.3.2'` between `@csstools/css-tokenizer` and `@lezer/common`.
- ~~Task 3 (catalog parser)~~: `src/catalog.ts` exports `readCatalog({ startDir? })` → `readonly CatalogEntry[]`. Finds `pnpm-workspace.yaml` via `find-up`, parses with `yaml`, extracts from both default `catalog:` block and any named `catalogs.<name>:` blocks. Aliased entries (`npm:<name>@<range>`) decoded into `{ npmName, range }`; alias decoder exported separately for tests as `decodeAlias({ key, value })`.
- ~~Task 4 (cache)~~: `src/cache.ts` exports `createCache({ rootDir? })` → `Cache`. JSON file per (npm name, version) at `~/.cache/monochromatic/deps-cube/<name>/<version>.json` (honors `$XDG_CACHE_HOME`); each file holds a record of `{ [field]: { value, fetchedAt } }` so multiple fields can coexist with different TTLs. Atomic writes (tmp + rename). Reads return `undefined` on missing-or-expired-or-corrupt. `ttlMs: null` means never expire.
- ~~Task 5 (probe)~~: split into three files to stay under 300 LOC each:
  - `src/probe.ts` — orchestration: `probeAll({ entries, cache })` runs `probeOne` for every entry through a `pLimit(8)` semaphore, surfaces per-entry failures as a stub `PackageProbe` via `failedProbe`. Exports `PackageProbe`, `LicenseClass`, `UnknownReason`.
  - `src/probe-fields.ts` — helpers + per-field probes: `parseRepository` (handles `{type, url, directory}` objects, plain strings, `github:owner/repo`, `git+https://...`, `git@github.com:...`), `resolveVersion`, `classifyLicense` ({permissive, copyleft, non-oss, unknown}), `fetchJson` (uses `AbortSignal.timeout(30s)` — no try-finally; AGENTS.md bans it), `ghApi` (shells `gh api <path>` via `nano-spawn`), and `probePackageManifest` / `probeDownloads` / `probeLanguages` / `probeLastCommit` (with `?path={directory}` for monorepo-housed entries). Exports `NpmPackage`, `NpmVersion`, `RepositoryInfo`, `LicenseClass`.
  - `src/probe-transitive.ts` — `probeTransitive` walks `dependencies` recursively with `visited` set, depth-capped at 5; caches per-(name, version) with 30-day TTL. Split out so `probe-fields.ts` stays under the max-lines cap.

Pending:

- **Task 6**: `src/scripts/filter.ts` (pure filter mask given probes + 3-state toggles + range sliders + search → visible-index set) + `src/scripts/state.ts` (URL-hash serialize/deserialize for camera viewState + dim mapping + filter state + toggle state). These live under `src/scripts/` because they're bundled into the output HTML's runtime `<script>` block, not the CLI build.
- **Task 7**: `src/deck-config.ts` builds the deck.gl config: `OrbitView`, default `viewState`, layer factory functions (3D box wireframe `PolygonLayer`, three semi-transparent threshold-plane `PolygonLayer`s at log(10_000) / log(365 days) / log(100_000), `ScatterplotLayer` for leaf circles, `ScatterplotLayer` or `IconLayer` for non-leaf diamonds, `ScatterplotLayer` for the offset Unknown cluster, `TextLayer` for axis labels and top-N risk names).
- **Task 8**: `src/render-controls.ts` emits the HTML control panel: 6 dim dropdowns (channel × candidate-data-dim, type-filtered), 7 three-state toggle rows (Leaf, TS-majority, Large, Recent, Permissive, Copyleft, Has-known-GH-repo), 6 range sliders, name search input, display-toggle checkboxes (threshold planes, wireframe, name labels, unknown cluster), visibility counter, reset button. Pure DOM markup, no UI library, sidebar layout.
- **Task 9**: `src/scripts/controller.ts` is the runtime glue inside the output HTML: instantiates `new Deck({...})`, wires dim-swap (`deck.setProps({ layers: rebuild(...) })`), filter (per-glyph opacity 5% via accessor returning rgba with low alpha), search (same), license chip handler, toggle handlers, click-pin tooltip, bookmark serialize/deserialize via `scripts/state.ts`.
- **Task 10**: `src/render-html.ts` composes the final HTML with inlined deck.gl bundle (`import deckText from '@deck.gl/core/dist/index.min.js' with { type: 'text' }` — need to verify the exact dist path), data + initial state as JS literals, the control panel HTML, the controller script, and minimal CSS. `src/cli.ts` is the bun-shebang entry: `readCatalog()` → `probeAll()` → `renderHtml()` → write `./deps-cube-{YYYY-MM-DD}.html` → `console.log('Saved to ' + abspath)`. `src/index.ts` re-exports.
- **Task 11**: `docs/decisions/deps-cube.md` — depth-matched library audit per AGENTS.md. Plan file has the bullet list to expand. Key point: document the 72.7% TS exception for deck.gl with user-screenshot evidence.
- **Task 12**: `test/*.test.ts` — catalog (yaml fixture + alias decode), cache (TTL + atomic write + corrupt-file handling), probe (sinon-stubbed gh + registry + downloads, asserting each of the 7 dims for healthy-GH / monorepo-housed / non-GH / 404 fixtures), deck-config (snapshot layer config + accessor outputs), filter (each toggle × slider × search combination), state (URL-hash roundtrip), render-controls (snapshot control-panel HTML), render-html (composed HTML has no external resource refs).
- **Task 13**: end-to-end smoke run — actually run `mise run //packages/dev-script/deps-cube:run`, open the HTML in Firefox, exercise rotation/dim picker/filters/search/bookmark/tooltip, verify audit-target octant identifies known-bad pkgs from `.pnpmfile.mjs` rationale.

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
│   ├── probe.ts                 ← orchestration (probeAll, probeOne) + PackageProbe type
│   ├── probe-fields.ts          ← parseRepository, resolveVersion, classifyLicense, fetchJson, ghApi, probe{PackageManifest,Downloads,Languages,LastCommit}
│   ├── probe-transitive.ts      ← probeTransitive (split out for line cap)
│   └── scripts/                 ← empty; runtime JS bundles go here in tasks 6/9
└── test/                        ← empty; tests land in task 12
```

The split (probe.ts / probe-fields.ts / probe-transitive.ts) is enforced by the `eslint/max-lines: 300` rule in `packages/config/oxlint/src/rules/style.ts`. Keep new files under that.

## Verification before declaring each task complete

After every code change, run all three in sequence (none can be skipped):

```sh
mise run //packages/dev-script/deps-cube:lint:types
mise run //packages/dev-script/deps-cube:lint:oxlint
mise run //packages/dev-script/deps-cube:test       # task 12 onwards
```

The first two pass cleanly now. The oxlint output reports ~64 stylistic warnings; ignore those unless you are tidying for release (the warnings are mostly `argument-per-line`/`param-per-line` on callbacks and `tsdoc/require-example` on internal helpers). Errors must stay at 0.

Outside the sandbox, `pnpm install` works directly; the sandbox blocks it. Run installs from a normal terminal (or via Bash's `dangerouslyDisableSandbox`).

`pnpm-lock.yaml` already includes `@deck.gl/core@9.3.2` and `@deck.gl/layers@9.3.2`.

## Notable design constraints already enforced

- **No `let` at function-body root or module root**: `probeAll` uses a `p-limit` semaphore + `Promise.all` instead of a shared-counter worker pool. `unknownReason` is computed by an extracted helper `computeUnknownReason` instead of an IIFE.
- **No arrow functions**: every callback is a named `function` expression (e.g. `function buildTask`, `function recurseOne`, `function sumBytes`). The `addBlockedBy` rule in AGENTS.md exempts external-API callbacks from the destructured-object-param rule but **not** from the param-per-line stylistic rule (which is a warning, not an error).
- **No try-finally**: `fetchJson` uses `AbortSignal.timeout(30000)` instead of `new AbortController` + `setTimeout` + try-finally cleanup. If you need finite cleanup elsewhere, use `await using` with `Symbol.asyncDispose`.
- **exactOptionalPropertyTypes**: all optional fields are typed as `field?: T | undefined` (never bare `field?: T`); otherwise tsgo rejects `undefined` assignments at exactly-optional sites.
- **JSON.parse / response.json() casts**: surrounded by `// oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- <reason>` per AGENTS.md's "Add `oxlint-disable-next-line` comments with justification" rule.

## Notes for the next session

- The deck.gl import for the bundled output (task 10) is the unknown spot. Verify the exact dist path under `node_modules/@deck.gl/core/dist/` and `node_modules/@deck.gl/layers/dist/` — the package may ship multiple entries (`dist.min.js`, `dist/dist.min.js`, etc.). Use `find ... | head` to scope, then `import { default as ... } with { type: 'text' }` for inlining into the HTML. If the dist isn't suitable, Bun can bundle on demand at HTML-generation time via `Bun.build` with the bundled deck.gl as the entry.
- Probe transitive walks may be slow first-run (registry calls fan out). The current depth cap is 5 with a visited set; if the first run is too slow, drop the cap to 3 and note the reduced accuracy in the README.
- Linguist `bytes(TypeScript) / sum(bytes)` is whole-repo; for monorepo-housed packages (`repository.directory` set), the code intentionally returns `null` for both `tsRatioOrNull` and `sourceBytesOrNull` and sets `unknownReason: 'monorepo'`. The viz must place these in the explicit Unknown cluster region — do not silently coerce to 0.
- The `probeAll` failure-mode (`failedProbe` stub) populates `unknownReason: 'private-or-404'` and zeroes the continuous fields. The chart should render these with a distinct marker (e.g. dashed outline) so audit-time the failure surfaces visually rather than silently distorting the cluster.
- `oxlint-disable-next-line` blocks must wrap tightly per AGENTS.md (disable on the line directly before the violation, then re-enable on the line directly after the closing `}` if a block scope was needed). The current file uses only `disable-next-line` form; no block disables yet.

Plan, README, this handover, and the audit doc (`docs/decisions/deps-cube.md`, task 11) are the source of truth. The README documents external behaviour; this handover documents in-progress state; the plan documents the design decisions; the audit doc will document the library trade-off.
