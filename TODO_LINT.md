# Lint fix handover

Partial progress on `mise run lint`. This document tracks remaining work.

## Completed

- **config/typescript**: Removed dead `jsxFactory` and `jsxFragmentFactory` from `tsconfig.options.json`.
  These had no effect with `jsx: "preserve"` but caused `TS5089` errors in packages that override to `react-jsx`.
- **media-renderer/motion-canvas-beachball**: Split `beachball.tsx` (236 lines) into four files under 100 lines each:
  - `beachball.constants.ts` — animation constants (98 lines)
  - `beachball.animations.ts` — entry arc animation + `SceneRefs` type (69 lines)
  - `beachball.bounces.ts` — bounce loop and roll animation (92 lines)
  - `beachball.tsx` — scene setup and orchestration (64 lines)
- **media-renderer/motion-canvas-beachball**: Fixed TSDoc, arrow function ban, duplicate imports,
  `as any` replaced with `as unknown as { default?: ... }` in `vite.config.ts`.

## Remaining: `max-lines` violations

All remaining errors are `eslint(max-lines)` — files exceeding the 100-line limit.
Each file needs to be split into smaller modules.

### Packages with violations

- **config/vite** — 1 file (101 lines)
- **dev-script/catalog-tighten** — 1 file (157 lines)
- **dev-script/inference-canary** — 4 files (118, 123, 150, 183 lines)
- **dev-script/inference-canary-viewer** — 8 files (112, 120, 121, 137, 158, 164, 169 lines)
- **dev-script/task-util** — 2 files (111, 121 lines)
- **duik/teto** — 3 files (109, 133, 170 lines)
- **duik/teto-generated** — 4 files (111, 136, 139, 150 lines)
- **mcp/mvm** — 1 file (164 lines)
- **mcp/nvim** — 3 files (179, 196, 198 lines)
- **mcp/stdio** — 1 file (113 lines)
- **module/es** — 7 files (104, 113, 119, 129, 137, 144, 179 lines)
- **module/image-diff** — 6 files (104, 111, 119, 141, 150, 185 lines)

### Approach for each file

1. Run `mise run '//packages/<path>:lint'` to get exact file paths from the oxlint output
2. Read the file and identify logical split points (functions, types, constants, regions)
3. Extract into sibling modules; update imports
4. Verify with `mise run '//packages/<path>:lint'` — 0 errors
5. For packages with dist output, run `mise run buildAndTest` to confirm nothing broke

### Notes

- `config/vite` is 101 lines — might be solved by removing a blank line or moving one declaration
- `mcp/nvim` has the largest files (196, 198 lines) and will need the most substantial splits
- `module/es` files are deeply nested in the type system; splitting requires careful import management
- Pre-existing tsgo warnings in motion-canvas (`?scene` import, `no-unsafe-*`) are not lint errors
