# Dependencies TODO

Tasks related to third-party dependency issues and contributions.

## Upstream Contributions Needed

### @eslint/config-helpers - Missing eslint dependency

**Issue**: The `@eslint/config-helpers` package uses eslint types (for `globalIgnore` and `defineConfig`) but does not declare eslint as a dependency or peer dependency.
This causes TypeScript errors when using these exported functions.

**Current workaround**: Added to `packageExtensions` in `pnpm-workspace.yaml`:
```yaml
packageExtensions:
  '@eslint/config-helpers':
    dependencies:
      eslint: '*'
```

**Action needed**: Contribute a PR to the @eslint/config-helpers repository to add eslint as a peer dependency.

**Repository**: Likely part of the ESLint monorepo at https://github.com/eslint/eslint

**Expected fix**: Add to their package.json:
```json
{
  "peerDependencies": {
    "eslint": ">=9.0.0"
  }
}
```

**Priority**: Medium - The workaround is functional but should be resolved upstream for the broader community.
