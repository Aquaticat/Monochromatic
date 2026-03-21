# Migration path: Bun PM to alternative package manager

## Candidates

Two alternative PMs are evaluated: **vlt** and **Yarn ZPM** (Yarn 6).

### Comparison

- **vlt** — new PM from npm's original creators (Izs, Darcy, Ruyadorno, Luke Karrys). Beta since November 2024. Security-first two-phase install model. No overrides support.
- **Yarn ZPM** — Rust rewrite of Yarn Berry, developed at `yarnpkg/zpm`. Public preview since January 2026. Carries forward Yarn's mature workspace/catalog/resolutions features.

| Feature | Bun (current) | vlt | Yarn ZPM |
|---|---|---|---|
| `workspace:*` | Yes | Yes | Yes |
| `catalog:` protocol | Yes | Yes | Yes (Yarn invented it) |
| Named catalogs | Yes | Yes | Yes |
| Overrides/resolutions | Yes | **No** | Yes |
| Script control | `trustedDependencies` | Two-phase install | Not documented yet |
| JSR registry scoping | `bunfig.toml` | `vlt.json` registries | `.yarnrc.yml` scopes |
| Lockfile | `bun.lock` | `vlt-lock.json` | `yarn.lock` |
| Stability | Production | Beta | Public preview |
| Stewardship | Oven (Bun) | npm veterans | Yarn team |

### Recommendation

**vlt** if stewardship and security model matter most — two-phase install is a genuine improvement, and the npm-veteran team has credibility.

**Yarn ZPM** if technical completeness matters most — every current feature (catalogs, overrides, workspaces) works out of the box with zero syntax changes.

Both are pre-stable. The shared prerequisite is step 1 (removing stale overrides), which is worth doing regardless.

---

## Shared: step 1 — remove stale overrides

Drop overrides that existed for the Vite era.
These are no longer needed since Vite and Astro are deprecated in this project:

```
astro
esbuild (verify — still used as trustedDependency, but override may be redundant)
rollup
sugarss
vite
```

Remaining overrides to evaluate individually:

- **`@shikijs/types`** — two major versions coexist (3.x from shiki, 4.x from `@shikijs/rehype`).
  The packages vendor their own copies, so this override likely has no effect.
  Test by removing it and checking for type conflicts.
- **`@typescript/native-preview`**, **`typescript`** — all transitive consumers use wide optional peer ranges (`>=4.9.5`, `>=5.0.0`).
  Catalog pins the direct dep; transitives accept whatever is hoisted. Override is defensive only.
- **`react`**, **`vue`** — only 2 lockfile entries each.
  Catalog pin is sufficient; override is redundant.

**Action**: remove all 10 overrides from `package.json`.
For vlt, this is required (no overrides mechanism).
For Yarn ZPM, this is optional — overrides can be ported to `resolutions` if needed.

---

## Option A: vlt migration

### Prerequisites

- Install vlt: `npm i -g vlt` (or via mise once a plugin exists)
- vlt is still in beta; expect rough edges

### Step A2: Remove Bun PM config

Delete or archive:

- `bunfig.toml` — Bun-specific PM config (test runner config moves elsewhere if needed)
- `bun.lock` — replaced by `vlt-lock.json`

Keep `bun` in `mise.toml` `[tools]` — Bun remains the runtime, only the PM changes.

Remove from `package.json`:

```json
"trustedDependencies": ["sharp", "dprint", "esbuild"]
```

This is replaced by vlt's two-phase install model (step A4).

### Step A3: Create `vlt.json`

```json
{
  "workspaces": {
    "packages": "packages/*/*"
  },
  "catalogs": {
    "default": {
      "@microsoft/tsdoc": ">=0.16.0",
      "typescript": ">=6.0.1-rc"
    }
  },
  "registries": {
    "jsr": "https://npm.jsr.io"
  },
  "command": {
    "build": {
      "target": "#sharp, #dprint, #esbuild"
    }
  }
}
```

**Catalog migration notes**:

- vlt catalogs live in `vlt.json` under `catalogs.default`, not in `package.json` under `workspaces.catalog`
- The `catalog:` protocol in individual `package.json` files works the same way
- The `catalogs.legacy` secondary catalog (`vite: ^5.4.0`) maps to a named catalog in vlt:
  `"catalogs": { "default": { ... }, "legacy": { "vite": "^5.4.0" } }`
- References like `"vite": "catalog:legacy"` work identically

**JSR / npm alias migration**:

Bun uses `install.scopes.jsr` in `bunfig.toml` to route `@jsr/*` packages.
vlt uses named registries in `vlt.json`.
The 4 JSR-aliased catalog entries use the `npm:@jsr/` prefix pattern:

```
@cspotcode/outdent  -> npm:@jsr/cspotcode__outdent@*
@optique/core       -> npm:@jsr/optique__core@*
@optique/run        -> npm:@jsr/optique__run@*
zod                 -> npm:@jsr/zod__zod@>=4.3.6
```

These should work with vlt's named registry config, but verify the `npm:` alias prefix is supported.
If not, use vlt's package alias syntax: `"@cspotcode/outdent": "jsr:cspotcode__outdent@*"` with the jsr registry configured.

### Step A4: Update mise tasks

Replace Bun PM invocations in `mise.toml`:

| Current | New |
|---|---|
| `bun install` | `vlt install && vlt build` |
| `bun pm cache rm; bun install` | `vlt install && vlt build` (vlt has no cache rm equivalent yet) |

The `prepare:bun:bun` task and `fix:jsr` task in root `mise.toml` need updating.

Bun runtime tasks (`bun run`, `bun test`) stay unchanged — only PM commands change.

### Step A5: Update `package.json` engine field

```json
"engines": {
  "bun": ">=1.2.9"
}
```

Consider whether to keep this or relax it since the PM dependency on Bun is removed.
Bun remains the runtime, so the engine field is still valid.

### Step A6: Install and verify

```bash
vlt install
vlt build
mise run buildAndTest
```

Check for:

- Missing or duplicate packages in `vlt-lock.json`
- Build failures from changed hoisting behavior
- Script execution failures (sharp/esbuild/dprint binary downloads)

### Step A7: Update CLAUDE.md

Replace references to:

- `bun install` -> `vlt install && vlt build`
- `bunfig.toml` -> `vlt.json`
- `bun.lock` -> `vlt-lock.json`
- `trustedDependencies` -> vlt build targets
- Sandbox `bun install` workaround note (may no longer apply)

### vlt risks

- **Beta stability** — vlt has not reached 1.0; expect bugs in edge cases with 58 workspace packages
- **Hoisting differences** — vlt's resolver may hoist differently than Bun's, causing import resolution changes
- **JSR registry support** — the `npm:@jsr/` alias pattern and scoped registry routing are not extensively documented for vlt
- **No overrides fallback** — if a transitive dependency conflict surfaces post-migration, the only fix is upstream or catalog range adjustment
- **CI/CD** — any CI that runs `bun install` needs updating; Vercel supports vlt natively

---

## Option B: Yarn ZPM migration

### Prerequisites

- Install Yarn 6: `corepack enable && yarn set version berry` (or via mise yarn plugin once ZPM builds are available)
- Yarn ZPM is in public preview; expect gaps vs Yarn Berry

### Step B2: Remove Bun PM config

Delete or archive:

- `bunfig.toml` — replaced by `.yarnrc.yml`
- `bun.lock` — replaced by `yarn.lock`

Keep `bun` in `mise.toml` `[tools]` — Bun remains the runtime.

Remove from `package.json`:

```json
"trustedDependencies": ["sharp", "dprint", "esbuild"]
```

Yarn handles script execution via `enableScripts` in `.yarnrc.yml`.

### Step B3: Create `.yarnrc.yml`

```yaml
nodeLinker: node-modules

# Disable PnP — use traditional node_modules resolution
# to avoid compatibility issues with Bun runtime

npmScopes:
  jsr:
    npmRegistryServer: "https://npm.jsr.io"

catalogs:
  default:
    "@microsoft/tsdoc": ">=0.16.0"
    typescript: ">=6.0.1-rc"
    # ... (full catalog migrated from package.json workspaces.catalog)
  legacy:
    vite: "^5.4.0"
```

**Catalog migration notes**:

- Yarn invented the `catalog:` protocol — your existing `catalog:` and `catalog:legacy` references in every `package.json` work with zero changes
- Catalogs move from `package.json` `workspaces.catalog` to `.yarnrc.yml` `catalogs.default`
- The syntax difference is YAML vs JSON; the protocol is identical

**Overrides migration** (if needed):

Any overrides you keep can move to `resolutions` in `package.json`:

```json
"resolutions": {
  "@shikijs/types": "3.22.0",
  "typescript": "6.0.1-rc"
}
```

Yarn's `resolutions` field is more mature than Bun's `overrides` and supports path patterns for targeting specific transitive chains.

**JSR / npm alias migration**:

Yarn uses `npmScopes` in `.yarnrc.yml` instead of Bun's `install.scopes` in `bunfig.toml`.
The `npm:@jsr/` prefix pattern in catalog entries is supported by Yarn's `npm:` alias protocol.

### Step B4: Update mise tasks

Replace Bun PM invocations in `mise.toml`:

| Current | New |
|---|---|
| `bun install` | `yarn install` |
| `bun pm cache rm; bun install` | `yarn cache clean && yarn install` |

The `prepare:bun:bun` task and `fix:jsr` task in root `mise.toml` need updating.

Bun runtime tasks (`bun run`, `bun test`) stay unchanged — only PM commands change.

### Step B5: Install and verify

```bash
yarn install
mise run buildAndTest
```

Check for:

- `yarn.lock` generation and correctness
- Build failures from hoisting differences (Yarn's hoisting is stricter than Bun's)
- Script execution for sharp/esbuild/dprint

### Step B6: Update CLAUDE.md

Replace references to:

- `bun install` -> `yarn install`
- `bunfig.toml` -> `.yarnrc.yml`
- `bun.lock` -> `yarn.lock`
- `trustedDependencies` -> Yarn script configuration
- Sandbox `bun install` workaround note (may no longer apply)

### Yarn ZPM risks

- **Public preview** — Rust rewrite may have regressions vs Yarn Berry
- **PnP complexity** — must explicitly opt into `node-modules` linker to avoid PnP compatibility issues with Bun runtime
- **Yarn-specific ecosystem** — `.yarnrc.yml`, Corepack, and Yarn plugins are a larger config surface than vlt
- **Script control** — no two-phase install; scripts run during install like traditional PMs
- **Bun + Yarn interaction** — using Bun as runtime but Yarn as PM is uncommon; edge cases possible

---

## Rollback (either option)

Keep `bun.lock` and `bunfig.toml` on a backup branch.
Reverting is: restore those files, delete the new PM's config and lockfile, run `bun install`.
