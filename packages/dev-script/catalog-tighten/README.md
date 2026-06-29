# @monochromatic-dev/dev-script-catalog-tighten

Tightens `>=x.y.z` floors in the default `catalog:` block of `pnpm-workspace.yaml`
to match the versions actually installed in `node_modules`.

## What it does

For each entry in the default `catalog:` block:

1.  Skips entries that are not `>=` ranges (`*`, exact versions, GitHub refs).
2.  Resolves the installed version from the on-disk install layout.
3.  If the installed version is strictly greater than the catalog floor, rewrites the range.

**Before:** `'oxlint': '>=0.20.0'` (installed 1.71.0)
**After:** `'oxlint': '>=1.71.0'`

Handles `npm:` aliased packages (e.g. `'npm:@jsr/zod__zod@>=4.1.8'`)
and prerelease versions.

## How it reads

The catalog is parsed with the `yaml` library, so single quotes, double quotes,
and comment lines are all handled. Only the default `catalog:` block is read;
named `catalogs:` are not tightened yet.

## How it resolves versions

Versions come from the actual on-disk install, never from the lockfile:
a lockfile survives a deleted `node_modules` and would report versions that are
not installed.

For each catalog package, the tool reads `node_modules/<name>/package.json`
directly from the monorepo root and from every workspace package, following the
pnpm symlink farm and bypassing the package's `exports` map (resolving a
`<name>/package.json` subpath through `require.resolve` throws
`ERR_PACKAGE_PATH_NOT_EXPORTED` for packages whose `exports` omit it).

A catalog package that is installed nowhere (for example a dependency of a
paused package that was never installed) is reported as `MISS` and skipped:
there is no active installed version to tighten its floor against.

If neither `node_modules` nor `.pnp.cjs` exists at the monorepo root, the tool
fails with a clear error rather than reporting every entry as missing.

## How it writes

Tightened ranges are written back by surgical string replacement on the raw
file text, so formatting, comments, ordering, and the file's quote style are
preserved. Only the version token of each tightened entry changes.

## Usage

```sh
# Write changes
mise run catalog:tighten

# Preview without writing
mise run catalog:tighten -- --dry-run
```

Or directly:

```sh
# from the monorepo root
node packages/dev-script/catalog-tighten/src/index.ts
node packages/dev-script/catalog-tighten/src/index.ts --dry-run
```

## Output

Every catalog entry is logged with a status prefix:

- **TIGHT**: range was tightened (old to new).
- **OK**: installed version matches the catalog floor (already tight).
- **SKIP**: entry is not a `>=` range.
- **MISS**: package is not installed in any `node_modules`.

A catalog key that is not a valid npm package name is logged and skipped, so a
crafted key cannot become a result-map entry.

## Scope and roadmap

This tool currently targets pnpm and its node-modules linkers (isolated and
hoisted). Support for pnpm's PnP linker and for other package managers that
have catalogs (Bun, Yarn Berry, Deno, vlt) is tracked as separate issues; see
`docs/handover/catalog-tighten-portability.md`.
