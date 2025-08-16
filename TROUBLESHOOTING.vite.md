# Vite Configuration & Build Troubleshooting

## Vite Config Build Order in Moon

### Problem
When running `moon run prepareAndBuild` on a fresh clone, packages that depend on `@monochromatic-dev/config-vite` fail with:
```
Failed to resolve entry for package "@monochromatic-dev/config-vite". The package may have incorrect main/module/exports specified in its package.json.
```

### Root Cause
Moon's automatic dependency installation works correctly with `language: 'typescript'` configuration, but the build order issue occurs because:
1. The `js_default` task (inherited by all packages) uses vite to build
2. Packages that import from `@monochromatic-dev/config-vite` try to use it before it's built
3. This creates a circular dependency: vite config needs to build itself using vite

### Solution
Import directly from the TypeScript source file using the `.ts` export path:

```typescript
// Before - imports from built output
import { getVitestUnitWorkspace } from '@monochromatic-dev/config-vite';

// After - imports from TypeScript source
import { getVitestUnitWorkspace } from '@monochromatic-dev/config-vite/.ts';
```

The `@monochromatic-dev/config-vite` package exports field supports this:
```json
"exports": {
  ".": {
    "types": "./dist/final/types/src/index.d.ts",
    "default": "./dist/final/js/index.js"
  },
  "./.ts": {
    "default": "./src/index.ts"
  }
}
```

### Performance Note
There's a minimal performance penalty as Vite needs to transpile the TypeScript config on-the-fly, but since parent configs are already `.ts` files and vite can't bundle itself into the config, the impact is negligible.

### Affected Files
All vite config files that import from `@monochromatic-dev/config-vite`:
- `vitest.unit.config.ts`
- `vitest.browser.config.ts`
- `packages/config/eslint/vite.config.ts`
- `packages/figma-plugin/css-variables/vite.config.*.ts`

## Vite Single-File HTML Output Directory Structure

### Problem
When building a single-file HTML application with Vite, the output preserves the source directory structure, resulting in `dist/final/src/index.html` instead of `dist/final/index.html`.

### Root Cause
Vite maintains the input directory structure in the output by default. When the rollup input is configured as:
```javascript
input: {
  index: join('src', 'index.html')
}
```
Vite creates the same `src/` directory in the output.

### Investigation
Initial attempts to fix this included:
1. Setting `subDir` parameter to empty string (`''`) or `'./'`
2. Modifying the `join()` paths to avoid creating subdirectories
3. Trying different root configurations

None of these worked because Vite was enforcing the directory structure based on the input path.

### Solution
Split the frontend configuration into two separate functions:

1. **`createPrefixedFrontendLikeConfig`**: For builds that need subdirectories (e.g., Figma plugins)
   - Explicitly sets input and output paths with subdirectories
   - Used by `getFigmaFrontend` and `getFigmaIframe`

2. **`createUnprefixedFrontendLikeConfig`**: For root-level builds
   - Only sets the root directory and plugins
   - Lets Vite use its default behavior for input/output
   - Used by `getFrontend`

```typescript
// Prefixed version - creates subdirectories
const createPrefixedFrontendLikeConfig = (configDir: string, subDir: string): UserConfig =>
  mergeConfig(createBaseConfig(configDir), {
    // ... other config
    root: resolve(configDir),
    build: {
      rollupOptions: {
        input: {
          index: join('src', subDir, 'index.html'),
        },
      },
      outDir: join('dist', 'final', subDir),
    },
  });

// Unprefixed version - uses defaults
const createUnprefixedFrontendLikeConfig = (configDir: string): UserConfig =>
  mergeConfig(createBaseConfig(configDir), {
    // ... other config
    root: resolve(configDir),
    // No build configuration - uses Vite defaults
  });
```

### Usage
For projects that want a clean output structure:
```typescript
import { getFrontend } from '@monochromatic-dev/config-vite/.ts';
export default getFrontend(import.meta.dirname);
```

This produces output at `dist/final/js/index.html` without the `src/` subdirectory.