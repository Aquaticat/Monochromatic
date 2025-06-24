# Husky to Moon VCS Hooks Migration Plan

## Current State
- Husky is installed as a dependency but not configured (no .husky directory or active hooks)
- Moon VCS is already configured with:
  - `manager: 'git'`
  - `hookFormat: 'bash'`
  - `syncHooks: true`
- No active git hooks in the project

## Migration Steps

### 1. Remove Husky Dependencies
- Remove `husky` from devDependencies in package.json
- Remove `husky` from trustedDependencies array in package.json
- Remove `husky: '*'` from pnpm-workspace.yaml catalog

### 2. Configure Moon VCS Hooks
Moon supports git hooks through the `.moon/hooks` directory. We'll create:
- `pre-commit` hook for code quality checks

### 3. Pre-commit Hook Implementation
Based on the available Moon tasks, the pre-commit hook should run:
1. `moon run lint` - Runs all linters (ESLint, Stylelint, dprint, Oxlint, Vale)
2. `moon run testUnit` - Runs unit tests to ensure code quality

These tasks are already well-configured with proper inputs and caching.

### 4. Hook Configuration
Simply add the commands to `.moon/workspace.yml`:
```yaml
vcs:
  hooks:
    pre-commit:
      - 'moon run :lint --affected'
      - 'moon run :test --affected'
```

Moon automatically generates the necessary bash script. The `--affected` flag ensures only changed files are checked, making the hook faster.

### 5. Additional Considerations
- The TODO comment about checking dprint path configuration can be implemented as a separate Moon task if needed
- Moon's `syncHooks` is already set to true, so hooks will be automatically synced to `.git/hooks/`
- The hook format is already set to 'bash' which is appropriate for the environment

## Benefits of Moon VCS Hooks over Husky
1. **Native Integration**: Hooks are managed directly by Moon, the build system already in use
2. **Better Performance**: Uses Moon's caching and affected file detection
3. **Simpler Configuration**: No separate tool to manage, hooks are part of the build system
4. **Consistency**: All tasks and hooks use the same Moon task definitions

## Testing Plan
1. Create a test branch
2. Make a small change to a TypeScript file
3. Attempt to commit and verify hooks run correctly
4. Verify that linting errors prevent commit
5. Verify that test failures prevent commit