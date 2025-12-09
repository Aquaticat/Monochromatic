# @monochromatic-dev/config-vite

Shared Vite and Vitest configuration for the Monochromatic monorepo. This package provides a highly opinionated, feature-rich build and test environment standardized across the ecosystem.

## Installation

```json
{
  "devDependencies": {
    "@monochromatic-dev/config-vite": "workspace:*"
  }
}
```

## Usage

Import the appropriate configuration factory in your `vite.config.ts`.

### Library
For standard TypeScript libraries:
```ts
import { getLib, type UserConfigFnObject } from '@monochromatic-dev/config-vite/.ts';

export default getLib(import.meta.dirname) satisfies UserConfigFnObject;
```

### Frontend Application
For web applications:
```ts
import { getFrontend, type UserConfigFnObject } from '@monochromatic-dev/config-vite/.ts';

export default getFrontend(import.meta.dirname) satisfies UserConfigFnObject;
```

### Figma Plugin
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

## Features

### 🎨 Advanced CSS Processing (LightningCSS)
We use **LightningCSS** as the transformer and minifier, configured with custom visitors:

-   **Custom Mixins**: Supports `@mixin` and `@apply` at the parser level.
-   **Variable Units**: Automatic transformation of custom unit tokens. If a unit starts with `--` (e.g., `10--spacing`), it is transformed into a `calc()` expression: `calc(10 * var(--spacing))`.
-   **Targeting**: Configured for the latest Firefox ESR (currently v140).

### 📦 Build Configuration
-   **Consistent Output**: All builds output to `dist/final/`.
    -   Libraries: `dist/final/js/`
    -   Figma Backend: `dist/final/backend/`
-   **Smart Externalization**: Automatically externalizes Node.js built-ins (`fs`, `path`, etc.) and build tools (`vite`, `esbuild`) to prevent accidental bundling.
-   **Build Modes**:
    This configuration uses Vite's `mode` feature to apply different build settings. You can trigger these modes by passing `--mode <mode>` to the `vite build` command.
    -   `production` (default): Standard minified build.
    -   `development`: Disables minification for easier debugging.
    -   `node`: Adjusts resolve conditions to prefer Node.js entry points and outputs `.node.js` files (useful for dual-build packages).

    **Example Commands:**
    ```bash
    # Standard production build
    vite build

    # Development build (unminified)
    vite build --mode development

    # Node.js specific build
    vite build --mode node

    # Two modes enabled at the same time
    vite build --mode node,development
    ```

### 🧪 Vitest Integration
Pre-configured workspace settings for robust testing:

-   **Split Execution**: Separate configurations for Unit (`*.unit.test.ts`) and Browser (`*.browser.test.ts`) tests.
-   **Browser Testing**: Uses Playwright with Chromium and Firefox.
-   **Coverage**:
    -   Uses V8 provider.
    -   Custom coverage reporter.
    -   Enforces per-file thresholds.
    -   Generates HTML, Clover, and JSON reports.
-   **Benchmarks**: Specialized configuration for performance testing, outputting to `bak/`.

    **Example Commands:**
    ```bash
    # Run all unit tests
    vitest run --config vitest.unit.config.ts

    # Run browser tests
    vitest run --config vitest.browser.config.ts
    ```

### 🔌 Figma Plugin Support
Figma plugins require a specific architecture with a sandbox "backend" (main thread) and a UI "frontend" that must be isolated. This package provides specialized configurations for each part, which **must** be built separately.

-   **Backend (`getFigmaBackend`)**: Builds the plugin's main thread logic as an IIFE.
-   **Frontend (`getFigmaFrontend`)**: Builds the plugin's main UI.
-   **Iframe (`getFigmaIframe`)**: Builds the iframe wrapper. **Required** due to Figma's strict CSP and iframe isolation requirements. This allows complex UIs to load scripts and styles correctly within Figma's environment.

    **Example Commands:**
    ```bash
    # You must build all three parts

    vite build -c vite.config.backend.ts

    # iframe build must be earlier than frontend build
    vite build -c vite.config.iframe.ts
    vite build -c vite.config.frontend.ts
    ```

### 🛠️ Utilities & Aliases
-   **JSON5**: Native support for importing `.json5` files.
-   **Path Aliases**:
    -   `@`: Maps to the package root.
    -   `@_`: Maps to the `src/` directory.
-   **Polyfills**: Defines `__filename` and `__dirname` for browser compatibility in frontend builds.
