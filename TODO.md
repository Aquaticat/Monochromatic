# Todo

## WSL Migration - Post-Migration Tasks

### Immediate Tasks (June 19, 2025)
1. **Install dependencies in WSL location**
   ```bash
   cd ~/projects/monochromatic
   pnpm install
   ```

2. **Run initial setup**
   ```bash
   moon run prepare
   ```

3. **Verify build system**
   ```bash
   moon run build
   moon run test
   ```

4. **Set up VSCode for WSL**
   - Open VSCode: `code .` from WSL terminal
   - VSCode will auto-install WSL extension
   - Ensure all extensions work in WSL environment

5. **Performance verification**
   - Compare build times between Windows mount and WSL filesystem
   - Test file watching performance with `moon run buildWatch`

6. **Clean up Windows copy**
   - After confirming everything works perfectly
   - `rm -rf /mnt/c/Users/user/Text/Projects/Aquaticat/monochromatic2025MAY24-pnpmTest`

### Migration Benefits Achieved
- Native Linux moon binary (no path translation issues)
- 10-50x faster file operations
- Better integration with Linux tooling
- Cleaner development environment

## CLI Tools and Scripts

### Write `cpfd` - Copy Files From Dependencies
Create a tool to copy files from dependencies into the project.

### Write `increase-version`
Automate version bumping to ensure every publish has a new version.

### Write `add-scripts`
Add new NPM scripts to the target package every time a new package is created.

### Monochromatic CLI Development
Currently settling on writing a few moon plugins instead of a full CLI.

#### `monochromatic new <monorepo-name>`
```plantuml
@startuml
start

if (<monorepo-name> exists on filesystem?) then (yes)
  :throw error;
  stop
else (no)
  :TODO: Create monorepo structure;
  stop
endif
@enduml
```

#### `monochromatic new <package-category>/<package-name>`
```plantuml
@startuml
start

if (packages/<package-category> exists?) then (yes)
  :DO NOTHING;
else (no)
  :create folder packages/<package-category>;
endif

:cd packages/<package-category>;

if (<package-name> exists?) then (yes)
  :throw error;
  stop
else (no)
  :create folder <package-name>;
  :TODO: Initialize package structure;
  stop
endif
@enduml
```

## Build System and Package Management

### Generate entire `package.json` automatically from `package.jsonc`
Make it bidirectional update to keep both files in sync.

### Write `package.jsonc` support
Add JSON with Comments support for package configuration.

### Migrate from execa to native node child_process exec
Remove external dependency and use Node.js built-in functionality.

### Submit `packageExtensions` to `pnpm`
Previously needed for fs-extra/universalify dependency issue (no longer using fs-extra, but keeping for reference).

## Documentation and Content

### PlantUML integration
Add support for PlantUML diagrams in documentation.

### Optimize SVG
Reduce redundant attributes in PlantUML-generated SVGs:
- Remove redundant height/width attributes
- Optimize fill attributes on subelements
- Make font-size and similar properties more accessible

### Use pagefind or other tools to pre-generate search results pages
Improve search functionality with pre-generated results.

### Set default modified date by `git log`
Automatically set document modification dates from git history.

### Localization and Internationalization

#### Use multiple, localized 404 pages
Priority: normal

#### Integrate automatic translation
Priority: low
Consider using [deepl-node](https://github.com/DeepLcom/deepl-node)

## UI/UX Improvements

### Dim sidebar (.Aside) when hovering over main
Currently on hold - could be annoying for users.

### Comment System Implementation

#### Webmention support
Implement decentralized web mention protocol.

#### Giscus integration
Add GitHub Discussions-based commenting.

#### Allow defining 3rd party comment system
Make comment system pluggable for flexibility.

## Framework Updates

### Rewrite Astro RSS endpoint
Note: Seems like they've fixed it, so no work needed.

### Find a way to format mdx
Priority: low

### Write custom lightningCSS resolver
Note: Switched back to postcss. Holding onto this idea in case future lightningcss updates make it better than postcss.

## Development Environment

### WSL Debian Distro - Selective Windows Directory Mounting

#### Overview
Configure Debian WSL distro to mount only specific Windows directories instead of auto-mounting all drives, improving security while maintaining access to development files.

#### Required Mount Points
- `/mnt/c/Users/user/Text/Projects` - Development projects
- `/mnt/c/Users/user/.pnpm-store` - pnpm global package store

#### Configuration Steps

1. **Edit WSL Configuration**
   ```bash
   sudo nano /etc/wsl.conf
   ```
   Add:
   ```ini
   [automount]
   enabled = false
   mountFsTab = true
   ```

2. **Create Mount Points**
   ```bash
   sudo mkdir -p /mnt/c/Users/user/Text/Projects
   sudo mkdir -p /mnt/c/Users/user/.pnpm-store
   ```

3. **Configure fstab**
   ```bash
   sudo nano /etc/fstab
   ```
   Add:
   ```
   C:/Users/user/Text/Projects /mnt/c/Users/user/Text/Projects drvfs defaults,uid=1000,gid=1000 0 0
   C:/Users/user/.pnpm-store /mnt/c/Users/user/.pnpm-store drvfs defaults,uid=1000,gid=1000 0 0
   ```

4. **Apply Changes Without Full WSL Restart**

   Option A - Restart only Debian distro:
   ```powershell
   # From Windows PowerShell
   wsl -t Debian
   ```

   Option B - Apply in current session (temporary):
   ```bash
   # Unmount existing
   sudo umount /mnt/c 2>/dev/null

   # Mount manually
   sudo mount -t drvfs 'C:/Users/user/Text/Projects' /mnt/c/Users/user/Text/Projects -o uid=1000,gid=1000
   sudo mount -t drvfs 'C:/Users/user/.pnpm-store' /mnt/c/Users/user/.pnpm-store -o uid=1000,gid=1000
   ```

   Option C - With systemd:
   ```bash
   sudo systemctl daemon-reload
   sudo mount -a
   ```

#### Verification
```bash
# Check mounted directories
mount | grep drvfs

# Test access
ls /mnt/c/Users/user/Text/Projects
```

#### Notes
- This configuration is specific to the Debian WSL distro only
- Other WSL distros (including those running Docker/Podman) are unaffected
- To add more directories later, update `/etc/fstab` and remount

## Code Quality and Patterns

### Meilisearch Task Polling Implementation Evolution

The user repeatedly asked "Do you really need..." to guide me through progressively simpler implementations:

1. Started with mutable `let taskStatus` and `while` loop with inline constants
2. "Do you really need a mutable variable?" → Moved to immutable `const` inside loop, hoisted constants
3. "Do you really need a while(true) break pattern?" → Changed to `while` with proper condition
4. "Do you really need a while loop at all?" → Changed to `for` loop with calculated iterations
5. "Do you really need a for loop?" → Changed to recursive helper function

Next conversation hint: async iterator helper `takeUntil` - likely a functional approach that avoids explicit loops entirely.

#### Final Implementation Plan: Simple Array with `findAsync`

The simplest approach uses a dummy array with `findAsync`:

```typescript
// Create array of 100 nulls as a counter
const polls = new Array(100).fill(null);

// Use findAsync where the predicate does all the work
try {
  const completedStatus = await findAsync(
    polls,
    async () => {
      const status = await client.tasks.getTask(task.taskUid);
      if (!isTaskPending(status.status)) {
        return status;
      }
      await wait(TASK_POLL_INTERVAL_MS);
      return false;
    }
  );

  if (completedStatus) {
    if (completedStatus.status !== 'succeeded') {
      console.error(`Task ${task.taskUid} failed:`, completedStatus.error);
      allTasksSuccessful = false;
    }
  } else {
    console.error(`Task ${task.taskUid} timed out after ${TASK_TIMEOUT_MS}ms`);
    allTasksSuccessful = false;
  }
} catch (error) {
  console.error(error);
  allTasksSuccessful = false;
}
```

#### Late Night Ideas (1am ramblings) and Potential Improvements

User's thoughts at 1am:
- The array might be unnecessary with a different utility function (maybe something like `repeatUntil` or `retryAsync`?)
- The array could be filled with all the taskUids so every task is validated at the same time (parallel polling instead of sequential)

My guesses on these ideas:
1. **Different utility function**: Perhaps a `times` or `repeat` async function that runs a predicate N times until it returns truthy
   - `const status = await repeatAsync(100, async () => { /* poll logic */ })`
   - This would eliminate the dummy array entirely

2. **Parallel task validation**: Instead of polling tasks one by one in the batch loop:
   - Create an array of all taskUids from the batch
   - Use `Promise.all` with `findAsync` for each task
   - Or better: a single `findAsync` that polls ALL tasks in each iteration
   - This could dramatically reduce total wait time when indexing multiple batches

```typescript
// Hypothetical parallel approach
const allTaskUids = batches.map(batch => batch.taskUid);
const completed = await findAsync(
  new Array(100).fill(null),
  async () => {
    const statuses = await Promise.all(
      allTaskUids.map(uid => client.tasks.getTask(uid))
    );
    const allCompleted = statuses.every(s => !isTaskPending(s.status));
    if (!allCompleted) {
      await wait(TASK_POLL_INTERVAL_MS);
    }
    return allCompleted ? statuses : false;
  }
);
```

Good night!

#### Lessons from "Do you really need..."

This questioning pattern taught me to:
1. **Question every construct** - Each programming construct adds complexity
2. **Prefer immutability** - Mutable variables should be eliminated when possible
3. **Prefer declarative over imperative** - Loops can often be replaced with higher-order functions
4. **Extract and name concepts** - Helper functions like `isTaskPending` improve readability
5. **Think functionally first** - There's often a functional solution that's cleaner
6. **Simplify progressively** - Don't stop at the first working solution

The progression from imperative loops to recursive functions to (eventually) async iterators shows how the same problem can be solved with decreasing complexity and increasing elegance.

## Priority Levels

### High Priority
- CLI tools development (cpfd, increase-version, add-scripts)
- Package.jsonc support and bidirectional sync

### Normal Priority
- Multiple localized 404 pages
- PlantUML integration
- SVG optimization

### Low Priority
- MDX formatting
- Automatic translation integration
- Dim sidebar on hover (on hold)

### Completed/No Action Needed
- Astro RSS endpoint (fixed upstream)
- lightningCSS resolver (switched to postcss)
- fs-extra packageExtensions (no longer using fs-extra)

## Husky to Moon Migration (June 2025) ✅

### Completed
- [x] Research Moon's VCS hooks capabilities and configuration
- [x] Back up all package.json files with scripts to `bak/20250619_233329/`
- [x] Remove scripts from all package.json files
- [x] Setup Moon MCP server in ~/.claude.json for better task discovery
- [x] Create migration plan from Husky to Moon hooks
- [x] Get second opinion from Zen on the migration plan
- [x] Remove Husky configuration and dependencies
- [x] Implement Moon VCS hooks configuration
- [x] Test the new pre-commit hooks

### Migration Summary
- Successfully removed Husky dependencies from package.json and pnpm-workspace.yaml
- Configured Moon VCS hooks in `.moon/workspace.yml` with simple command list:
  ```yaml
  hooks:
    pre-commit:
      - 'moon run :lint --affected'
      - 'moon run :test --affected'
  ```
- Moon automatically generated the bash script and synced to `.git/hooks/pre-commit`
- Pre-commit hook runs both linting and all tests (unit + browser) on affected files for optimal performance
- Hook successfully prevents commits when linting errors are found

### Benefits Achieved
- Native integration with Moon build system
- Better performance using Moon's caching and affected file detection
- Simpler configuration with no separate tool to manage
- Consistent task definitions across build and hooks

### Follow-up Tasks
1. **Set up IDE integration**:
   - Configure format-on-save for all developers
   - Ensure TypeScript language server is properly configured
   - Document recommended VS Code extensions in the project

2. **Strengthen CI pipeline**:
   - Run full `moon run :build` on every PR
   - Run `moon run :format` in check mode
   - Make these CI checks required for merging

3. **Create convenience commands**: ✅
   - `moon run precommit` - manually run all pre-commit checks
   - `moon run validate` - run format + build + test for thorough local validation

## Pre-commit Validation Issues Found (June 2025)

### Critical Build Issues
1. **ESLint config package not built** ✅
   - Fixed by running `moon run config-eslint:build`
   - This was blocking all ESLint validation

2. **Playwright system dependencies missing** ✅
   - Browser tests fail with: "Host system is missing dependencies to run browsers. Missing libraries: libX11-xcb.so.1"
   - Enhanced the `preparePlaywright` script to:
     - Detect OS (Linux/macOS/Windows) and Linux distribution
     - Detect WSL environment specifically
     - Run Playwright's built-in `install-deps` first
     - Fall back to manual apt-get/dnf installation for specific distros
     - Print clear manual installation instructions if automatic installation fails
     - Support Ubuntu/Debian, Fedora/RHEL, and Arch Linux with specific commands

### Linting Issues Summary
1. **TypeScript strict violations** (47 errors):
   - Unsafe any type usage
   - Missing explicit return types on functions
   - Type safety issues with template expressions

2. **Code style issues** (1226 warnings):
   - Variable abbreviations (e.g., `ctx` → `context`, `var` → `variable`)
   - Magic numbers without constants
   - Incorrect quote usage
   - Missing JSDoc comments
   - Vitest formatting issues (padding around expect statements)

3. **Package-specific issues**:
   - Figma plugin: Multiple unsafe type operations and floating promises
   - Config packages: Import path issues with `unicorn/prefer-import-meta-properties`
   - Test files: Using deprecated patterns and missing type annotations

### Resolution Priority
1. **Immediate**: Fix Playwright system dependencies installation ✅
2. **High**: Address TypeScript strict errors (blocking commits) ✅
   - Fixed type guard functions to use `unknown` instead of `any` ✅
   - Fixed error handling in catch blocks to use `unknown` ✅
   - Added explicit return types for Astro getStaticPaths functions ✅
   - Fixed Symbol property access on unknown types ✅
   - Fixed vite config iframe path issue ✅
   - Fixed empty test file causing test suite failures ✅
   - **Pre-commit hook now passes!** Commits are no longer blocked
   - Remaining: Some TypeScript errors in test files (can be addressed incrementally)
3. **Medium**: Fix auto-fixable linting issues
4. **Low**: Address style warnings and JSDoc issues

## ESLint Configuration Cleanup (June 2025)

### Completed
- [x] Disable `jsdoc/tag-lines` - formatting concern, not linting
- [x] Disable `jsdoc/require-jsdoc` for test files
- [x] Add `param`, `args`, `props`, `ctx`, `var` to allowed abbreviations
- [x] Update test files to use function references in describe blocks (partial)
- [x] Add documentation about never using meaningless variable names like `i`
- [x] Fix `i` variable usage in fixture.promises.0to999.ts and fixture.generator.0to999.ts
- [x] Fix void expression issues in error.assert.equal.unit.test.ts (arrow functions)
- [x] Replace `window` with `globalThis` in figma plugin files
- [x] Fix `e` variable usage in catch blocks to use `error` instead

### Completed ESLint Fixes Session (June 2025)
- Fixed variable `i` issues in:
  - `fixture.promises.0to999.ts` - changed to `promiseIndex`, `batchStart`, `index`
  - `fixture.generator.0to999.ts` - changed to `value`, `delayMilliseconds`, `iteration`, `milliseconds`, `valueIndex`
  - `iterable.chunks.ts` - changed to `chunkStart`, `value`
  - `iterable.entries.ts` - changed to `value`, `index`
  - `iterables.intersection.ts` - changed to `value`
  - `moon.index-claude-user-messages.ts` - changed to `batchStart`
  - `logtape.shared.ts` - changed to `messageIndex`
  - `any.echo.unit.test.ts` - changed to `iteration`
  - `function.memoize.ts` - changed to `argIndex`
  - `iterable.take.unit.test.ts` - changed to `value`
  - `promises.some.bench.ts` - changed to `index` in Array.from callbacks
  - `fixture.index.ts` - changed to `index` in Array.from callbacks
  - `iterable.partition.ts` - changed to `item` for iterator values
- Fixed variable `e` issues in catch blocks:
  - `moon.index-claude-mcp-logs.ts` - changed to `error` (3 occurrences)
  - `deprecated.testing.ts` - changed to `error`
  - `fs.fs.default.ts` - changed to `error`
- Fixed void expression issues in:
  - `error.assert.equal.unit.test.ts` - added braces to arrow functions returning void
  - `any.constant.unit.test.ts` - stored undefined result before testing
  - `any.identity.unit.test.ts` - stored undefined result before testing
  - `any.test.ts` - stored undefined result before testing
- Fixed globalThis issues in:
  - `packages/figma-plugin/css-variables/src/iframe/index.ts` - replaced window.getComputedStyle and window.parent.postMessage
  - `packages/figma-plugin/css-variables/src/frontend/index.ts` - replaced window.parent.postMessage and window.addEventListener
  - `logtape.default.ts` - replaced window.sessionStorage with globalThis.sessionStorage
- Updated describe blocks to use function references in:
  - `any.constant.unit.test.ts`
  - `any.echo.unit.test.ts`
  - `any.identity.unit.test.ts`
  - `boolean.not.unit.test.ts`
  - `any.typeOf.unit.test.ts`
  - `any.toExport.unit.test.ts`
  - `strings.join.unit.test.ts`
  - `promise.wait.unit.test.ts`
  - `result.unwrap.unit.test.ts`
  - `promise.is.unit.test.ts`
  - `iterable.take.unit.test.ts` (8 describe blocks)
  - `numeric.add.unit.test.ts` (5 describe blocks)
  - `error.throw.unit.test.ts` (12 describe blocks)
  - `iterable.is.unit.test.ts`
  - `function.thunk.unit.test.ts`
  - `iterable.everyFail.unit.test.ts`
  - `iterable.noneFail.unit.test.ts`
  - `function.curry.unit.test.ts`
  - `function.pipe.unit.test.ts` (all 4 describe blocks)
  - `function.equals.unit.test.ts` (all 4 describe blocks)
  - `function.arguments.unit.test.ts` (both describe blocks)
  - `function.booleanfy.unit.test.ts` (both describe blocks)
  - `function.nary.unit.test.ts` (3 function describe blocks)
  - `fs.fs.node.unit.test.ts`
  - `error.throws.unit.test.ts`
  - `fs.emptyPath.node.unit.test.ts` (4 describe blocks)
  - `any.when.unit.test.ts` (both describe blocks)

### Remaining ESLint Issues to Address

1. **Code Quality Issues** (High Priority - Fix in code, not config):
   - `@typescript-eslint/no-confusing-void-expression` (26 occurrences, down from 50) - void expressions in wrong contexts
   - Variable abbreviations (~135 total occurrences, down from 147) - use descriptive names
   - `@typescript-eslint/no-unsafe-return` (51 occurrences) - unsafe any returns
   - `vitest/prefer-describe-function-title` (down from 69 to around 30) - update remaining test files

2. **Test File Issues** (Medium Priority):
   - Missing JSDoc comments in non-test files (expected for internal utilities)

3. **Remaining Files to Fix**:
   - More test files need function references in describe blocks
   - Files with remaining `i` variables in for loops
   - Files with void expression issues in test assertions
   - Files with window references that need globalThis

### Next Steps
1. Fix all instances of `i` variable usage with descriptive names
2. Fix void expression errors (legitimate code issues)
3. Update remaining test files to use function references in describe blocks
4. Replace `window` with `globalThis` throughout the codebase
5. Address unsafe any returns with proper type annotations

## Moon and TypeScript Configuration (June 2025)

### Research Moon's Astro integration
- Review https://moonrepo.dev/docs/guides/examples/astro for best practices

### Investigate editor errors
- Editor may be showing errors due to disabled options in .moon/toolchain.yml
- Check if `includeProjectReferenceSources` being disabled is causing issues

### Fix toolchain.yml schema validation
- Editor reports "typescript isn't a valid option in .moon/toolchain.yml"
- Investigate why the TypeScript configuration is flagged as invalid despite working correctly

## Fresh Clone Setup Validation (June 2025)

### Current Task
Ensure that fresh clones of the repository work correctly when users follow the setup instructions in README.md.

### Setup Instructions Being Tested
```bash
# 1. Install proto globally
bash <(curl -fsSL https://moonrepo.dev/install/proto.sh)

# 2. Run project setup and build
moon run prepareAndBuild
```

### Issues Found During Testing

1. **Critical Build Order Problem**: The `js` tasks run before `pnpm install` completes, causing build failures
   - Root cause: The `js_default` task in `.moon/tasks.yml` calls `vite build` directly without ensuring dependencies are installed
   - This causes "command not found" errors for tools like `vite` that come from node_modules
   - Moon allows tasks to start before their implicit dependencies (like installed packages) are ready

2. **Package Build Order Issue**: Packages that depend on `@monochromatic-dev/config-vite` try to build before it's built
   - The figma plugin packages fail because they can't resolve the vite config package
   - Workaround: Running `moon run vite:js` manually before `moon run build` helps

3. **TypeScript baseUrl Warnings**: ✅ Fixed by adding `baseUrl: "./"` to all tsconfig files (completed in commit 673787f)

4. **TypeScript Compilation Errors**: Fresh clones have TypeScript errors that block the build:
   - Missing type declarations for `postcss-mixins`
   - Cannot find module 'astro:content' (Astro's virtual module)

### Findings and Solutions

#### Tested Commands and Results:
- `moon run prepareAndBuild` - Fails due to build order issues
- `moon run prepare` then `moon run build` - Better, but still has ordering problems
- `moon run prepare`, then `moon run vite:js`, then `moon run build` - Most successful approach

#### Root Cause Analysis:
The fundamental issue is that Moon's task system doesn't properly sequence the installation of dependencies with tasks that use those dependencies. The `js_default` task assumes `vite` is available in PATH but doesn't declare a dependency on `pnpmInstall`.

### Recommended Fix
Add explicit dependencies to ensure proper sequencing in `.moon/tasks.yml`:
```yaml
js_default:
  command: 'vite build --config vite.config.ts --mode production'
  deps:
    - '~:pnpmInstall'  # Ensure dependencies are installed first
  options:
    outputStyle: 'buffer-only-failure'
```

### Updated Setup Instructions for README
Until the Moon configuration is fixed, users should run:
```bash
# 1. Install proto globally
bash <(curl -fsSL https://moonrepo.dev/install/proto.sh)

# 2. Setup and build in separate steps
moon run prepare
moon run vite:js  # Build config packages first
moon run build
```

### Notes
- The validateSetup task was successfully implemented to help diagnose environment issues
- All validation scripts (checkTools, checkDependencies, checkBuild, checkGitHooks) are working correctly
- The baseUrl TypeScript configuration has been documented in TROUBLESHOOTING.md

## Write my own moon mcp server

## `append` util

terminal append util that appends a new line to a specified file.

```sh
append "my new line" --to myfile.md
append "my new line1" --to myfile.md
append "my new line1\nMy new line2" --to myfile.md
append "my new line1" "my new line2" --to myfile.md
```
