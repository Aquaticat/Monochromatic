# Project Overview

## Repository Information
This is the Monochromatic TypeScript monorepo ecosystem for web development.

## Core Features
- Reusable development tool configurations
- Functional programming utilities library
- CSS framework (Monochromatic design system)
- Figma plugin tools
- Documentation sites

## Important Reminders
**Date Handling**: Always use the current date from the environment information provided in the system prompt. Never assume or guess dates.

## Architecture

### Monorepo Structure
```txt
packages/
├── config/         # Shareable tool configurations (ESLint, TypeScript, Vite, etc.)
├── module/es/      # Functional programming utilities with dual Node/browser builds
├── style/monochromatic/  # CSS framework
├── site/astro-test/      # Documentation site
├── figma-plugin/         # Figma integration tools
└── build/                # Build utilities
```

### Build System
- **Package Manager**: pnpm with workspace and catalog feature
- **Task Orchestration**: Moon CLI (runs task dependencies in parallel by default)
- **Bundler**: Vite v7.0.0-beta.1+
- **Language**: TypeScript with strict type checking
- **Testing**: Vitest for unit and browser tests

### Key Architectural Decisions
1. **Dual Builds**: Packages tagged with `dualBuildsNodeBrowser` produce separate Node.js and browser outputs
2. **Platform-Specific Code**: Use `.node.ts` for Node-only, `.default.ts` for browser/universal
3. **Output Structure**: `dist/final/` for builds, `dist/final/types/` for type definitions
4. **Functional Programming**: Pure functions, immutable data, explicit types

## Dependency Management
- Use `workspace:*` for internal dependencies
- `strictPeerDependencies: true` enforces exact versions
- Dependencies managed via pnpm catalog in `pnpm-workspace.yaml`
- `nodeLinker: isolated` for isolated node_modules

## Adding New Packages
1. Create directory under appropriate category in `packages/`
2. Add `moon.yml` with appropriate tags
3. Configure `package.json` with workspace dependencies
4. Set up dual builds if needed (tag: `dualBuildsNodeBrowser`)
