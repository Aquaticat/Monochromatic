# Dependency blocklist

This repo bans third-party packages through two complementary mechanisms.
Both ban globally (across every workspace package and every level of the dependency graph).
They differ in what lands in `node_modules` after the install.

## Two homes, four outcomes

1.  **Generic substitution stub on disk**: edit `.pnpmfile.mjs` at the repo root.
   The hook there replaces every dependency entry pointing at the blocked package with a workspace stub.
   Two stub kinds exist: throwing and silent.

2.  **Nothing on disk, or an API-compatible shim on disk**: edit the `overrides` block in `pnpm-workspace.yaml`.
   pnpm's native `"name": "-"` primitive removes the package from the resolved graph entirely.
   The same block also accepts `link:packages/shim/<name>` to substitute the package with a workspace shim that re-exports the real API.

The split is intentional.
pnpm has a first-class removal primitive; reimplementing it would add code without adding capability.
Generic substitution needs a workspace-aware hook, since pnpm's overrides cannot point at a workspace package by aliased name in every version.
Shim substitution uses pnpm's overrides directly because `link:` is a path-based protocol that sidesteps workspace-name resolution.

## Scope and what is not covered

The `.pnpmfile.mjs` hook walks `dependencies` and `optionalDependencies` on every manifest pnpm parses.
It does not walk `devDependencies` or `peerDependencies`:

- `devDependencies` on a transitive package are not installed by pnpm, so iterating them would produce noisy substitution warnings for entries that never reach `node_modules`.
- `devDependencies` on a direct workspace package (`packages/<x>/package.json`) are read from disk by pnpm, not via the `readPackage` hook, so the policy does not see them either.
- `peerDependencies` are not auto-installed in this repo (`pnpm-workspace.yaml` sets `autoInstallPeers: false`); substituting them is a no-op.

Practical consequence: a workspace package that adds the blocked dependency to its own `devDependencies` slips past the hook entirely.
The policy ban applies to runtime deps and transitive trees, not to dev-time-only deps on workspace packages.
To police workspace devDeps, add a lint rule (e.g. `eslint-plugin-import/no-restricted-paths`, or a custom check that greps each `package.json` against the same name set) and run it in CI.
The substitutions in `pnpm-workspace.yaml`'s `overrides` block (removal, parent-scoped removal, `link:` shim) are not affected by this scope; they apply globally regardless of which dep field a package declares.

## Decision rule

Pick the lightest action that surfaces the problem at the right place.

- **Removal** (edit `pnpm-workspace.yaml`): all importers handle a missing module gracefully.
   The common pattern is `try { require('optional-thing') } catch {}` for plugin-style integrations (winston transports, passport strategies, optional native bindings).
   The catch fires, the fallback runs, the build stays green.
   For hard `require` or static `import`, removal yields `MODULE_NOT_FOUND` at the call site, which is loud but uninformative.

- **Throwing stub** (edit `.pnpmfile.mjs`, action `throw`): at least one importer hard-imports the package, or you want a custom error message instead of `MODULE_NOT_FOUND`.
   Loading the stub evaluates a `throw new Error(...)` that names the policy file.
   Optional importers (try/catch) still see the catch fire, with your message inside the error.

- **Silent stub** (edit `.pnpmfile.mjs`, action `silent`): soft migration where you want builds green and accept incorrect-but-not-crashing runtime behavior.
   The stub is a callable Proxy whose property accesses, function calls, and `new` invocations all return the stub itself.
   `in` checks return `false`.

- **API-compatible shim** (create `packages/shim/<name>/`, wire via `pnpm-workspace.yaml` `overrides`): an importer hard-imports the package and relies on its constructor or function shape, the package is deprecated or unwanted as a direct source, and the real API is trivially reproducible (e.g. re-exporting a `globalThis.*` value, delegating to a native primitive, or wrapping a different package).
   Generic stubs break the runtime contract; removal leaves the static import dangling.
   A shim package that re-exports the real API keeps consumers working while removing the unwanted source from `node_modules`.

If you are unsure, prefer the throwing stub.
It collapses to the same observable as removal when importers wrap their `require` in `try/catch`, and beats removal when they do not.
Silent is a deliberate trade-off; reach for it only when a loud failure would block work you cannot fix today.
The shim is the right call when the real API is trivial and the importer cannot tolerate stub semantics.

## How to add a substitution

Edit the `POLICY` table in `.pnpmfile.mjs`:

```js
const POLICY = Object.freeze({
  moment: {
    action: 'throw',
    reason: 'use date-fns or native Intl.DateTimeFormat (see docs/decisions/2026-05-no-moment.md)',
  },
  'is-array': {
    action: 'silent',
    reason: 'native Array.isArray; silent substitution while migrating consumers',
  },
  lodash: {
    action: 'throw',
    reason: 'use native ES + es-toolkit',
    allowed: ['@monochromatic-dev/webapp-legacy'],
  },
});
```

`reason` is surfaced in the install-time warning to stderr.
`allowed` is an optional array of consumer workspace-package names; matching consumers keep resolving to the real dependency.

After editing, run a clean install (`mise run //:install` or the equivalent) and read stderr for the warnings.
Each `(dependent, blocked, action)` tuple warns once per install.

## How to add a global removal

Edit `pnpm-workspace.yaml`'s `overrides` block:

```yaml
overrides:
  request: '-'                 # remove globally, no warning
  'consumer-x>request': '8.x'  # but consumer-x keeps the real one (parent-scoped allowlist)
```

Removal is silent.
If you want a warning printed during install, prefer the throwing stub instead.

## Parent-scoped removal

For dropping a specific transitive child only when imported by a specific parent (e.g. `jspdf>canvg`, `@earendil-works/pi-ai>@google/genai`), keep using the existing `pnpm-workspace.yaml` pattern.
The 14 existing parent-scoped entries cover surgical cases where the global mechanisms are too broad.
See `TROUBLESHOOTING.dependencies.md` for the audit trail behind each one.

## How to add an API-compatible shim

Create a workspace package under `packages/shim/<name>/` with five files (mirror `packages/shim/node-domexception/`):

- `package.json` -- private, `"type": "commonjs"`, name `@monochromatic-dev/shim-<name>`, `main: "./index.cjs"`, `types: "./index.d.cts"`.
- `index.cjs` -- the API-compatible replacement source.
- `index.d.cts` -- a minimal type declaration matching the exported shape (use `export = _;` to mirror CJS default export).
- `mise.toml` -- `extends` the standard `lint`, `lint:oxlint`, `lint:types` tasks.
- `README.md` -- one paragraph stating what the shim replaces, the API contract, and a cross-reference to `TROUBLESHOOTING.dependencies.md`.

Wire the substitution by adding one line to `pnpm-workspace.yaml`'s `overrides` block:

```yaml
overrides:
  '<blocked-name>': 'link:packages/shim/<name>'
```

pnpm rewrites every transitive edge that resolved `<blocked-name>` to point at the workspace path; the real npm package is no longer installed under `node_modules/.pnpm/`.
No install-time warning is emitted; the substitution is silent.
Document the rationale in `TROUBLESHOOTING.dependencies.md` so future readers understand why the shim exists.

## Worked examples

### Throw on a package that ships unwanted polyfills

```js
const POLICY = Object.freeze({
  'array.prototype.flat': {
    action: 'throw',
    reason: 'Node 17+ has Array.prototype.flat natively; replace the import',
  },
});
```

On the next install, every package whose manifest declares `array.prototype.flat` produces one stderr line:

```text
[blocked-dep] eslint-plugin-import@2.32.1 -> array.prototype.flat [throw]:
  substituting with stub-throw. Node 17+ has Array.prototype.flat natively;
  replace the import (previous spec: ^1.3.2)
```

If any consumer evaluates `require('array.prototype.flat')`, the stub's `index.cjs` throws an error pointing at this doc.

### Silent for a soft migration

```js
const POLICY = Object.freeze({
  'old-feature-flag-client': {
    action: 'silent',
    reason: 'feature-flag client v2 incoming; v1 stubbed during migration',
  },
});
```

Code that does `flagClient.isEnabled('something')` runs without throwing.
`isEnabled` reads back as the stub Proxy, which is callable and returns the stub.
Returns are not truthy/falsy in a useful way, so feature checks default to "missing"; verify each call site behaves acceptably before shipping.

### Allowlist a single legacy consumer

```js
const POLICY = Object.freeze({
  moment: {
    action: 'throw',
    reason: 'use date-fns',
    allowed: ['@monochromatic-dev/webapp-edu-legacy'],
  },
});
```

The legacy webapp keeps the real `moment`; every other workspace package and every transitive dep resolves to the throwing stub.

### Global removal of an optional dep

In `pnpm-workspace.yaml`:

```yaml
overrides:
  fsevents: '-'
```

Every package whose manifest depends on `fsevents` (chokidar and friends) gets it removed.
Linux and Windows installs were already skipping it via `os` constraints; the override makes the removal explicit and disk-saving.
Consumers wrapping `require('fsevents')` in try/catch continue working.

### Shim for a deprecated package hard-imported by a transitive consumer

`fetch-blob@3.2.0/from.js:3` does `import DOMException from 'node-domexception'` and uses it as a constructor at `from.js:86`.
The upstream package is deprecated but its runtime behaviour on Node 17+ and Bun is `module.exports = globalThis.DOMException`, which is trivially reproducible.

The shim package lives at `packages/shim/node-domexception/`.
Its `index.cjs` is a single line:

```js
module.exports = globalThis.DOMException;
```

`pnpm-workspace.yaml` substitutes the upstream package globally:

```yaml
overrides:
  'node-domexception': 'link:packages/shim/node-domexception'
```

After install, every transitive `node-domexception` edge resolves to the workspace shim.
The deprecation warning is gone.
Consumers (`fetch-blob`, `node-fetch`, the `@libsql/hrana-client` and `gaxios` subtrees) see the native `DOMException` constructor exactly as before, so the `throw new DOMException(...)` paths in `fetch-blob` keep producing real `Error`-derived exceptions.

## Verification after adding an entry

1.  Run install (`mise run prepare:pnpm:install`).
   pnpm v11 stores a `pnpmfileChecksum` line in `pnpm-lock.yaml`; editing `.pnpmfile.mjs` changes the checksum and pnpm re-runs resolution automatically.
   No lockfile deletion or `--force` flag is needed.
2.  Read stderr for the `[blocked-dep]` lines.
   Confirm the dependent names you expected appear; one warning per `(dependent, blocked, action)` tuple.
3.  For a throwing stub, exercise the import in a probe script.
   From the repo root: `node -e "require('<blocked-pkg>')"`.
   Expect the stub's error message naming this doc.
4.  For a silent stub, probe with `node -e "console.log(require('<blocked-pkg>'))"`.
   Expect the printed value to look like `Proxy([Function: silentStub])`; no throw.
5.  For removal, probe with `node -e "try { require('<blocked-pkg>') } catch (e) { console.log(e.code) }"`.
   Expect `MODULE_NOT_FOUND`.
6.  For a shim, probe the API surface that the original importer exercises.
   For a constructor shim: `node -e "const X = require('<blocked-pkg>'); const e = new X('msg','Name'); console.log(e.name, e.message, e instanceof Error)"`.
   Also check that the install no longer lists the package as a deprecated subdependency in stderr and that `pnpm why <blocked-pkg>` resolves through the workspace link.

## Cross-references

- `.pnpmfile.mjs` at the repo root: the policy implementation.
- `pnpm-workspace.yaml`'s `overrides` block: global removals, parent-scoped removals, and `link:` substitutions to workspace shims.
- `packages/stub/throwing/`: the workspace stub used by `action: 'throw'`.
- `packages/stub/silent/`: the workspace stub used by `action: 'silent'`.
- `packages/shim/<name>/`: workspace shims for API-compatible substitution; current entries are `packages/shim/node-domexception/`.
- `TROUBLESHOOTING.dependencies.md`: the audit trail for the existing parent-scoped overrides; cross-link entries here when a substitution replaces or augments one of those overrides.
