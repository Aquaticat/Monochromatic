# Technical stack

## Technologies used

### Core technologies
- **TypeScript** - Primary development language with strict type checking
- **pnpm** - Package manager with workspace support and catalog feature
- **Vite** - Build tool for bundling packages (v7.0.0-beta.1+)
- **Vitest** - Testing framework with browser and Node support
- **Moon** - Task orchestration tool for monorepo workflows

### Linting and formatting
- **ESLint** (v9.27.0+) - JavaScript/TypeScript linting
- **Oxlint** (v0.17.0+) - Additional linting with performance focus
- **Stylelint** - CSS/PostCSS linting
- **dprint** - Code formatter
- **Vale** - Documentation linting

### Framework and libraries
- **Astro** - Static site generator for documentation
- **PostCSS** - CSS processing with numerous plugins
- **Logtape** - Logging library (JSR package)

### Development tools
- **Husky** - Git hooks management
- **Playwright** - Browser testing
- **execa/nano-spawn** - Process execution utilities

## Development setup

### Prerequisites
- Node.js v24.0.0 or higher
- Bun v1.2.9 or higher (optional)
- pnpm (latest version)

### Initial setup
```bash
pnpm install
```

### Common commands
- `pnpm run wr` - Run all watch tasks in parallel
- `pnpm run br` - Run all build tasks sequentially
- `moon run <task>` - Execute Moon tasks

### Package scripts pattern
Each package typically includes:
- `w:types` - Watch TypeScript compilation
- `b:types` - Build TypeScript types
- `w:js` - Watch JavaScript/bundle builds
- `b:js` - Build JavaScript bundles

## Technical constraints

### Strict dependency management
- `strictPeerDependencies: true` - Enforces exact peer dependency matching
- `nodeLinker: isolated` - Isolated node_modules for each package
- `hoistWorkspacePackages: false` - No hoisting of workspace packages

### Platform support
- Operating Systems: Linux, macOS, Windows
- CPU Architectures: x64, arm64
- C Libraries: glibc, musl

### Build requirements
- Dual builds for Node.js and browser environments
- Separate type definitions in `dist/final/types`
- Platform-specific code via conditional exports

## Dependencies

### Catalog system
Dependencies are managed via pnpm's catalog feature in `pnpm-workspace.yaml`:
- Version constraints defined centrally
- Packages reference via `catalog:` protocol
- Ensures version consistency across workspace

### Key dependencies
- **Build tools**: vite, typescript, esbuild
- **Testing**: vitest, @vitest/browser, @vitest/coverage-*
- **Type utilities**: type-fest, zod, ts-pattern
- **CSS tools**: postcss, lightningcss, various @csstools/* packages

### Workspace dependencies
- Packages reference each other via `workspace:*`
- Automatic linking between workspace packages

## Tool usage patterns

### Build pipeline
1. TypeScript compilation (`tsc`)
2. Vite bundling with mode-specific configurations
3. Output to `dist/final/` directory

### Testing strategy
- Unit tests with `.unit.test.ts` suffix
- Vitest configuration at root level
- Browser testing via @vitest/browser
- Coverage reporting with v8 or istanbul

### Code quality
- ESLint with custom configuration package
- Oxlint for additional checks
- dprint for consistent formatting
- Pre-commit hooks via Husky

### Development workflow
1. Make changes in `src/` directories
2. Run watch tasks (`pnpm run w`)
3. Test with Vitest
4. Build for production (`pnpm run b`)
5. Publish packages as needed

### Monorepo coordination
- Moon manages task dependencies
- Parallel execution for independent tasks
- Sequential execution for dependent tasks
- Workspace-wide commands via pnpm
