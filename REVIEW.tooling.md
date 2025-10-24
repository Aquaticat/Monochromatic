# Tooling and Build System Review

**Review Date**: October 24, 2025
**Repository**: Aquaticat/Monochromatic
**Reviewer**: AI Code Analysis

## Executive Summary

Monochromatic employs a sophisticated and modern tooling ecosystem centered around Proto for tool management and Moon for task orchestration. The build system leverages cutting-edge technologies including Rolldown-Vite, TypeScript project references, and pnpm workspaces. While the tooling is advanced and well-configured, the complexity may present onboarding challenges.

**Tooling Rating**: 8/10

**Strengths**:
- Modern, cutting-edge tool selection (Proto, Moon, Rolldown)
- Excellent version management and reproducibility
- Comprehensive multi-tool formatting/linting pipeline
- Strong automation and task orchestration
- Platform-agnostic where possible

**Areas for Improvement**:
- High complexity and learning curve
- Fresh clone setup issues (documented in TODOs)
- Limited documentation of tool choices
- Some tools experimental/beta versions

## Tool Management

### Proto - Universal Version Manager

**Purpose**: Centralized tool version management and installation

**Configuration**: `.prototools`

**Managed Tools**:
```toml
proto = "latest"        # Version manager itself
moon = "latest"         # Task runner
bun = "latest"         # Primary runtime
pnpm = "latest"        # Package manager
node = "latest"        # Vitest compatibility
npm = "latest"         # create-* tools
dprint = "latest"      # Formatter
uv = "latest"          # Python package manager
caddy = "latest"       # Web server

# Convenience tools
jq = "latest"          # JSON manipulation
yq = "latest"          # YAML manipulation
hyperfine = "latest"   # Benchmarking
gh = "latest"          # GitHub CLI
fzf = "latest"         # Fuzzy finder
```

**Assessment**:

**Strengths**:
1. Single source of truth for versions
2. Automatic installation on setup
3. Team consistency guaranteed
4. Cross-platform support
5. Easy upgrades with `proto upgrade`

**Weaknesses**:
1. Requires proto installation first
2. "latest" versions may cause breakage
3. No version pinning (reproducibility concern)
4. Limited offline support
5. Zellij disabled (Windows incompatibility)

**Recommendations**:
1. Pin versions instead of "latest" for stability
2. Document proto installation more prominently
3. Add version update strategy
4. Consider offline bundle for CI

### Moon - Task Runner

**Purpose**: Monorepo task orchestration and caching

**Configuration**: `moon.yml` (root) + package-level configs

**Version**: 1.36.3+

**Task Categories**:

1. **Build Tasks**
   - `build` - Full build pipeline
   - `buildWatch` - Development mode
   - `buildAndTest` - Build + test combo
   - `bunCompile` - Bun native compilation

2. **Test Tasks**
   - `test` - All tests (unit + browser)
   - `testUnit` - Unit tests only
   - `testBrowser` - Browser tests
   - `testWatch` - Watch mode

3. **Quality Tasks**
   - `format` - Two-pass formatting
   - `lint` - Multi-tool linting
   - `validate` - Comprehensive check

4. **Setup Tasks**
   - `prepare` - Environment setup
   - `prepareAndBuild` - Fresh clone initialization
   - `validateSetup` - Environment verification

**Task Configuration Example**:
```yaml
build:
  deps:
    - '#package:js'
    - 'types'
  inputs:
    - '@group(allConfigs)'
    - '@group(allSources)'
  outputs:
    - '@group(allDists)'
  options:
    internal: false
```

**Moon Features Used**:
- Task dependencies (sequential and parallel)
- Input/output tracking
- Selective caching
- Project references
- Task inheritance (_server, _shell presets)

**Caching Strategy**:

**Cache Enabled For**:
- Build artifacts (with inputs/outputs)
- Type compilation (when stable)

**Cache Disabled For**:
- Tools with own cache (ESLint, TypeScript, dprint)
- Watch/server tasks
- Non-reproducible builds (Bun compile)
- One-off operations (check*, validate*)

**Rationale** (from moon.yml):
> "Moon's cache computation time often exceeds actual execution time for these tasks"

**Assessment**:

**Strengths**:
1. Excellent task organization
2. Clear dependencies and ordering
3. Thoughtful caching decisions
4. Good documentation in configs
5. Parallel execution where possible

**Weaknesses**:
1. Complex for newcomers
2. Hidden behaviors (task deps auto-resolution)
3. Fresh clone issues noted in TODOs
4. Limited error messages
5. Debugging difficulty

**Recommendations**:
1. Add moon task cheat sheet
2. Improve error messages
3. Add task visualization
4. Document common patterns
5. Test fresh clone flow regularly

## Package Management

### pnpm - Fast, Disk Space Efficient Package Manager

**Version**: Latest (specified in proto)

**Configuration**: `pnpm-workspace.yaml` (extensive, 400+ lines)

**Key Settings**:

```yaml
packages: packages/*/*

catalogMode: strict
nodeLinker: isolated
childConcurrency: 16
dedupeDirectDeps: true
strictPeerDependencies: true
hoistWorkspacePackages: false
```

**Catalog Mode**:
- Centralized version management
- 200+ dependencies in catalog
- Strict enforcement (no version overrides allowed)
- Benefits: Consistency, easier updates, reduced conflicts

**Node Linker: isolated**:
- Each package has own node_modules
- Prevents phantom dependencies
- Clear dependency boundaries
- Slower installs but more correct

**Concurrency: 16**:
- High parallelism
- Fast installations
- Memory intensive

**Assessment**:

**Strengths**:
1. Excellent configuration quality
2. Security-conscious (strict settings)
3. Proper isolation
4. Performance optimized
5. Well-documented overrides

**Weaknesses**:
1. Large catalog (maintenance burden)
2. Isolated linker increases disk usage
3. High memory usage during install
4. Complex override rules
5. Slow on fresh clones

**Dependency Catalog** (200+ packages):

**Categories**:
- Core: typescript, vite, vitest, eslint, oxlint, stylelint
- Frameworks: astro, vue, react
- Build: esbuild, rollup, postcss
- Testing: playwright, @vitest/*
- Utilities: zod, type-fest, logtape
- JSR: @zod/zod, @logtape/*, @cspotcode/outdent

**Version Strategy**:
- `>=` prefix for most packages
- Specific versions via overrides
- JSR packages when available
- GitHub packages (TODS)

**Package Extensions** (Ecosystem Compatibility):
```yaml
packageExtensions:
  '@eslint/config-helpers':
    peerDependencies:
      eslint: '*'
  vitest:
    dependencies:
      strip-literal: '>=3.0.0'
  # ... 15+ more extensions
```

**Purpose**: Fix upstream missing dependencies

**Overrides** (Version Forcing):
```yaml
overrides:
  typescript: 'catalog:'
  vite: 'catalog:'
  vitest: 'catalog:'
  rollup: 'catalog:'
  # ... ensures consistency throughout tree
```

**Recommendations**:
1. Consider splitting catalog into categories
2. Document override rationale
3. Regular dependency audits
4. Automated update strategy
5. Reduce catalog size if possible

## Runtime Environment

### Bun - Primary Runtime

**Version**: 1.2.9+

**Usage**:
- Primary runtime for scripts
- Task execution
- Development server
- Build scripts

**Benefits**:
- Fast startup
- Built-in TypeScript support
- npm compatibility
- Modern APIs

**Concerns**:
- Non-reproducible builds (noted in comments)
- Limited ecosystem maturity
- Some npm package incompatibilities
- Windows support limitations

### Node.js - Compatibility Runtime

**Version**: Latest (required by Vitest)

**Usage**:
- Vitest test runner
- Some npm tools
- Compatibility layer

**Rationale**: Vitest requires Node.js runtime

## Build System

### TypeScript - Language and Type System

**Version**: 5.9.3+ (beta versions used)

**Configuration**: Project references architecture

**Root tsconfig.json**:
```json
{
  "extends": "@monochromatic-dev/config-typescript/dom",
  "files": [],
  "references": [
    { "path": "packages/build/backup-path" },
    { "path": "packages/config/eslint" },
    // ... 13 total project references
  ]
}
```

**Shared Config** (packages/config/typescript/):
- Base configurations
- Platform-specific (dom, node)
- Strict settings enabled

**Compiler Options** (typical):
```json
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "noImplicitOverride": true,
  "noPropertyAccessFromIndexSignature": true,
  "useUnknownInCatchVariables": true,
  "module": "ESNext",
  "target": "ESNext",
  "moduleResolution": "bundler"
}
```

**Assessment**:

**Strengths**:
1. Excellent project reference usage
2. Strict type checking
3. Incremental builds
4. Clear boundaries
5. Modern module resolution

**Weaknesses**:
1. Beta TypeScript version (risk)
2. Path mapping complexity
3. IDE performance impact (791 files)
4. Build cache issues (noted in TODOs)

**Recommendations**:
1. Stabilize on released TypeScript version
2. Monitor IDE performance
3. Document path mapping strategy
4. Optimize project references

### Vite/Rolldown - Bundler

**Version**: rolldown-vite 7.1.9+

**Note**: Using Rolldown-powered Vite (Rust-based)

**Configuration**: packages/config/vite/

**Features Used**:
- TypeScript compilation
- Dual builds (Node/browser)
- IIFE for Figma plugin
- Library mode
- Tree-shaking

**Build Output**:
```
dist/final/
├── js/
│   ├── index.js         # Browser
│   └── index.node.js    # Node.js
└── types/
    └── src/
        └── index.d.ts
```

**Assessment**:

**Strengths**:
1. Fast builds (Rust-based)
2. Modern bundler
3. Excellent tree-shaking
4. Good TypeScript support
5. Watch mode performance

**Weaknesses**:
1. Experimental (Rolldown in development)
2. Some Vite plugins incompatible
3. Limited documentation
4. Potential breaking changes

**Recommendations**:
1. Monitor Rolldown stability
2. Have Vite fallback plan
3. Document build quirks
4. Test production builds regularly

### Vue Type Checking - vue-tsc

**Version**: 2.2.10+

**Usage**: Type check Vue components

**Note**: Used even though few/no Vue files in repo

**Assessment**: May be unnecessary dependency

## Formatting and Linting

### dprint - Fast Code Formatter

**Version**: 0.50.1+

**Configuration**: `dprint.jsonc`

**Formatted File Types**:
- TypeScript/JavaScript
- Astro
- CSS
- HTML
- YAML
- JSON
- Markdown

**Assessment**:

**Strengths**:
1. Fast (Rust-based)
2. Multi-language support
3. Good defaults
4. First pass in formatting pipeline

**Weaknesses**:
1. Less mature than Prettier
2. Some edge case formatting issues
3. Limited plugin ecosystem

### oxlint - Fast Linter

**Version**: 1.24.0+

**Configuration**: `.oxlintrc.jsonc`

**Plugins**:
- unicorn
- typescript
- oxc
- import
- promise
- node
- vitest

**Assessment**:

**Strengths**:
1. Very fast (Rust-based)
2. ESLint-compatible rules
3. Good TypeScript support
4. Low resource usage

**Weaknesses**:
1. Incomplete ESLint compatibility
2. Limited plugin ecosystem
3. Some rules not implemented
4. Newer tool (stability)

### ESLint - Comprehensive Linter

**Version**: 9.29.0+

**Configuration**: `eslint.config.ts`

**Plugins**:
- typescript-eslint
- eslint-plugin-tsdoc
- eslint-plugin-n
- eslint-plugin-unicorn
- eslint-plugin-astro
- @vitest/eslint-plugin

**Features**:
- Flat config format
- TypeScript project service
- Type-aware linting
- Astro support

**Assessment**:

**Strengths**:
1. Comprehensive rule set
2. Excellent TypeScript support
3. Large plugin ecosystem
4. Mature and stable

**Weaknesses**:
1. Slower than oxlint
2. Complex configuration
3. Resource intensive
4. Cache management needed

### stylelint - CSS Linter

**Version**: 16.24.0+

**Configuration**: `stylelint.config.mjs`

**Linted Files**:
- CSS
- Astro
- HTML

**Features**:
- Standard config base
- PostCSS HTML support
- Custom property support

**Assessment**:

**Strengths**:
1. Good CSS coverage
2. Modern CSS support
3. Astro integration

**Weaknesses**:
1. Can be slow
2. Limited Astro support
3. Configuration complexity

## Formatting Pipeline

### Two-Pass Strategy

**Pass 1: All File Types (dprint)**
```yaml
formatAllFileTypes:
  deps:
    - formatDprint
```

**Pass 2: Language-Specific**
```yaml
formatLanguageSpecific:
  deps:
    - formatTypeScript  # Sequential: oxlint → eslint
    - formatStylelint   # Parallel with TypeScript
```

**Rationale** (from moon.yml):
> "Two-pass formatting strategy to avoid conflicts"

**Assessment**:

**Strengths**:
1. Prevents formatter conflicts
2. Clear ordering
3. Maximizes parallelism
4. Well-documented

**Weaknesses**:
1. Slower than single-pass
2. Multiple tool runs
3. Cache invalidation complexity

**Recommendations**:
1. Profile formatting time
2. Consider single tool if possible
3. Add formatting benchmarks

## Testing Infrastructure

### Vitest - Test Runner

**Version**: 4.0.1+

**Configurations**:
- `vitest.unit.config.ts` - Unit tests
- `vitest.browser.config.ts` - Browser tests

**Features**:
- Watch mode
- Coverage (V8)
- Browser testing (Playwright)
- UI mode

**Assessment**:

**Strengths**:
1. Fast execution
2. Good TypeScript support
3. Vite integration
4. Modern API

**Weaknesses**:
1. Requires Node.js (Bun not supported)
2. Some Vite quirks
3. Coverage tool limitations

### Playwright - Browser Automation

**Version**: 1.52.0+

**Usage**:
- Browser test provider for Vitest
- E2E testing (potential)

**Setup**: `preparePlaywright` task installs browsers

**Assessment**:

**Strengths**:
1. Modern automation
2. Multi-browser support
3. Good debugging tools

**Weaknesses**:
1. Large download (browsers)
2. Slow setup
3. Resource intensive

## Development Tools

### Caddy - Web Server

**Version**: Latest

**Usage**: Development server for sites

**Configuration**: `Caddyfile`

**Assessment**:

**Strengths**:
1. Automatic HTTPS
2. Simple configuration
3. Fast

**Weaknesses**:
1. Production use unclear
2. Limited documentation in repo

### GitHub CLI (gh)

**Version**: Latest

**Usage**:
- Issue/PR management
- GitHub operations
- Documented in workflows

**Assessment**: Good developer convenience tool

### Benchmark Tools

**hyperfine**: Installed but usage unclear

**Recommendation**: Add benchmark suite

## CI/CD Tooling

### GitHub Actions Workflows

**Security Workflows** (.github/workflows/):

1. **osv-scanner.yml**
   - Vulnerability scanning
   - Scheduled and on-push
   - Google OSV database

2. **semgrep.yml**
   - Static security analysis
   - Pattern-based detection
   - Auto-remediation

3. **scorecard.yml**
   - OSSF best practices
   - Security scoring
   - Weekly scans

**Assessment**:

**Strengths**:
1. Multiple security layers
2. Automated scanning
3. Best practices focus

**Weaknesses**:
1. No build CI/CD
2. No test automation
3. No deployment pipeline
4. Limited integration

**Recommendations**:
1. Add build/test CI
2. Add deployment workflows
3. Integrate with Moon
4. Add status badges

## Tool Selection Rationale

### Why Proto?

**From Analysis**:
- Version consistency across team
- Cross-platform tool management
- Automatic installation
- Single source of truth

**Trade-offs**:
- Additional layer of indirection
- "latest" version risks
- Limited offline support

### Why Moon?

**From PHILOSOPHY.build-execution.md**:
- Monorepo-native task runner
- Better caching than npm scripts
- Dependency management
- Reproducible builds

**Trade-offs**:
- Learning curve
- Less common than nx/turborepo
- Smaller community

### Why Rolldown-Vite?

**From Analysis**:
- Performance (Rust-based)
- Modern bundler
- Future of Vite
- Tree-shaking quality

**Trade-offs**:
- Experimental status
- Potential breaking changes
- Limited plugin support

### Why pnpm?

**From Configuration**:
- Disk efficiency
- Strict dependency handling
- Fast installs
- Modern features (catalog)

**Trade-offs**:
- Different from npm/yarn
- Learning curve
- Some npm incompatibilities

### Why Bun?

**From README**:
- Fast TypeScript execution
- Modern runtime
- npm compatibility
- Built-in tools

**Trade-offs**:
- Ecosystem maturity
- Windows support
- Non-reproducible builds
- Limited production adoption

## Complexity and Performance Analysis

### Complexity Assessment

**Entry Barrier**: High - Requires knowledge of Proto, Moon, pnpm catalog mode, TypeScript project references, Vite/Rolldown, and multiple linters/formatters. Onboarding: 2-3 days for experienced developers.

**Configuration Files**: 20+ files including .prototools, moon.yml (366 lines), pnpm-workspace.yaml (400+ lines), and various linter configs.

**Debugging**: TypeScript and linting errors are clear. Moon task issues, build cache problems, and dependency resolution can be difficult.

### Performance

**Fast**: oxlint, dprint, Rolldown-Vite (all Rust-based), incremental type checking
**Slow**: Fresh installs, full builds (791 files), ESLint, Playwright setup

**Concerns**: Fresh clone setup slow, build cache issues noted in TODOs

### Maintenance

**Update Strategy**: "latest" versions in proto (risky - no version pinning)
**Dependency Updates**: Manual catalog updates, no Dependabot/Renovate configured

**Recommendations**: Pin versions, automate updates, regular audits

### Documentation Quality

**Well-Documented**: Moon tasks, linting rules, 19 troubleshooting guides
**Gaps**: Tool selection rationale, ADRs, migration guides, performance tuning

**Troubleshooting Coverage**: moon, proto, typescript, eslint, oxlint, stylelint, vite, testing, performance, editors

## Recommendations

### High Priority

1. **Stabilize Tool Versions**
   - Pin versions in proto
   - Test before upgrading
   - Maintain version log
   - Estimate: 1 day

2. **Improve Onboarding**
   - Setup wizard
   - Quick start guide
   - Video tutorial
   - Common issues FAQ
   - Estimate: 1 week

3. **Add Build CI/CD**
   - GitHub Actions workflows
   - Build/test automation
   - Deployment pipeline
   - Status badges
   - Estimate: 3 days

4. **Simplify Configuration**
   - Reduce duplication
   - Clear configuration hierarchy
   - Better defaults
   - Estimate: 1 week

### Medium Priority

5. **Performance Monitoring**
   - Build time tracking
   - Task performance metrics
   - Bottleneck identification
   - Estimate: 3 days

6. **Tool Documentation**
   - Decision rationale
   - Comparison matrix
   - Migration guides
   - Estimate: 1 week

7. **Dependency Automation**
   - Configure Dependabot
   - Automated security updates
   - Update testing
   - Estimate: 2 days

8. **Debug Tooling**
   - Better error messages
   - Debug mode for tasks
   - Trace logging
   - Estimate: 1 week

### Low Priority

9. **Tool Evaluation**
   - Review experimental tools
   - Consider alternatives
   - Plan migrations
   - Estimate: Ongoing

10. **Optimization**
    - Cache tuning
    - Parallel execution
    - Resource allocation
    - Estimate: 1 week

## Conclusion

The Monochromatic tooling ecosystem is modern, sophisticated, and well-configured. The selection of cutting-edge tools (Proto, Moon, Rolldown) shows forward-thinking but introduces complexity and stability risks.

The build system is comprehensive with excellent caching strategies and task orchestration. However, the learning curve is steep and onboarding could be smoother.

**Overall Tooling Rating**: 8/10

**Key Strengths**:
- Modern, performant tools
- Excellent configuration quality
- Strong automation
- Good documentation of rationale

**Key Weaknesses**:
- High complexity
- Experimental tool risks
- Steep learning curve
- Limited CI/CD automation

**Priority Actions**:
1. Pin tool versions for stability
2. Improve onboarding documentation
3. Add build CI/CD workflows
4. Simplify configuration where possible
5. Monitor performance metrics

With stability improvements and better documentation, the tooling could be world-class (9/10).
