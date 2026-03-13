# config-eslint-deprecated

**Deprecated**: replaced by oxlint as of 2026-03-13.
Source preserved for reference in case ESLint needs to be re-adopted.

## Why ESLint was removed

Oxlint now covers all rules previously handled by ESLint in this monorepo:

- **Core ESLint, typescript-eslint, unicorn, import, promise, node** --
  built-in oxlint plugins with type-aware mode
- **TSDoc** -- custom `oxlint-tsdoc` JS plugin
  (replaces `eslint-plugin-tsdoc` and `eslint-plugin-jsdoc`)
- **Restricted syntax** -- custom `oxlint-no-restricted-syntax` JS plugin
- **`no-unnecessary-condition`** -- added to oxlint as nursery rule
  with `allowConstantLoopConditions` support
- **Vitest** -- not needed (using bun:test)
- **Astro** -- deprecated

## Re-adoption checklist

If ESLint is ever needed again (e.g. for a plugin with no oxlint equivalent):

1.  Restore catalog entries in root `package.json`:
    ```json
    "@eslint/config-helpers": "*",
    "@eslint/core": ">=1.1.0",
    "@eslint/js": ">=10.0.1",
    "@eslint/plugin-kit": ">=0.6.0",
    "@typescript-eslint/eslint-plugin": ">=8.54.0",
    "@typescript-eslint/parser": ">=8.54.0",
    "@typescript-eslint/scope-manager": ">=8.54.0",
    "@typescript-eslint/types": ">=8.54.0",
    "@typescript-eslint/utils": "*",
    "eslint": ">=10.0.0",
    "eslint-plugin-n": ">=17.23.2",
    "eslint-plugin-oxlint": ">=1.43.0",
    "eslint-plugin-tsdoc": ">=0.5.0",
    "eslint-plugin-unicorn": ">=62.0.0",
    "typescript-eslint": ">=8.54.0"
    ```

2.  Add root devDependencies:
    ```json
    "eslint": "catalog:",
    "@monochromatic-dev/config-eslint": "workspace:*"
    ```

3.  Create root `eslint.config.ts`:
    ```ts
    export { default, } from '@monochromatic-dev/config-eslint/.ts';
    ```

4.  Add `ESLINT_FLAGS` env var to root `mise.toml`:
    ```toml
    [env]
    ESLINT_FLAGS = "unstable_native_nodejs_ts_config"
    ```

5.  Add `lint:eslint` task to root `mise.toml`:
    ```toml
    [tasks."lint:eslint"]
    hide = true
    description = "Lint with ESLint"
    run = "timeout 10 bunx eslint --cache --report-unused-disable-directives --report-unused-inline-configs warn --exit-on-fatal-error 'packages/**/*.*'"
    ```

6.  Add ESLint exec command back to `packages/config/dprint/index.json`
    (after the oxlint command):
    ```json
    {
      "command": "pnpm exec eslint --fix-dry-run --stdin --stdin-filename {{file_path}}",
      "exts": ["ts", "tsx", "js", "jsx"],
      "cacheKeyFiles": ["eslint.config.ts"]
    }
    ```

7.  Rename this package back to `packages/config/eslint`, update
    `package.json` name to `@monochromatic-dev/config-eslint`,
    remove `"private": true`, and run `bun install`.

## Source files

- `src/index.ts` -- main ESLint flat config with 50+ custom rule settings
- `src/astro-plugin.ts` -- custom ESLint plugin for Astro file linting
- `src/astro-parser.ts` -- custom parser extracting frontmatter/scripts from `.astro` files

## Related troubleshooting

See `TROUBLESHOOTING.eslint.md` in the monorepo root (preserved alongside this package).
