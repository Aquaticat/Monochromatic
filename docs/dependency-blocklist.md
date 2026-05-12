# Dependency blocklist

This repo bans third-party packages through two complementary mechanisms.
Both ban globally (across every workspace package and every level of the dependency graph).
They differ in what lands in `node_modules` after the install.

## Two homes, three outcomes

1.  **Substitution stub on disk**: edit `.pnpmfile.mjs` at the repo root.
   The hook there replaces every dependency entry pointing at the blocked package with a workspace stub.
   Two stub kinds exist: throwing and silent.

2.  **Nothing on disk**: edit the `overrides` block in `pnpm-workspace.yaml`.
   pnpm's native `"name": "-"` primitive removes the package from the resolved graph entirely.
   The 16 existing entries at `pnpm-workspace.yaml:134-162` already use this form.

The split is intentional.
pnpm has a first-class removal primitive; reimplementing it would add code without adding capability.
Substitution needs a workspace-aware hook, since pnpm's overrides cannot point at a workspace package by aliased name in every version.

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

If you are unsure, prefer the throwing stub.
It collapses to the same observable as removal when importers wrap their `require` in `try/catch`, and beats removal when they do not.
Silent is a deliberate trade-off; reach for it only when a loud failure would block work you cannot fix today.

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
The 16 existing entries cover surgical cases where the global mechanisms are too broad.
See `TROUBLESHOOTING.dependencies.md` for the audit trail behind each one.

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

## Cross-references

- `.pnpmfile.mjs` at the repo root: the policy implementation.
- `pnpm-workspace.yaml:134-162`: the existing overrides block, including the 16 parent-scoped removals.
- `packages/stub/throwing/`: the workspace stub used by `action: 'throw'`.
- `packages/stub/silent/`: the workspace stub used by `action: 'silent'`.
- `TROUBLESHOOTING.dependencies.md`: the audit trail for the existing parent-scoped overrides; cross-link entries here when a substitution replaces or augments one of those overrides.
