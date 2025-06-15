# Architecture overview

## System architecture

Monochromatic uses a pnpm monorepo structure with the following hierarchy:
```
monochromatic2025MAY24-pnpmTest/
├── packages/
│   ├── config/         # Development tool configurations
│   ├── module/         # Functional programming utilities
│   ├── style/          # CSS frameworks and design systems
│   ├── site/           # Website and documentation packages
│   ├── figma-plugin/   # Figma integration tools
│   └── build/          # Build utilities
└── [root configurations]      # Monorepo-wide configurations
```

## Source code paths

### Core package categories
- `/packages/config/*` - Shareable configurations (ESLint, TypeScript, Vite, etc.)
- `/packages/module/es` - Functional programming utility library
- `/packages/style/monochromatic` - CSS framework with monochromatic design
- `/packages/site/astro-test` - Astro-based documentation site
- `/packages/figma-plugin/css-variables` - Figma plugin for CSS variable extraction

### Key configuration files
- `/pnpm-workspace.yaml` - Workspace configuration with catalog dependencies
- `/moon.yml` - Moon task orchestration configuration
- `/tsconfig.json` - Root TypeScript configuration
- `/eslint.config.js` - Root ESLint configuration
- `/vitest.config.ts` - Testing configuration

## Key technical decisions

1. **pnpm workspaces with catalog**
   - Uses pnpm's catalog feature for centralized dependency versions
   - Strict dependency resolution with `strictPeerDependencies: true`
   - Isolated node_modules with `nodeLinker: isolated`

2. **TypeScript-first development**
   - All packages written in TypeScript
   - Explicit type exports and comprehensive TSDoc
   - Separate type definitions in `dist/final/types`

3. **Dual build targets**
   - Node.js-specific builds for server environments
   - Browser-optimized builds for client-side usage
   - Conditional exports in package.json for proper resolution

4. **Functional programming paradigm**
   - Immutable data structures preferred
   - Pure functions with explicit types
   - Currying and partial application utilities

## Design patterns in use

1. **Export aggregation**
   - Central index.ts files re-export all module functions
   - Enables tree-shaking while maintaining convenience

2. **Platform-specific implementations**
   - `.node.ts` files for Node.js-specific code
   - `.default.ts` files for browser/universal code
   - Conditional exports handle platform selection

3. **Configuration inheritance**
   - Base configurations extended by specific packages
   - Workspace-level configurations inherited by all packages

4. **Testing patterns**
   - Unit tests colocated with source (`.unit.test.ts`)
   - Vitest for testing framework
   - Separate browser and Node test environments

## Component relationships

1. **Config dependencies**
   - All packages depend on `@monochromatic-dev/config-typescript`
   - Config packages can depend on each other (for example, ESLint uses TypeScript config)

2. **Module dependencies**
   - `@monochromatic-dev/module-es` is self-contained
   - Other packages may import utilities from module-es

3. **Build pipeline**
   - Vite handles bundling for all packages
   - TypeScript compilation happens before bundling
   - Moon orchestrates parallel builds across packages

## Critical implementation paths

1. **Package build process**
   ```
   TypeScript Compilation → Vite Bundling → Output to dist/final
   ```

2. **Module resolution**
   ```
   Import Request → Package.json exports → Platform-specific file
   ```

3. **Development workflow**
   ```
   pnpm install → Moon task execution → Watch mode for development
   ```

4. **Testing pipeline**
   ```
   Vitest discovery → Platform detection → Test execution
   ```
