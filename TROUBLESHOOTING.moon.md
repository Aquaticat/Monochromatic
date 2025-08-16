# Moon Build System Troubleshooting

## Moon performance in WSL

Moon runs significantly slower in WSL compared to native Windows execution due to file system translation overhead.

### Performance comparison
- **Build tasks**: ~52 seconds (WSL) vs ~22 seconds (Windows native) - 2.4x slower
- **Test runs**: ~60 seconds (WSL) vs ~18 seconds (Windows native) - 3.3x slower

### Root causes
1. WSL file system operations are slower due to translation layer between Linux and Windows
2. Process spawning has additional overhead in WSL
3. The `@moonrepo/cli` package adds another layer of indirection when installed in workspace

### Solutions

#### Option 1: Use Windows moon.exe from WSL (Recommended)
```bash
# Use the Windows moon executable directly
/mnt/c/Users/$USER/.proto/shims/moon.exe run build

# Or create an alias in your .bashrc
echo 'alias moon="/mnt/c/Users/$USER/.proto/shims/moon.exe"' >> ~/.bashrc
source ~/.bashrc
```

#### Option 2: Remove @moonrepo/cli from workspace
The `@moonrepo/cli` package was removed from this workspace to reduce overhead.
When moon detects this package in the workspace root, it delegates to it instead of running directly, adding extra latency.

```bash
# Remove if present in your workspace
pnpm remove @moonrepo/cli
```

### Trade-offs
- **Windows moon.exe**: Faster execution but may have issues with path translations for complex scenarios
- **WSL moon**: Slower but guaranteed compatibility with Linux-specific tools and scripts
- **No @moonrepo/cli**: Requires global moon installation via proto, but eliminates delegation overhead

## Moon Cache Performance with Large Input Sets

### Problem
Tasks like `moon run testUnit` take significantly longer than expected due to Moon's cache computation overhead, not the actual test execution.

### Root Cause
Moon's caching system experiences performance degradation with:
1. **Filesystem-intensive operations**: Tasks that need to check many files
2. **Large input sets from expanded globs**: When `@group()` directives expand to hundreds or thousands of files
3. **Complex dependency graphs**: Tasks with many transitive dependencies

### Symptoms
- `moon run testUnit` takes ~33 seconds when the actual vitest execution only takes ~7 seconds
- The overhead comes from Moon computing cache keys for all expanded input files
- Performance degrades as the codebase grows

### Solution
Disable caching for affected tasks by adding `cache: false` to the task options:

```yaml
testUnit:
  command: 'vitest run --config vitest.unit.config.ts'
  inputs:
    - '@group(allUnitTests)'
    - '@group(allDists)'
  options:
    cache: false  # Disable cache due to performance overhead
```

### Affected Tasks
Common tasks that benefit from disabled caching:
- Test runners (large number of test files)
- Linters (scan entire codebase)
- Formatters (process many files)
- Any task using `@group()` directives that expand to many files

### Trade-offs
- **With caching**: Slower execution due to cache computation, but skips execution if inputs haven't changed
- **Without caching**: Faster execution, but runs every time regardless of changes

For frequently-run tasks like tests and linters, the performance gain from disabling cache usually outweighs the benefit of skipping unchanged runs.

### Debugging Tips
To identify cache-related performance issues:
1. Time the actual command execution vs the moon task execution
2. Check if the task has large input sets (many files or glob patterns)
3. Test with `cache: false` to see if performance improves
4. Use `moon clean --lifetime '1 seconds'` to clear cache when testing

### The Lesson: Rust Doesn't Make Everything Fast

This issue highlights an important lesson about performance assumptions:

**Just because a tool is written in Rust doesn't mean it's automatically fast for every use case.**

Moon is indeed a high-performance build orchestrator written in Rust, but performance characteristics depend on:
- **Algorithm complexity**: Cache key computation with thousands of files is inherently expensive
- **I/O patterns**: Even Rust can't make filesystem operations magically fast
- **Design trade-offs**: Moon's caching is optimized for avoiding redundant work, not for computing cache keys quickly

In this case, Moon's cache computation takes ~26 seconds for tasks with large input sets, while the actual task execution only takes ~7 seconds. The overhead completely negates the benefit of caching.

**Key takeaways**:
1. **Measure, don't assume**: Even "fast" tools can have slow paths
2. **Understand your tools**: Know when features help vs hurt performance
3. **Question defaults**: Default configurations may not suit your use case
4. **Profile edge cases**: Tools optimized for common cases may struggle with large inputs

The irony is that Moon's sophisticated caching system, designed to improve performance, actually makes things slower for certain workloads. This is a classic example of how performance optimizations can backfire when applied to the wrong problem domain.

## Fresh Clone Setup: Lessons from the Build Order Saga

### The Journey
Setting up a monorepo to work correctly from a fresh clone involves multiple layers of complexity that only surface when starting from scratch. This section documents the complete journey of debugging and fixing fresh clone build issues.

### Issue 1: Dependencies Not Installing

**Symptom**: Running `moon run prepare` on a fresh clone would fail with module resolution errors.

**Root Cause**: Moon's automatic dependency installation requires the `language` field in project configurations. Without `language: 'typescript'`, Moon doesn't recognize that projects need Node.js dependencies and won't run the `InstallWorkspaceDeps` action.

**Fix**: Add `language: 'typescript'` to all TypeScript project moon.yml files.

### Issue 2: Build Order Dependencies

**Symptom**: After fixing dependency installation, builds would fail with:
```
Failed to resolve entry for package "@monochromatic-dev/config-vite"
```

**Investigation Path**:
1. Initially thought it was a moon.yml configuration issue
2. Tried adding `dependsOn` to project configurations
3. Discovered that project dependencies affect the project graph but not task dependencies
4. Attempted to add task-level dependencies but hit a circular dependency

**Root Cause**: The vite config package itself uses vite to build, creating a circular dependency. Packages importing from `@monochromatic-dev/config-vite` were trying to use the built output before it existed.

**Fix**: Import from TypeScript source using the `.ts` export path instead of the built output. This bypasses the build requirement at a small performance cost.

### Key Learnings

1. **Moon's Behavior**:
   - `language` field is required for automatic dependency installation
   - Project dependencies (`dependsOn`) != task dependencies
   - Task dependencies can create circular dependency issues
   - The `InstallWorkspaceDeps` action is language-aware

2. **Build System Design**:
   - Circular dependencies in build tools are particularly problematic
   - Package.json `exports` field can provide escape hatches
   - Sometimes importing from source is the pragmatic solution
   - Performance penalties may be acceptable to solve correctness issues

3. **Testing Philosophy**:
   - Always test with fresh clones before considering a fix complete
   - Build issues often cascade - fix one to reveal the next
   - The development environment can mask problems (cached dependencies, built artifacts)

4. **Debugging Approach**:
   - Start with the simplest possible fix (configuration)
   - Understand the tool's mental model (project vs task dependencies)
   - Consider unconventional solutions when conventional ones create new problems
   - Document the journey for future reference

### Best Practices for Fresh Clone Setup

1. **Configuration**:
   - Always set `language` field in moon.yml for projects with dependencies
   - Be explicit about build dependencies even if they seem obvious
   - Test configuration changes with `moon clean` and fresh clones

2. **Build Architecture**:
   - Avoid circular dependencies in build tooling
   - Provide source-based exports for configuration packages
   - Consider the bootstrap problem: how does a build tool build itself?

3. **Documentation**:
   - Document non-obvious solutions with context
   - Explain why unconventional approaches were chosen
   - Include the problem-solving journey, not just the solution

### The Meta Lesson

Fresh clone setup issues reveal the hidden assumptions in our development workflow. What works in an established development environment may fail catastrophically in a clean environment. Regular fresh clone testing is essential for maintaining a truly reproducible build system.