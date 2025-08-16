# Package Management & Dependencies Troubleshooting

## Package Management Warnings

### Don't run `pnpm up`

It will turn `>=` in `package.json` into exact versions.

## Proto Tool Version Management

### Problem: Proto automatically creates version pins

Proto creates a global `.prototools` file at `~/.proto/.prototools` that pins specific versions of tools.
This causes issues when:
- Tools are updated but the old version is still used
- Moon shows "new version available" messages despite having the latest version installed
- You want to always use the latest versions

### Example Issue
```bash
# Moon says there's a new version despite having it installed
moon run prepare
# Output: There's a new version of moon available, 1.37.3 (currently on 1.37.2)!

# But the new version is already installed
proto install moon latest
# Output: moon 1.37.3 has already been installed!

# The issue: global .prototools is pinning the old version
cat ~/.proto/.prototools
# Output:
# moon = "1.37.2"
```

### Solutions

#### Option 1: Manual version update
Edit `~/.proto/.prototools` to update pinned versions:
```bash
# Update the version in the file
sed -i 's/moon = "1.37.2"/moon = "1.37.3"/' ~/.proto/.prototools
```

#### Option 2: Delete old versions to force updates
```bash
# Remove the old version
rm -rf ~/.proto/tools/moon/1.37.2

# Proto will now use the latest available version
moon --version
```

#### Option 3: Use proto's auto-install feature
Add to your shell configuration:
```bash
# ~/.bashrc or ~/.zshrc
export PROTO_AUTO_INSTALL=true
```

This will automatically install the version specified in `.prototools` files.

#### Option 4: Use "latest" in .prototools (Recommended)
The cleanest solution is to use "latest" as the version in `.prototools` files:

```bash
# First, configure proto to not pin specific versions
echo 'pin-latest = false' >> ~/.proto/config.toml

# Then create a .prototools file with "latest" versions
cat > ~/.proto/.prototools << EOF
bun = "latest"
moon = "latest"
node = "latest"
pnpm = "latest"
proto = "latest"
EOF
```

This approach:
- Always uses the latest installed version of each tool
- Doesn't pin to specific versions
- Avoids "Failed to detect version" errors
- No environment variables needed

**Important**: You must have `pin-latest = false` in your proto config, otherwise proto will replace "latest" with specific version numbers when you install tools.

### Notes
- Proto creates `.prototools` automatically when installing tools (unless `pin-latest = false`)
- The file serves as a global version constraint
- Project-specific `.prototools` files override the global one
- Proto contextually detects versions from the environment (e.g., package.json)
- Without pinned versions, proto will use the latest installed version available

### Related: pnpm url.parse() deprecation warning
When running pnpm commands, you may see:
```
(node:12345) [DEP0169] DeprecationWarning: `url.parse()` behavior is not standardized...
```

This is from pnpm 10.12.1's internal dependencies (npm-package-arg).
It's harmless but cannot be fixed locally - wait for pnpm to update their dependencies.

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