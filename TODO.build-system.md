# Build System & Package Management Todo

## Critical Issues

### Fresh Clone Setup Problems
**Status**: High Priority - Blocking new developers

The current setup process fails for fresh clones due to build order issues:

1. **Critical Build Order Problem**: The `js` tasks run before `pnpm install` completes
   - Root cause: The `js_default` task calls `vite build` directly without ensuring dependencies are installed
   - This causes "command not found" errors for tools like `vite` that come from node_modules
   - Moon allows tasks to start before their implicit dependencies are ready

2. **Package Build Order Issue**: Packages depending on `@monochromatic-dev/config-vite` try to build before it's built
   - The figma plugin packages fail because they can't resolve the vite config package
   - Workaround: Running `moon run vite:js` manually before `moon run build` helps

#### Recommended Fix
Add explicit dependencies to ensure proper sequencing in `.moon/tasks.yml`:
```yaml
js_default:
  command: 'vite build --config vite.config.ts --mode production'
  deps:
    - '~:pnpmInstall'  # Ensure dependencies are installed first
  options:
    outputStyle: 'buffer-only-failure'
```

#### Current Workaround Setup Instructions
Until the Moon configuration is fixed, users should run:
```bash
# 1. Install proto globally
bash <(curl -fsSL https://moonrepo.dev/install/proto.sh)

# 2. Setup and build in separate steps
moon run prepare
moon run vite:js  # Build config packages first
moon run build
```

### TypeScript Configuration Issues

1. **TypeScript baseUrl Warnings**: ✅ Fixed by adding `baseUrl: "./"` to all tsconfig files
2. **TypeScript Compilation Errors**: Fresh clones have TypeScript errors that block the build:
   - Missing type declarations for `postcss-mixins`
   - Cannot find module 'astro:content' (Astro's virtual module)

### Moon and TypeScript Integration

- **Research Moon's Astro integration**: Review https://moonrepo.dev/docs/guides/examples/astro for best practices
- **Investigate editor errors**: Editor may be showing errors due to disabled options in .moon/toolchain.yml
- **Fix toolchain.yml schema validation**: Editor reports "typescript isn't a valid option" despite working correctly

## Package Management Improvements

### High Priority

#### Generate `package.json` from `package.jsonc`
Make it bidirectional update to keep both files in sync.

#### Write `package.jsonc` support
Add JSON with Comments support for package configuration.

### Medium Priority

#### Migrate from execa to native node child_process exec
Remove external dependency and use Node.js built-in functionality.

#### Submit `packageExtensions` to `pnpm`
Previously needed for fs-extra/universalify dependency issue (no longer using fs-extra, but keeping for reference).

## Framework Updates

### Completed/No Action Needed
- ✅ **Astro RSS endpoint**: Seems like they've fixed it upstream
- ✅ **lightningCSS resolver**: Switched back to postcss

### Low Priority
- **Find a way to format MDX**: Priority low, investigating solutions

## Validation and Testing

### Setup Validation
- ✅ **validateSetup task**: Successfully implemented to help diagnose environment issues
- ✅ **Validation scripts**: checkTools, checkDependencies, checkBuild, checkGitHooks are working correctly

### Testing Commands
All builds and tasks are managed by Moon. Essential commands:

```bash
# Initial setup
moon run prepare

# Build everything
moon run build

# Build and watch (development)
moon run buildWatch

# Run all tests (from workspace root only)
moon run test

# Clear moon cache (debugging)
moon clean --lifetime '1 seconds'

# Build and test together
moon run buildAndTest
```

## Notes

- **IMPORTANT**: Never run `pnpm exec` or direct package scripts - always use `moon run` commands
- Tests can only be run from workspace root
- Moon's caching system ensures efficient rebuilds when using `moon run build`
- When rebuilding after configuration changes (like ESLint rules), always use `moon run build`