# Package Management & Dependencies Troubleshooting

## Global blocklist (substitution vs removal)

For "this package is banned globally; warn and substitute or remove during install,"
see `docs/dependency-blocklist.md`.
That doc covers the two-home mechanism:
`.pnpmfile.mjs` at the repo root for substitution stubs (`action: 'throw'` or `action: 'silent'`),
`pnpm-workspace.yaml`'s `overrides` block for removal (pnpm's native `"name": "-"` primitive).

The parent-scoped overrides documented in this file
(`jspdf>canvg`, `@earendil-works/pi-ai>@google/genai`, the rest of the `pi-*` audit below)
are surgical removals for specific dependents.
They sit alongside the global mechanisms, not inside them, and stay in `pnpm-workspace.yaml`.

## Pre-emptive bans on poorly-maintained transitive utilities

`.pnpmfile.mjs` declares 24 transitive utilities as blocked with `action: 'throw'`
as of 2026-05-12.
None are in the resolved graph at the time the entries were added
(verified: zero matches in `pnpm-lock.yaml`).
The policy is a forward-looking canary:
if a future manifest declares one of these as a dependency,
`pnpm install` emits a stderr `[blocked-dep]` line naming the consumer,
and any runtime `require` on the package throws an error referencing
`docs/dependency-blocklist.md`.

The decision criterion is the same across all 24:
each package is either abandoned (no commits in 3+ years on upstream),
a polyfill rendered obsolete by every supported runtime (Node 22+, Bun),
or a piece of the express 4.x micro-utility family that the workspace has chosen
not to take a dependency on (h3 replaces express; elysia was audited but
not adopted, see `AUDIT.md`).
Per-package rationale is the `reason` field in `.pnpmfile.mjs`,
which surfaces verbatim in the install-time warning.

The 24 split into four groups:

- Express 4.x family (11):
  `cookie-signature`, `destroy`, `etag`, `forwarded`, `fresh`, `methods`,
  `proxy-addr`, `statuses`, `toidentifier`, `utils-merge`, `vary`.
- Polyfills obsolete on every supported runtime (3):
  `fs.realpath`, `regenerator-runtime`, `unpipe`.
- Abandoned utilities with trivial native or catalog replacements (6):
  `extglob`, `for-in`, `repeat-element`, `repeat-string`, `sax`, `set-blocking`.
- Source-map / browser-data / JSON utilities replaced by bundler built-ins
  or catalog deps (4):
  `caniuse-lite`, `convert-source-map`, `fast-json-stable-stringify`,
  `source-map-resolve`.

### Conditions for revisiting

Remove or relax an entry when:

- A workspace package gains a legitimate need for one of the listed packages
  (e.g. a deliberate adoption of express, an SDK that pins old ajv).
- A previously-abandoned package returns to active maintenance and the
  rationale recorded here no longer applies.

In both cases, update the entry's `reason` (or delete it) and record the
change here so future readers see the audit trail.

### Verification

After editing the POLICY block, run `mise run prepare:pnpm:install`.
pnpm rewrites the `pnpmfileChecksum` line in `pnpm-lock.yaml`
and re-runs resolution.
Because no current manifest declares any blocked package,
no substitutions occur and no `[blocked-dep]` lines are printed.
The only diff is the checksum line itself, which is committed alongside
the `.pnpmfile.mjs` change.

## vlt fails to fetch manifest for versions with semver build metadata

### Symptom

`vlt install` fails with `Error: failed to fetch manifest` on a dependency
whose version spec includes semver build metadata (the `+<hash>` suffix):

```text
Error: failed to fetch manifest
  [cause]: {
    code: 'ERESOLVE',
    spec: Spec2 { spec: '@optique/core@1.0.0-dev.1692+5c265bd4', … },
    url: https://registry.npmjs.org/@optique/core/1.0.0-dev.1692+5c265bd4,
  }
```

Restoring the lockfile does not help.
Graph modifiers (`"modifiers"` in `vlt.json`) do not help either;
the failing code path runs during node extraction, which bypasses modifier logic.

### Root cause

Two independent issues combine to produce the failure:

**1. Upstream publisher ships build metadata in dependency specs.**

`@optique/run@1.0.0-dev.1692` declares `"@optique/core": "1.0.0-dev.1692+5c265bd4"`.
Both tarballs also contain `"version": "1.0.0-dev.1692+5c265bd4"` in their `package.json`.
The npm registry strips `+<build>` from the **version key** at publish time
(`npm publish` has done this since 2014, per npm/npm#6379),
but dependency **specifier strings** pass through unmodified.

This is extremely rare: npm stripping `+` from versions means the public registry
has zero packages with build metadata in version keys. The `@optique` project
is an outlier because its toolchain writes `+<git-sha>` into both the version field
and cross-package dependency pinning before publish.

**2. vlt passes build metadata verbatim into registry manifest URLs.**

The npm registry returns 404 for version URLs containing `+`:

- `GET /@optique/core/1.0.0-dev.1692` -- 200 OK
- `GET /@optique/core/1.0.0-dev.1692+5c265bd4` -- 404
- `GET /@optique/core/1.0.0-dev.1692%2B5c265bd4` -- 404

vlt hits this because it never strips build metadata from the version string
before constructing the per-version manifest URL.

### Detailed code trace

All paths in this section are relative to the **vltpkg/vltpkg** monorepo.

**Entry point: dependency spec parsing:**

`src/spec/src/browser.ts:644` sets `registrySpec = bareSpec` verbatim,
preserving the `+5c265bd4` suffix from the dependency declaration.

**Trigger: single-version fast path:**

`src/package-info/src/index.ts:601-603`:

```ts
const mani = spec.range?.isSingle
  ? await this.#registryManifestRequest(spec, options,)
  : pickManifest(await this.packument(f, options,), spec, options,);
```

A version with build metadata parses as `isSingle === true` (the `+` part is metadata,
not a range operator), so vlt takes the fast path instead of fetching the full packument.

**Failure: URL construction:**

`src/package-info/src/index.ts:405-407`:

```ts
const version = hasLeadingRange ? registrySpec.slice(1,) : registrySpec;
const pakuURL = new URL(`${name}/${version}`, registry,);
```

`version` becomes `"1.0.0-dev.1692+5c265bd4"`.
In URL semantics, `+` is not a path-safe character;
`new URL()` preserves it literally rather than encoding it,
and the npm registry does not recognize the resulting path.

**Second trigger: extraction bypass of modifiers:**

`src/graph/src/reify/extract-node.ts:57` hydrates the spec from the node's DepID:

```ts
const spec = hydrate(node.id, node.name, options,);
```

The DepID is built from `mani.version` (`src/dep-id/src/browser.ts:537-542`).
When the manifest comes from the npm registry packument, `mani.version` is
`"1.0.0-dev.1692"` (no build metadata), so the hydrated spec is clean.
But when the manifest comes from a dependency declaration that includes build metadata
(e.g. `@optique/run`'s dep on `@optique/core@1.0.0-dev.1692+5c265bd4`),
the spec flows through `fetchManifestsForDeps` (`src/graph/src/ideal/append-nodes.ts:590`)
where `Spec.parse(name, bareSpec, options)` preserves the `+` suffix.
Graph modifiers apply at lines 271-288 of the same file but are scoped
to the graph-building phase; the extraction code path at `extract-node.ts`
creates specs independently and does not consult modifiers.

### Why this was never reported before

npm has stripped `+<build>` from version strings at publish time since 2014.
Across thousands of checked packages (semver, typescript, react, electron, webpack,
lodash, express, next, vue, angular, prettier, rollup, esbuild, etc.),
zero have build metadata in any version key or dependency specifier on the public registry.
The vlt issue tracker (vltpkg/vltpkg) has no reports matching this pattern;
existing "failed to fetch manifest" issues (#1534, #1263, #260) all have different causes.

The trigger requires a package that pins a dependency to an **exact version
with build metadata** (not a range). This is functionally unreachable
through normal npm publishing workflows.

### Workaround

No reliable workaround exists within vlt's configuration:

- **Graph modifiers** (`"modifiers"` in `vlt.json`) override specs during
  ideal graph building but do not apply during node extraction.
  Tested with `"#@optique/core": ">=1.0.0-dev.0"` and
  `"#@optique/run": ">=1.0.0-dev.0"` -- both failed, error shows `overridden: false`.
- **Lockfile restoration** does not help because vlt re-resolves specs during install.
- **Cache clearing** (`rm -rf ~/.cache/vlt/{package-info,registry-client}`)
  does not help because the build metadata originates from the upstream manifest,
  not from stale cache data.

Viable alternatives until vlt is patched:

- **Pin to a version of `@optique/*` that does not use build metadata**
  (if one exists)
- **Use a different package manager** (npm, pnpm, yarn) for installs;
  all three strip build metadata before making registry requests
- **Ask the `@optique` maintainer** to stop publishing dependency specs
  with build metadata suffixes

### Suggested fix

Strip build metadata from the version string in `#registryManifestRequest`
before constructing the URL:

```ts
// src/package-info/src/index.ts, inside #registryManifestRequest
const version = hasLeadingRange ? registrySpec.slice(1,) : registrySpec;
const versionClean = version.replace(/\+.*$/, '',);
const pakuURL = new URL(`${name}/${versionClean}`, registry,);
```

A more comprehensive fix would strip build metadata in the `Spec` parser
(`src/spec/src/browser.ts:644`) so all downstream consumers see clean versions.
This aligns with SemVer 2.0.0 items 10-11, which state build metadata
**MUST** be ignored when determining version precedence.

### Status

No upstream issue filed yet as of 2026-04-04.
See the draft bug report in `BUG-REPORT.vlt-build-metadata.md`

## Package Management Warnings

### Don't run `pnpm up`

It will turn `>=` in `package.json` into exact versions.

### `node-domexception` (substituted via workspace shim)

`pnpm install` previously emitted `[WARN] 1 deprecated subdependencies found: node-domexception@1.0.0`.
Install-time only; runtime was unaffected.
The override `'node-domexception': 'link:packages/shim/node-domexception'` in `pnpm-workspace.yaml`
now substitutes the deprecated upstream package with a workspace shim whose `index.cjs` is the
single line `module.exports = globalThis.DOMException`. The warning is gone; consumers
(fetch-blob, node-fetch, the libsql and gaxios subtrees) see the native `DOMException`
constructor exactly as before.

#### Dependency chain

```text
node-domexception@1.0.0
└─┬ fetch-blob@3.2.0
  ├─┬ formdata-polyfill@4.0.10
  │ └─┬ node-fetch@3.3.2
  │   ├─┬ @libsql/hrana-client@0.6.2 → @libsql/client → @libsql/kysely-libsql
  │   │                              → @monochromatic-dev/webapp-forge-server
  │   └─┬ gaxios@7.1.4 → gcp-metadata → google-auth-library → @google/genai
  │                    → @earendil-works/pi-ai → @earendil-works/pi-coding-agent
  │                    → @monochromatic-dev/pi-{morph-compact,terminal-title}
  └── node-fetch@3.3.2 [deduped]
```

`pnpm why node-domexception` reproduces this on demand.

#### Why it cannot be removed

`fetch-blob@3.2.0/from.js:3` does `import DOMException from 'node-domexception'`
and `from.js:86` calls `throw new DOMException(...)`.

`node-fetch@3.3.2/src/index.js` and `src/utils/multipart-parser.js` both import
from `fetch-blob/from.js`, so the import path executes at runtime whenever
node-fetch is loaded.

A `'fetch-blob>node-domexception': '-'` override removes the package from the
install but leaves the static import in `fetch-blob/from.js` -- node-fetch
crashes at module load.

#### Why upgrading does not help

- `node-fetch@3.3.2` is the latest published v3; v4 is in beta and still
  depends on `fetch-blob@^3.1.4`.
- `fetch-blob@4.0.0` (latest) still declares `node-domexception: ^1.0.0`.
- `formdata-polyfill@4.0.10` (latest) declares `fetch-blob: ^3.1.2`, pinning
  the v3 line.
- `@libsql/hrana-client@0.10.0` (latest) and `gaxios@7.1.4` (latest) both still
  depend on `node-fetch@^3.3.2`. Native `fetch` migration is upstream work that
  has not happened.

#### Why overriding to v2 does not help

`node-domexception@2.0.2` is also deprecated ("Use your platform's native
DOMException instead"). Critically, v2 changed the API:

- v1 `index.js`: `module.exports = globalThis.DOMException` (default export is
  the constructor).
- v2 `index.js`: side-effect-only; sets `globalThis.DOMException ??= ...` and
  exports nothing.

v2 never assigns `module.exports`, so it stays at the CJS default `{}`. Under
Node ESM, `import DOMException from 'node-domexception'` resolves to
`module.exports`, i.e. `{}`. `throw new DOMException(...)` then throws
`TypeError: DOMException is not a constructor` at runtime.

#### Why runtime is fine

v1's `index.js` ends with `module.exports = globalThis.DOMException`. On Node
17+ and Bun, `globalThis.DOMException` is the native class, so the import
yields the platform constructor. The deprecated package is a no-op shim at
runtime; the deprecation message is purely an npm-registry-level annotation
read by pnpm at install time.

#### Workaround applied

`packages/shim/node-domexception/` is the workspace shim package.
Files: `package.json` (private, name `@monochromatic-dev/shim-node-domexception`,
CJS, exports `./index.cjs` and `./index.d.cts`), `index.cjs`
(`'use strict'; module.exports = globalThis.DOMException;`), `index.d.cts`
(`declare const _: new (message?: string, name?: string) => Error; export = _;`),
plus `mise.toml` and `README.md`.

`pnpm-workspace.yaml`'s `overrides` block wires it in with
`'node-domexception': 'link:packages/shim/node-domexception'`. pnpm rewrites
every transitive `node-domexception` edge to point at the workspace path; the
real npm package is no longer installed under `node_modules/.pnpm/`.

The shim mechanism is API-identical-by-construction to `node-domexception@1.0.0`,
so every consumer of the package keeps the same observable behaviour at runtime.
The drop-in nature is what justifies the global (not parent-scoped) override.

See `docs/dependency-blocklist.md` for the mechanism reference, the decision
rule (throw / silent / remove / shim), and the worked example.

### `@google/genai` (suppressed via pnpm override)

The override line `'@earendil-works/pi-ai>@google/genai': '-'` in
`pnpm-workspace.yaml` removes `@google/genai` (and its `protobufjs`,
`google-auth-library`, `gcp-metadata`, `gaxios` subtree) from
`@earendil-works/pi-ai`'s resolved dependencies. After a clean
reinstall (`rm -rf node_modules && pnpm install`), the package is
genuinely absent from `node_modules/.pnpm/`. A non-clean `pnpm install`
or `pnpm install --force` can preserve orphan symlinks from a previous
install state; if those need clearing, `pnpm prune` removes them.

#### Why suppression is safe at the runtime layer

`@earendil-works/pi-ai` reaches `@google/genai` only through dynamic
`import()`, so pi-ai does not crash at module load when the package is
absent:

- `dist/providers/register-builtins.js:48-63` defines `createLazyStream`,
  whose returned closure invokes `loadModule()` only when the stream is
  called. The wrapper has a `.catch` that converts a module-resolution
  failure into a stream-error event.
- `dist/providers/register-builtins.js:100-118` defines
  `loadGoogleProviderModule` and `loadGoogleVertexProviderModule`, which
  call `import("./google.js")` and `import("./google-vertex.js")` lazily.
- The static `import "@google/genai"` lines live in `dist/providers/google.js:1`,
  `dist/providers/google-vertex.js:1`, and `dist/providers/google-shared.js:4`.
  All three modules are reached only via the lazy chain above; no `.js` file
  outside that chain static-imports any of them.

#### What stops working

Nothing in normal operation. `packages/pi/auto-mode` only references the
Google APIs by string identifier in `src/judge-tool.ts:83`
(`toolChoiceForApi`) and the matching unit tests, which never touch
`@google/genai`. If a Google model were ever routed through `streamSimple`,
pi-ai's `createLazyStream` catches the resolution error and emits a
stream-error event.

#### Note on `partial-json`

`@earendil-works/pi-ai>partial-json` was previously in the same override
block but cannot be suppressed: `pi-ai/dist/utils/json-parse.js:1`
statically imports `partial-json`, and that module is re-exported from
pi-ai's entry (`dist/index.js:12: export * from "./utils/json-parse.js"`).
Any consumer importing pi-ai (including `packages/pi/auto-mode`) crashes
at module load when `partial-json` is absent. The override was removed
to restore the runtime contract. The remaining `@earendil-works/pi-ai>*`
overrides target packages that pi-ai either does not import
(`chalk`, `undici`, `zod-to-json-schema`) or imports only inside lazy
provider modules (`@aws-sdk/client-bedrock-runtime`, `@google/genai`,
`@mistralai/mistralai`, `proxy-agent`).

`@earendil-works/pi-coding-agent>*` and `@earendil-works/pi-tui>*`
received the same audit. Every dep that pi-coding-agent's `dist/index.js`
re-exports through a module with a static import was removed from the
override list: `chalk`, `cli-highlight`, `diff`, `extract-zip`,
`file-type`, `glob`, `hosted-git-info`, `ignore`, `jiti` (imported as
`jiti/static`), `minimatch`, `proper-lockfile`, `strip-ansi`, `uuid`,
`yaml`. The same applies to pi-tui's `get-east-asian-width`
(`utils.js`), `koffi` (`terminal.js`), and `marked` (`markdown.js`).

The overrides retained for pi-coding-agent are:

- `@mariozechner/clipboard` -- `utils/clipboard-native.js` wraps
  `require("@mariozechner/clipboard")` in `try`/`catch`, so the missing
  package falls back to `clipboard = null`.
- `marked` -- pi-coding-agent vendors `core/export-html/vendor/marked.min.js`
  and does not statically import the npm `marked` package.

`undici` was previously retained as an override on the assumption that
"library consumers never load it." That audit missed the `bin` entry:
`package.json` maps `"pi": "dist/cli.js"`, and `dist/cli.js:8` statically
imports `undici` (it installs an `EnvHttpProxyAgent` with disabled body /
header timeouts). The workspace ships a `commit` shell alias that resolves
to `pi 'commit all'`, so the `pi` binary is a first-class consumer of this
workspace. Run-the-binary, not just import-the-library, is part of the
"reachable from each pi-* package's entry" audit. The override is gone.

The overrides retained for pi-tui are `chalk` and `mime-types`, neither
of which the dist statically imports.

After this cleanup, `mise run //packages/pi/{auto-mode,morph-compact}:test:unit`
both pass. `packages/pi/terminal-title:test:unit` fails on unrelated string
assertions (`expected '✳ X' to equal 'π X'`) that predate the override
work; those are test-fixture issues to fix separately.

### ms (kept intentionally; no override)

`pnpm install` emits no warning for `ms`; the package is not deprecated and
carries no security advisory as of 2026-05-12.
The upstream source is 3024 bytes across 162 lines, MIT-licensed, with zero
runtime dependencies.
The investigation below records why the blocklist mechanism was considered
and rejected, so future reviewers do not repeat the analysis.

#### Dependency chain

```text
ms@2.1.3
├─┬ debug@4.4.3
│ ├── @tokenizer/inflate → file-type → @earendil-works/pi-coding-agent
│ │                     → @monochromatic-dev/pi-{auto-mode,morph-compact,terminal-title}
│ ├── extract-zip → @earendil-works/pi-coding-agent [deduped]
│ ├── micromark → @monochromatic-dev/dev-script-inference-canary-viewer
│ │             → @monochromatic-dev/webapp-content-messages-demo
│ │             → mdast-util-from-markdown → remark-* → @mdx-js/mdx
│ │             → @monochromatic-dev/webapp-content-ssg-test
│ └── stylelint → @monochromatic-dev/config-stylelint
│                → stylelint-config-recommended → stylelint-config-standard
│                → monochromatic (workspace root devDependency)
└─┬ logform@2.7.0
  ├── winston → neovim → @monochromatic-dev/mcp-nvim
  └── winston-transport → winston [deduped]
```

`pnpm why ms` reproduces this on demand.
No workspace package imports `ms` directly; the only declared consumers are
`debug@4.4.3` and `logform@2.7.0`.

#### API surface used

Both consumers call `ms(number)` for the short-form duration humaniser and
nothing else.

- `debug/src/common.js:14` assigns `createDebug.humanize = require('ms')`,
  and `debug` calls `ms(this.diff)` to produce log prefixes such as `+2m`.
- `logform/ms.js:4` imports `ms`; `logform/ms.js:15` writes
  `info.ms` as a template literal that prepends `+` to `ms(this.diff)`.

Neither path uses the string-parser overload (`ms('2 days')`) or the
`{ long: true }` formatter option.

#### Why each blocklist action was rejected

- Removal (`'ms': '-'` in `pnpm-workspace.yaml`):
  `debug/src/common.js:14` hard-requires `ms` at module load.
  A missing module crashes every code path that loads `debug` with
  `MODULE_NOT_FOUND`, which transitively breaks stylelint, micromark,
  pi-coding-agent, and every workspace target listed in the chain above.
- Throwing stub (`POLICY` entry with `action: 'throw'` in `.pnpmfile.mjs`):
  loading the workspace stub throws at the same import site.
  Same crash as removal, with a custom error message; not a viable
  replacement.
- Silent stub (`POLICY` entry with `action: 'silent'` in `.pnpmfile.mjs`):
  the call returns the callable Proxy defined in
  `packages/stub/silent/index.cjs:3-19`.
  Embedding the result in a template literal (the consumer pattern at
  `logform/ms.js:15`) triggers primitive coercion.
  Every Proxy `get` returns the Proxy itself, including `Symbol.toPrimitive`,
  so coercion fails with
  `TypeError: Cannot convert object to primitive value`.
  The build does not stay green.
- API-compatible shim (`packages/shim/ms/` wired via a `link:` override in
  `pnpm-workspace.yaml`):
  the pattern works technically; the precedent is
  `packages/shim/node-domexception/`.
  The cost is one new workspace package (implementation, type declaration,
  tests, README, mise.toml) plus this audit-trail entry, set against no
  current trigger.
  The upstream package is not deprecated, has no advisory, and emits no
  install warning.
  A reimplementation must reproduce upstream behaviour exactly: rounding
  boundaries, the 1.5x plural threshold for the long form, the 100-character
  parse cap, and `NaN` / non-finite handling.
  The downstream `debug` output is read by tooling across the ecosystem;
  subtle deviation regresses log fixtures.
  The maintenance burden and regression risk outweigh the marginal
  governance benefit of removing one well-behaved transitive.

#### Conditions for revisiting

Reopen the question when any of the following occurs:

- Upstream `ms` is deprecated, or pnpm starts emitting an install warning
  for it.
- A security advisory is filed against any maintained `ms` release.
- The package's license changes from MIT.
- A workspace package gains a direct `import 'ms'`, making first-party
  code subject to the policy.
- A workspace-wide policy is adopted that bans unjustified external
  transitive dependencies regardless of pain point.

The `@types/ms@2.1.0` types-only package, pulled in via
`micromark → @types/debug → @types/ms`, is left in place for the same
reason: no runtime impact, no install warning, no advisory.
If a shim is ever introduced, override `@types/ms` to `'-'` so the
workspace shim's own `index.d.cts` owns the types.

See `docs/dependency-blocklist.md` for the decision rule
(throw / silent / remove / shim) and the `node-domexception` entry above
for the worked example of the API-compatible shim path.

### `proper-lockfile` (substituted via workspace shim)

The upstream `proper-lockfile@4.1.2` (moxystudio/node-proper-lockfile, last
commit 2021-01) is abandoned. It enters the resolved graph as a transitive
of `@earendil-works/pi-coding-agent@0.74.0`:
`proper-lockfile@4.1.2 → @earendil-works/pi-coding-agent → @monochromatic-dev/pi-auto-mode`.
`pnpm why proper-lockfile` reproduces the chain.

The override `'proper-lockfile': 'link:packages/shim/proper-lockfile'` in
`pnpm-workspace.yaml` substitutes the abandoned upstream with a workspace shim
whose `index.cjs` implements `lockSync(path, options)` and
`lock(path, options)` via `node:fs.mkdirSync` on a sibling `.<basename>.lock`
directory. The shim is decoupled from the silent stub's thenable trap (see
below), so both the sync withLock and async withLockAsync paths in
pi-coding-agent work unchanged.

#### Why it cannot be removed

The two consumer modules inside pi-coding-agent both hard-import the package
at module scope:

- `dist/core/auth-storage.js:12` -- `import lockfile from "proper-lockfile";`
- `dist/core/settings-manager.js:4` -- `import lockfile from "proper-lockfile";`

Both modules are re-exported from the package's barrel:

- `dist/index.js:6` -- `export { AuthStorage, FileAuthStorageBackend, InMemoryAuthStorageBackend } from "./core/auth-storage.js";`
- `dist/index.js:22` -- `export { SettingsManager } from "./core/settings-manager.js";`

A `'proper-lockfile': '-'` override removes the package from the install but
leaves the static import in `auth-storage.js` and `settings-manager.js` --
loading `@earendil-works/pi-coding-agent` from `packages/pi/auto-mode` crashes
with `Cannot find package 'proper-lockfile'` before any first-party code runs.

#### Why the silent stub does not work

`packages/stub/silent/index.cjs` is a `Proxy` over a no-op function whose
`get` trap returns `module.exports` for every property. That makes the stub
a thenable: `await stub` enters the Promise-resolution machinery, calls
`stub.then(resolve, reject)`, the `apply` trap returns the stub (neither
callback is invoked), and the await never settles.

Consequence:

- Sync path (`SettingsManager` startup load, `settings-manager.js:69` only
  acquires the lock when the settings file already exists; sync release
  returns the Proxy itself, the `release()` call is harmless): works.
- Async path (`AuthStorage.getApiKey` during model resolution, reachable
  from `core/model-registry.js:519` and `:585`): `release = await lockfile.lock(...)`
  hangs on the thenable trap. The pi CLI hangs on startup model lookup.

A `then` carve-out in the silent stub would fix this, but the workspace
silent stub does not currently have one, and editing the stub to add it
weakens the contract for every other policy entry.

#### Why upgrading does not help

`proper-lockfile@4.1.2` is the latest published version (the repo's last
commit is from 2021-01). Upstream is unmaintained; there is no upgrade path.

#### Runtime call sites exercised by the shim

Every pi invocation reaches one or both of these paths:

- `dist/main.js:377` -- `SettingsManager.create(cwd, agentDir)` runs at
  startup. `FileSettingsStorage` only calls `lockfile.lockSync` when the
  settings file already exists (`settings-manager.js:69`); on a fresh
  machine, the sync lock is skipped until the file is created.
- `dist/main.js:408` -- `AuthStorage.create()` runs at startup.
- `dist/core/sdk.js:90,92`, `dist/core/agent-session-services.js:56,57`,
  `dist/core/resource-loader.js:121`, `dist/package-manager-cli.js:304,358`
  -- defaulted SDK construction; same call shape.
- `dist/core/model-registry.js:519` -- `await this.authStorage.getApiKey(model.provider, ...)`
  runs during model resolution. `FileAuthStorageBackend.getApiKey` goes through
  `withLockAsync`, which does `release = await lockfile.lock(...)` and
  `await release()`. Both ends of the async lock contract must execute
  correctly for `pi` to start.

#### Shim contract and known simplifications

Implemented:

- `lockSync(path, options)`: synchronous, atomic `mkdirSync` of `.<basename>.lock`
  in the target's parent directory. Throws an `Error` with `code === 'ELOCKED'`
  on `EEXIST`. Callers handle retries themselves (`auth-storage.js:32-54`
  and `settings-manager.js:38-60` both wrap the call in a 10-attempt sync
  retry loop with a 20ms busy-wait between attempts).
- `lock(path, options)`: async with internal retry per `options.retries`
  (number or object). Backoff is exponential by `factor` starting at
  `minTimeout`, capped by `maxTimeout`. The return value is a callable
  release function; `await release()` works because `await undefined`
  resolves immediately.

Omitted (relative to upstream):

- No `fs.realpath` resolution. Both pi-coding-agent callsites always pass
  `{ realpath: false }` (`auth-storage.js:38`, `settings-manager.js:44`),
  so the shim treats every target as already-resolved.
- No stale-lock detection. If pi crashes while holding the lock, the next
  invocation throws ELOCKED until the user removes
  `<agentDir>/.auth.json.lock` or `<agentDir>/.settings.json.lock` manually.
- No `onCompromised` callback. The option is accepted but never invoked;
  pi-coding-agent's `lockCompromised` flag stays false, so its
  `throwIfCompromised()` checks are no-ops.
- No `retries.randomize` jitter. Backoff is deterministic.

The workspace does not run concurrent pi instances, so the omissions are
acceptable. A `pi` crash recovery would require manual `rmdir` on the lock
directory.

#### Verification caveat

The plan's verification step that runs
`node -e "import('@earendil-works/pi-coding-agent').then(...)"` only proves
the module loads through the shim resolution. It does not exercise
`withLockAsync` under a real `getApiKey` call. The earlier steps
(direct shim probes for sync acquire, async acquire, ELOCKED throw)
cover the shim contract; the end-to-end `pi --help` step covers `SettingsManager.create`
but only reaches the sync lock acquisition when `<agentDir>/settings.json`
already exists (see `settings-manager.js:69`). To exercise the async lock
path during verification on a fresh host, run `pi` once interactively or
seed `<agentDir>/settings.json` with `{}` before re-running `pi --help`.

See `docs/decisions/proper-lockfile-removal.md` for the decision rationale
(why a shim was preferred over silent stub or pure removal) and
`docs/dependency-blocklist.md` for the policy reference.
