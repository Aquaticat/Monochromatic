# @monochromatic-dev/config-vite-deprecated

**DEPRECATED**: Shared Vite and Vitest configuration for the Monochromatic monorepo, preserved for reference.

## Stripped dependencies

The following dependencies were removed when this package was deprecated.
They are no longer in the catalog or lockfile.

- **esbuild** `>=0.27.3` -- JavaScript bundler, used for smart externalization and Vite's dev transform pipeline
- **lightningcss** `>=1.31.1` -- CSS transformer and minifier with custom visitor support (mixins, variable units)
- **istanbul-lib-report** `>=3.0.1` -- coverage report infrastructure for Vitest integration
- **vite-plugin-singlefile** `>=2.3.0` -- inlines all assets into a single HTML file (used for Figma plugin builds)
- **vite-plugin-json5** `>=1.2.0` -- JSON5 import support for Vite
- **vite** `8.0.0-beta.8` -- the build tool itself, removed from catalog entirely
- **@vitejs/plugin-basic-ssl** `>=2.1.4` -- self-signed TLS for local dev, removed from catalog
- **nano-spawn** `catalog:` -- lightweight child process spawning (still in catalog for other consumers)
- **minimatch** `catalog:` -- glob matching (still in catalog for other consumers)
- **@monochromatic-dev/config-typescript** `workspace:*` -- shared tsconfig
- **@monochromatic-dev/config-tsdown** `workspace:*` -- shared tsdown config
- **@types/bun** `catalog:` -- Bun type definitions

## Previous usage

Import the appropriate configuration factory in your `vite.config.ts`.

### Library
For standard TypeScript libraries:
```ts
import { getLib, type UserConfigFnObject } from '@monochromatic-dev/config-vite/.ts';

export default getLib(import.meta.dirname) satisfies UserConfigFnObject;
```

### Frontend application
For web applications:
```ts
import { getFrontend, type UserConfigFnObject } from '@monochromatic-dev/config-vite/.ts';

export default getFrontend(import.meta.dirname) satisfies UserConfigFnObject;
```

### Figma plugin
Figma plugins require a multi-file configuration setup to handle the Backend (sandbox), Frontend (UI), and the necessary Iframe wrapper (due to Figma's security and rendering limitations).

**Backend (`vite.config.backend.ts`):**
```ts
import { getFigmaBackend, type UserConfigFnObject } from '@monochromatic-dev/config-vite/.ts';

export default getFigmaBackend(import.meta.dirname) satisfies UserConfigFnObject;
```

**Frontend (`vite.config.frontend.ts`):**
```ts
import { getFigmaFrontend, type UserConfigFnObject } from '@monochromatic-dev/config-vite/.ts';

export default getFigmaFrontend(import.meta.dirname) satisfies UserConfigFnObject;
```

**Iframe (`vite.config.iframe.ts`):**
```ts
import { getFigmaIframe, type UserConfigFnObject } from '@monochromatic-dev/config-vite/.ts';

export default getFigmaIframe(import.meta.dirname) satisfies UserConfigFnObject;
```

## Features (historical)

### Advanced CSS processing (LightningCSS)
Used LightningCSS as the transformer and minifier, configured with custom visitors:

- **Custom mixins**: `@mixin` and `@apply` at the parser level
- **Variable units**: Automatic transformation of custom unit tokens (`10--spacing` becomes `calc(10 * var(--spacing))`)
- **Targeting**: Configured for the latest Firefox ESR (currently v140)

### Build configuration
- **Consistent output**: All builds output to `dist/final/`
- **Smart externalization**: Automatically externalizes Node.js built-ins (`fs`, `path`, etc.) and build tools (`vite`, `esbuild`) to prevent accidental bundling
- **Build modes**: `production` (default), `development` (unminified), `node` (Node.js resolve conditions)

### Vitest integration
- **Split execution**: Separate configurations for Unit (`*.unit.test.ts`) and Browser (`*.browser.test.ts`) tests
- **Browser testing**: Playwright with Chromium and Firefox
- **Coverage**: V8 provider with custom reporter, per-file thresholds, HTML/Clover/JSON reports

### Utilities and aliases
- **JSON5**: Native `.json5` import support
- **Path aliases**: `@` maps to package root, `@_` maps to `src/`
- **Polyfills**: `__filename` and `__dirname` for browser compatibility
