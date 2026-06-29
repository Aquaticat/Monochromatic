# catalog-tighten repair and portability decision log

Living record of the work to fix `catalog-tighten` (GitHub issues #258 and #195)
and make it portable across package managers,
updated across sessions as decisions crystallise.
Tracks what we settled,
why,
what stays open,
and the planned shape of the deliverable.

## Status

Grilling and investigation in progress.
Resolver direction, the #195 hardening shape, phasing, and the test-isolation policy are settled.
Container mechanism (reuse `module-matrix` vs bespoke Containerfile) and the fixture/commit plan are still open.
No code has been written in the main worktree yet;
all measurement happened in a throwaway git worktree.

## The two issues

- #258: `catalog-tighten --dry-run` resolves nothing.
  The issue's investigation notes blame single-quote parsing only.
- #195: prototype-pollution hardening of the catalog parser
  (crafted `__proto__:` keys could mutate the result map).

## Diagnosis (broader than the issues stated)

#258 is three defects, not one:

1.  Parse (`packages/dev-script/catalog-tighten/src/yaml-parse.ts`):
    `unquote()` strips only double quotes,
    but `pnpm-workspace.yaml` now uses single quotes (`'oxlint': '>=1.71.0'`),
    so keys and values keep literal quotes and every lookup fails.
2.  Resolve (`packages/dev-script/catalog-tighten/src/version-resolve.ts`,
    `packages/dev-script/catalog-tighten/src/version-read.ts`):
    even after the quote fix, 122 of 134 entries still miss.
    They are sub-package deps not hoisted to root `node_modules`,
    and `require.resolve('<pkg>/package.json')` throws `ERR_PACKAGE_PATH_NOT_EXPORTED`
    for packages whose `exports` map does not expose `./package.json`.
    The store-scan fallback exists for this case
    but scans `node_modules/.bun/` (Bun), which does not exist in this pnpm repo (`.pnpm/`).
3.  Write-back (`packages/dev-script/catalog-tighten/src/index.ts`):
    the rewrite only matches `"name": "range"` (double quotes),
    so on the single-quoted file the real (non-dry-run) command silently writes nothing.
    Invisible to the issue's acceptance criteria, which only test `--dry-run`.

## Measurements (throwaway worktree, real `.pnpm` store)

- Single-quote fix alone: 8 tighten, 4 already tight, 122 not found.
- Plus direct symlink read across workspace roots
  (read `<wsRoot>/node_modules/<name>/package.json`, bypassing exports): 38 tighten, 61 already tight, 35 not found.
- The remaining 35 are consumed only by `packages-paused/**` packages (not installed, no active symlink)
  or are transitive-only.
  Neither should be tightened: there is no active installed version to tighten a floor against.

## Locked decisions

1.  Scope: full end-to-end repair of all three #258 defects plus #195.
    The tool must actually tighten, not just pass `--dry-run`.
2.  Resolution source: actual on-disk install state, never the lockfile.
    Rationale: a lockfile persists after `node_modules` is deleted,
    so it reports versions that are not installed.
    - nm-linker layouts (pnpm isolated/hoisted, and other managers' node-modules linkers):
      read `node_modules/<name>/package.json`, walking up from each importer to the root,
      bypassing exports-gated `require.resolve`.
    - no-`node_modules` layouts (pnpm `nodeLinker: pnp`):
      read the manager's real install artifact via the PnP API (`.pnp.cjs`), still on-disk state.
    - `node_modules` absent entirely: MISS-and-skip with a loud warning.
3.  Drop the version-store scan entirely
    (`readVersionFromBunStore` and the `.bun`/`.pnpm` directory scan).
    It is package-manager-specific and hazardous:
    `docs/troubleshooting/pnpm-modules-cache.md` shows `.pnpm` retains stale higher-version orphans,
    so scan-and-pick-highest could tighten a floor above the active version and break installs.
4.  #258 fixes:
    - Parse: `unquote()` strips a matching single or double quote pair.
    - Resolve: redesign per decision 2.
    - Write-back: replace only the version token within the matched entry's line,
      preserving the existing quote characters and spacing (minimal diff).
5.  #195 hardening:
    - Name validation: string-scan predicate, no regex
      (repo rule RG1, and this parser was deliberately rewritten from regex to string scans).
      Check non-empty, first char `@` or `[a-z0-9]`, chars in the npm-name set, at most one `/`.
    - Container: `Object.create(null)` plus `Object.hasOwn`.
    - Rejection: log a warning and skip the entry, preserving the rest of the catalog.
6.  README rewrite:
    `packages/dev-script/catalog-tighten/README.md` currently misdescribes the source
    as the root `package.json` `workspaces.catalog`;
    the code reads `pnpm-workspace.yaml` `catalog:`.

## Phasing

- pnpm first: one PR closes #258 and #195, including a PnP-API reader (pnp is in the matrix).
- Pause after pnpm.
  For Bun, Yarn Berry, Deno, and vlt, open one self-contained GitHub issue per manager
  carrying the source-format and layout findings below as its spec, instead of implementing.

## Catalog support across managers (mid-2026, source-verified)

Reference protocol `catalog:` / `catalog:<name>` is uniform; the install layout is not.

- pnpm (9.5+, GA): source `pnpm-workspace.yaml` `catalog:`/`catalogs:`.
  Default linker is the symlinked isolated store; also `hoisted` and `pnp`.
- Bun (1.2.14+, May 2025): source `package.json` `workspaces.catalog`/`catalogs` (or top level).
  Default hoisted (real dirs); opt-in isolated (`node_modules/.bun`).
- Yarn Berry (4.10+, Sept 2025): source `.yarnrc.yml` `catalog:`/`catalogs:`.
  Default PnP has no `node_modules` (`.pnp.cjs`, `.yarn/cache` zips);
  switchable to `nodeLinker: node-modules` or `pnpm`.
- Deno (2.8+, May 2026): source `deno.json` or `package.json`, npm-only entries.
  `.deno` store in auto mode; `nodeModulesDir: none` has no `node_modules`.
- vlt (young, pre-1.0): source `vlt.json` `catalog`/`catalogs`.
  `node_modules/.vlt/` symlink store.
- npm: no catalogs (RFC #528 open and unmerged since 2022).
- Yarn Classic v1: no catalogs.

The layouts that break any `node_modules`-reading strategy: Yarn Berry PnP and Deno `none`.

## E2e test infrastructure

- Placement: inside `packages/dev-script/catalog-tighten/`, mirroring
  `packages/module/matrix` and `packages/dev-script/mutation-test` conventions.
- Test isolation policy: containerise the install-based resolution tests only
  (the host's own install would contaminate a hoisted or stale-orphan fixture).
  Pure-function tests (parser, name-validator, write-back) stay as fast host unit tests
  via `@monochromatic-dev/module-test`.
- pnpm matrix axes (selected): `nodeLinker` isolated, hoisted, and pnp; `hoist` true and false.
- Required correctness scenario: seed a higher-version stale orphan into `node_modules/.pnpm`
  (simulating a post-downgrade leftover, per `docs/troubleshooting/pnpm-modules-cache.md`)
  and assert the resolver tightens to the active lower version, never the orphan.
- `packageImportMethod` is not an axis: it changes how files are placed, not the structure read.

## Open items

- Container mechanism: reuse `@monochromatic-dev/module-matrix`
  (its axes are os/user/runtime, would need a package-manager-settings axis)
  versus a bespoke Containerfile in the package (mutation-test style).
- Fixture workspace shape and how pnpm settings are applied per container combo.
- pnpm pnp reader: exact PnP-API call sequence.
- Branch name and commit slicing for the pnpm PR.

## Key files

- `packages/dev-script/catalog-tighten/src/yaml-parse.ts`: catalog parser (#258 defect 1, #195).
- `packages/dev-script/catalog-tighten/src/version-resolve.ts`: installed-version resolution (#258 defect 2).
- `packages/dev-script/catalog-tighten/src/version-read.ts`: store scan to be removed.
- `packages/dev-script/catalog-tighten/src/index.ts`: top-level run and write-back (#258 defect 3).
- `packages/dev-script/catalog-tighten/README.md`: to rewrite.
- `docs/troubleshooting/pnpm-modules-cache.md`: stale-orphan hazard rationale.
- `pnpm-workspace.yaml`: the catalog source, single-quoted, `nodeLinker: isolated`.
