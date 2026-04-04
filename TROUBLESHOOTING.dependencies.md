# Package Management & Dependencies Troubleshooting

## vlt fails to fetch manifest for versions with semver build metadata

### Symptom

`vlt install` fails with `Error: failed to fetch manifest` on a transitive dependency
whose version spec includes semver build metadata (the `+<hash>` suffix):

```
Error: failed to fetch manifest
    at #registryManifestRequest (…/vlt/chunk-QFA4L7SI.js:1092:31)
  [cause]: {
    code: 'ERESOLVE',
    spec: Spec2 { … spec: '@optique/core@1.0.0-dev.1692+5c265bd4' … },
    url: https://registry.npmjs.org/@optique/core/1.0.0-dev.1692+5c265bd4,
  }
```

Restoring the lockfile does not help because the lockfile edge stores the raw spec
with build metadata, and vlt re-resolves it during install.

### Root cause

**Upstream publisher issue combined with a vlt bug.**

`@optique/run@1.0.0-dev.1692` declares a dependency on
`@optique/core@1.0.0-dev.1692+5c265bd4` -- a version string that includes
semver build metadata (`+5c265bd4`).
The npm registry publishes this version as `1.0.0-dev.1692` (without build metadata)
and does not serve version manifests at URLs containing `+`:

- `GET /@optique/core/1.0.0-dev.1692` -- **200 OK**
- `GET /@optique/core/1.0.0-dev.1692+5c265bd4` -- **404 Not Found**
- `GET /@optique/core/1.0.0-dev.1692%2B5c265bd4` -- **404 Not Found**

The SemVer 2.0.0 spec (items 10 and 11) states that build metadata **MUST** be ignored
when determining version precedence. npm (the CLI) strips build metadata before
making registry requests. vlt does not.

**Exact code path in vlt (vltpkg/vltpkg repo, `src/package-info/src/index.ts`):**

1. `Spec` parser sets `registrySpec = bareSpec` verbatim (`src/spec/src/browser.ts:644`),
   preserving the `+5c265bd4` suffix
2. `manifest()` (line 601-603) sees `range.isSingle === true` and calls `#registryManifestRequest()`
3. `#registryManifestRequest()` (lines 405-407) constructs the URL:
   ```ts
   const version =
     hasLeadingRange ? registrySpec.slice(1) : registrySpec
   const pakuURL = new URL(`${name}/${version}`, registry)
   ```
   `version` is `"1.0.0-dev.1692+5c265bd4"` -- the `+` is a fragment delimiter in URL
   semantics, making the request path invalid for the npm registry

**Correct fix in vlt** would be to strip build metadata before constructing the URL,
e.g. `version.replace(/\+.*$/, '')`.

### Workaround

Use a vlt graph modifier to force all instances of `@optique/core` to resolve
from a range instead of the exact pinned spec from `@optique/run`.
Add to `vlt.json`:

```jsonc
{
  "modifiers": {
    "#@optique/core": ">=1.0.0-dev.0"
  }
}
```

This overrides every occurrence of `@optique/core` in the dependency graph.
The range `>=1.0.0-dev.0` causes `range.isSingle` to be `false`,
routing resolution through `packument()` (fetches full packument by package name,
no version in URL) instead of `#registryManifestRequest()` (constructs a
per-version URL that breaks with build metadata).

If modifiers alone do not resolve the issue, also clear the vlt cache:

```sh
rm -rf ~/.cache/vlt/package-info
rm -rf ~/.cache/vlt/registry-client
```

### Status

No upstream issue exists as of 2026-04-04. File against **vltpkg/vltpkg** if the
workaround is insufficient. The bug is in `src/package-info/src/index.ts` at
`#registryManifestRequest` and in `src/spec/src/browser.ts` at line 644
(`registrySpec = bareSpec` without stripping build metadata)

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