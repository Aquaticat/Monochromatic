# Package Management & Dependencies Troubleshooting

## Package Management Warnings

### Don't run `pnpm up`

It will turn `>=` in `package.json` into exact versions.

## Workspace Cycles: config-vite and module-es

### Problem
After refactoring `@monochromatic-dev/config-vite` to import utility functions from `@monochromatic-dev/module-es`, pnpm warns about cyclic workspace dependencies:
```
WARN  There are cyclic workspace dependencies: /home/user/projects/Monochromatic/packages/config/vite, /home/user/projects/Monochromatic/packages/module/es
```

### Root Cause
The circular dependency exists because:
1. `config-vite` imports utility functions (`notFalsyOrThrow`, `wait`, `alwaysTrue`) from `module-es`
2. `module-es` uses `config-vite` for its build configuration (vite.config.ts)

This creates a dependency cycle in the workspace graph.

### Solution
Disable pnpm's cycle detection by setting `disallowWorkspaceCycles: false` in `pnpm-workspace.yaml`:
```yaml
disallowWorkspaceCycles: false
```

### Why This Is Acceptable

1. **Build-time vs Runtime**: The cycle only exists at the workspace level. At runtime:
   - `config-vite` imports from `module-es` source files (`.ts` export)
   - `module-es` only uses `config-vite` during build time (vite.config.ts)
   - There's no actual runtime circular dependency

2. **TypeScript Source Imports**: By importing from `@monochromatic-dev/module-es/.ts`, we bypass the need for built artifacts, avoiding the bootstrap problem where each package would need the other to be built first.

3. **Development Experience**: The cycle doesn't impact:
   - Development workflow (everything works with source files)
   - Build process (vite handles TypeScript transpilation on-the-fly)
   - Type checking (TypeScript resolves types from source)

4. **Code Quality**: The refactoring improved code quality by:
   - Eliminating code duplication
   - Following DRY principle
   - Centralizing utility functions where they belong

### Trade-offs

**Benefits**:
- Cleaner code with no duplication
- Utilities maintained in one place
- Better adherence to single responsibility principle

**Costs**:
- Workspace-level circular dependency warning
- Slightly more complex dependency graph
- Need to document why the cycle exists

### Alternative Considered
We could have kept the duplicated code to avoid the cycle, but this would:
- Violate DRY principle
- Create maintenance burden (updating utilities in multiple places)
- Increase risk of divergence between implementations

The workspace cycle is a reasonable trade-off for better code organization and maintainability.