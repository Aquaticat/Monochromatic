# Package Management & Dependencies Troubleshooting

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

### `[WARN] 1 deprecated subdependencies found: node-domexception@1.0.0`

Emitted by `pnpm install`. Install-time only; runtime is unaffected. Cannot
be silenced without breaking runtime, and cannot be silenced by upgrading any
direct dependency. Document and ignore.

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

#### Verified workaround paths (not applied)

A workspace shim package re-exporting `globalThis.DOMException`, wired via
`overrides: { 'node-domexception': 'link:packages/shim/node-domexception' }`,
would silence the warning without breaking runtime. Not worth the package for
an install-time-only message; revisit if the warning ever blocks a CI gate.

