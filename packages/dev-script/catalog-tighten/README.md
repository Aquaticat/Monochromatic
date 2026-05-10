# @monochromatic-dev/dev-script-catalog-tighten

Tightens `>=x.y.z` ranges in the monorepo root `package.json` catalog
to match versions actually installed in `node_modules`.

## What it does

For each entry in `workspaces.catalog`:

1. Skips entries that aren't `>=` ranges (`*`, exact versions, GitHub refs)
2. Resolves the installed version from `node_modules` (root, then workspace packages)
3. If installed version is strictly greater than the catalog floor, rewrites the range

**Before:** `"oxlint": ">=0.20.0"` (installed 0.21.0)
**After:** `"oxlint": ">=0.21.0"`

Handles `npm:` aliased JSR packages (e.g. `"npm:@jsr/zod__zod@>=4.1.8"`)
and prerelease versions (e.g. `>=7.0.0-dev` tightened to `>=7.0.0-dev.20260206.1`).

## Usage

```sh
# Write changes
mise run catalog:tighten

# Preview without writing
mise run catalog:tighten -- --dry-run
```

Or directly:

```sh
bun packages/dev-script/catalog-tighten/src/index.ts
bun packages/dev-script/catalog-tighten/src/index.ts --dry-run
```

## Output

Every catalog entry is logged with a status prefix:

- **TIGHT** -- range was tightened (old -> new)
- **OK** -- installed version matches catalog floor (already tight)
- **SKIP** -- entry is not a `>=` range
- **MISS** -- package not found in any `node_modules`
