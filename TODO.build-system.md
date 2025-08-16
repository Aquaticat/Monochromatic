# Build System & Package Management Todo

## Cross-References
- [**Code Quality Issues**](TODO.code-quality.md#current-linting-issues) - Related linting and TypeScript fixes
- [**Performance Optimization**](TODO.performance.md#build-performance) - Build system performance improvements
- [**Automation**](TODO.automation.md#cicd-pipeline) - CI/CD pipeline integration
- [**Package Development**](TODO.packages.md#module-library-packages-modulees) - Module library build requirements

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

### Missing Export Issues (New - High Priority)
**Status**: Critical - TypeScript compilation errors

From recent analysis, multiple files have missing export issues:

- [ ] Fix missing exports in `iterable.is.ts`:
  - [ ] Add `isEmptyArray` export (referenced in `iterable.reduce.ts`, `error.throw.ts`)
  - [ ] Add `isAsyncGenerator` export (referenced in `boolean.equal.ts`)
  - [ ] Add `isGenerator` export (referenced in `boolean.equal.ts`)
  - [ ] Add `isMap` export (referenced in `boolean.equal.ts`)
  - [ ] Add `isArray` export (referenced in `promises.some.ts`)
  - [ ] Add `isArrayEmpty` export (referenced in `iterables.intersection.ts`)
  - [ ] Add `isArrayOfLength1` export (referenced in `iterables.intersection.ts`)
  - [ ] Add `arrayIsNonEmpty` export (referenced in `cli.command.ts`)

- [ ] Fix missing exports in `numeric.type.int.ts`:
  - [ ] Check if `isPositiveInt` should be `PositiveInt` (referenced in `numeric.range.ts`)

- [ ] Fix missing functions and imports:
  - [ ] Add `getRandomId` function or import (referenced in `any.ReplicatingStore.ts`)

- [ ] Fix module export issues:
  - [ ] Check `@monochromatic-dev/module-es/.js` exports for `isInt` (should be `Int`)
  - [ ] Audit all module exports for consistency

- [ ] Fix TypeScript type issues:
  - [ ] Fix `TupleArray` type constraint issue in `array.type.fixedLength.unit.test.ts`
  - [ ] Fix `PatternMatcher` type issue with boolean in `moon.index-claude-user-messages.ts`

**Cross-Reference**: See [Code Quality Todo](TODO.code-quality.md#current-linting-issues) for related TypeScript fixes.

### Moon and TypeScript Integration

- **Research Moon's Astro integration**: Review https://moonrepo.dev/docs/guides/examples/astro for best practices
- **Investigate editor errors**: Editor may be showing errors due to disabled options in .moon/toolchain.yml
- **Fix toolchain.yml schema validation**: Editor reports "typescript isn't a valid option" despite working correctly

## Package Management Improvements

### High Priority

#### Generate `package.json` from `package.jsonc`
Make it bidirectional update to keep both files in sync.

**Cross-Reference**: See [CLI Tools Todo](TODO.cli-tools.md#high-priority-tools) for related tooling.

#### Write `package.jsonc` support
Add JSON with Comments support for package configuration.

#### Fix Module Import/Export Consistency
**Status**: High Priority - Build reliability

- [ ] Audit all packages for consistent import/export patterns
- [ ] Standardize module resolution across packages
- [ ] Fix circular dependency issues
- [ ] Ensure proper TypeScript module declarations
- [ ] Validate package.json exports fields match actual exports

**Cross-Reference**: See [Packages Todo](TODO.packages.md#cross-package-improvements) for package standards.

### Medium Priority

#### Migrate from execa to native node child_process exec
Remove external dependency and use Node.js built-in functionality.

#### Submit `packageExtensions` to `pnpm`
Previously needed for fs-extra/universalify dependency issue (no longer using fs-extra, but keeping for reference).

#### Package Dependency Optimization
**Status**: Medium Priority - Build efficiency

- [ ] Analyze and optimize package dependency graphs
- [ ] Implement smarter dependency hoisting strategies
- [ ] Add package dependency visualization tools
- [ ] Create dependency update automation with conflict resolution
- [ ] Implement dependency security scanning integration

**Cross-Reference**: See [Security Todo](TODO.security.md#dependency-security) for dependency security concerns.

## Framework Updates

### Completed/No Action Needed
- ✅ **Astro RSS endpoint**: Seems like they've fixed it upstream
- ✅ **lightningCSS resolver**: Switched back to postcss

### Low Priority
- **Find a way to format MDX**: Priority low, investigating solutions

**Cross-Reference**: See [Documentation Todo](TODO.documentation.md#format-mdx-files) for MDX formatting details.

## Validation and Testing

### Setup Validation
- ✅ **validateSetup task**: Successfully implemented to help diagnose environment issues
- ✅ **Validation scripts**: checkTools, checkDependencies, checkBuild, checkGitHooks are working correctly

### Enhanced Validation (New)
**Status**: Normal Priority - Development reliability

- [ ] Add comprehensive TypeScript configuration validation
- [ ] Implement package.json consistency checking across packages
- [ ] Create build artifact validation and integrity checks
- [ ] Add development environment consistency validation
- [ ] Implement automated dependency conflict detection

**Cross-Reference**: See [Development Todo](TODO.development.md#environment-validation) for environment validation details.

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

### Performance Monitoring
**Status**: Normal Priority - Build optimization

- [ ] Add build time tracking and analysis
- [ ] Implement build performance regression detection
- [ ] Create build resource usage monitoring
- [ ] Add build cache efficiency tracking
- [ ] Implement build bottleneck identification

**Cross-Reference**: See [Performance Todo](TODO.performance.md#build-performance) for comprehensive build performance optimization.

## Moon Configuration Enhancements

### High Priority

#### Task Dependency Optimization
- [ ] Review and optimize all Moon task dependencies
- [ ] Eliminate unnecessary task blocking
- [ ] Implement efficient task parallelization
- [ ] Add task execution time profiling
- [ ] Create task dependency visualization

#### Moon Workspace Configuration
- [ ] Optimize Moon workspace settings for performance
- [ ] Add comprehensive Moon configuration validation
- [ ] Implement Moon configuration best practices
- [ ] Create Moon configuration documentation
- [ ] Add Moon troubleshooting guides

### Medium Priority

#### Advanced Moon Features
- [ ] Implement Moon project references optimization
- [ ] Add Moon task templating and reuse
- [ ] Create Moon plugin development for custom needs
- [ ] Implement Moon metric collection and analysis
- [ ] Add Moon configuration automation

**Cross-Reference**: See [Automation Todo](TODO.automation.md#development-automation) for build automation improvements.

## Integration with Other Systems

### CI/CD Integration
**Status**: High Priority - Production deployment

- [ ] Optimize Moon integration with GitHub Actions
- [ ] Implement efficient CI/CD caching strategies
- [ ] Add build artifact publishing automation
- [ ] Create deployment pipeline integration
- [ ] Implement build result validation in CI/CD

**Cross-Reference**: See [Automation Todo](TODO.automation.md#cicd-pipeline) for comprehensive CI/CD improvements.

### Development Tool Integration
**Status**: Normal Priority - Developer experience

- [ ] Enhance IDE integration with Moon tasks
- [ ] Add development server integration optimization
- [ ] Implement debugging tool integration
- [ ] Create development workflow automation
- [ ] Add development productivity metrics

**Cross-Reference**: See [Development Todo](TODO.development.md#ide-and-editor-configuration) for IDE integration details.

## Success Criteria

- [ ] Fresh clone setup completes successfully without manual intervention
- [ ] All TypeScript compilation errors resolved
- [ ] Build times optimized and consistent across environments
- [ ] Package dependency issues eliminated
- [ ] Moon task execution optimized for performance
- [ ] Comprehensive build validation and error reporting implemented
- [ ] Integration with other development tools seamless
- [ ] Build system reliability meets production standards

## Notes

- **IMPORTANT**: Never run `pnpm exec` or direct package scripts - always use `moon run` commands
- Tests can only be run from workspace root
- Moon's caching system ensures efficient rebuilds when using `moon run build`
- When rebuilding after configuration changes (like ESLint rules), always use `moon run build`
