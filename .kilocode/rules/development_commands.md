# Development Commands

## Essential Commands

**IMPORTANT**: All builds and tasks are managed by Moon. Never run `pnpm exec` or direct package scripts. Always use `moon run` commands.

### Initial Setup
```bash
# Install moon globally first
npm install -g @moonrepo/cli

# Setup project
moon run prepare
```

### Development Commands
```bash
# Build everything
moon run build

# Build and watch (recommended for development)
moon run buildWatch

# Run all tests (from workspace root only)
moon run test

# Run unit tests with coverage report (from workspace root only)
moon run testUnit

# Note: Tests can only be run from workspace root
# To run tests for a specific file pattern:
moon run testUnit -- packages/module/es/src/boolean.equal.unit.test.ts
moon run testBrowser -- packages/module/es/src/boolean.equal.browser.test.ts

# Test in watch mode (not recommended, will provide wrong coverage result)
moon run testWatch

# Clear moon cache (useful when debugging cached tasks)
moon clean --lifetime '1 seconds'

# Build and test together
moon run buildAndTest

# Full development mode (build + test watch)
moon run buildAndTestWatch
```

### Package-Specific Commands
```bash
# Build specific package (replace 'es' with package name)
moon run es:js
moon run es:types
```

### Building Projects
**IMPORTANT**: When rebuilding after configuration changes (like ESLint rules), always use `moon run build` to rebuild all projects at once. Moon's caching system ensures this is efficient and won't unnecessarily rebuild unchanged projects. This approach is preferred over building individual packages.

## Search Tools

- **`ripgrep` (rg)** is available in this environment for fast text searching
- Use `rg` directly with Bash tool for searching specific strings, types, or patterns
- **Don't waste time navigating `pnpm`'s complex node_modules structure** - just search everywhere at once
- Examples:
  - `rg "interface AnalyzeOptions" -t ts` (searches all TypeScript files)
  - `rg "export.*parseForESLint" --type ts`
  - `rg "functionName" -A 5 -B 5` (show 5 lines before/after matches)
- This is much faster than:
  - Using Grep tool
  - Trying to find the exact path in `pnpm`'s symlinked `.pnpm` directories
  - Guessing where packages are located

## Script Preferences

- **NEVER write bash/shell scripts** (non-portable, unreadable, unfamiliar)
- When scripts are needed, create TypeScript files as `moon.<action>.ts` in `packages/module/es/src/`
- Use Bun to execute TypeScript scripts directly
- Avoid creating main() functions
  - Instead of wrapping code in a main() function, write top-level code directly
  - Bad: `function main() { /* code */ } main();`
  - Good: Just write the code at the top level
  - For async operations, use top-level await: `await someAsyncOperation();`
- Avoid exiting with 0; just let the program naturally run to the end
  - Bad: `process.exit(0);` at the end of successful execution
  - Good: Let the script complete naturally
  - The Node.js/Bun runtime will exit with code 0 automatically when the script finishes
- NEVER use process.exit() - throw errors instead
  - Bad: `process.exit(1);`
  - Good: `throw new Error('Error description');`
  - Uncaught errors automatically set exit code to 1

## Tool Version Management

- **Only pin tool versions when necessary** with clear justification
- If pinning is required, always include comments explaining why
- Example: `# Pin to v1.2.3 - v1.3.0 introduced breaking API changes`
- Document version requirements in both the pinning file and README
- Regularly review pinned versions to check if constraints still apply

## Linting and Formatting

Don't run linters or formatters. The user will run them themselves.