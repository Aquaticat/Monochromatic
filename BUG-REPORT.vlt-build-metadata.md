# Draft bug report for vltpkg/vltpkg

Filed from: Monochromatic monorepo, vlt 1.0.0-rc.24, Node.js v25.9.0, Linux x86_64

---

**Title:** `failed to fetch manifest` when a dependency spec contains semver build metadata (`+suffix`)

## Description

`vlt install` fails with `ERESOLVE` / `failed to fetch manifest` when any package
in the dependency graph declares a dependency using an exact version that includes
semver build metadata (the `+<hash>` suffix).

The npm registry strips build metadata from version keys at publish time,
so the version `1.0.0-dev.1692+5c265bd4` is stored as `1.0.0-dev.1692`.
vlt constructs a per-version manifest URL that includes the `+` suffix verbatim,
which the registry does not recognize.

## Reproduction

### Minimal reproduction

Any `package.json` that depends on a package whose transitive dependency graph
contains a build-metadata-tagged version spec:

```json
{
  "dependencies": {
    "@optique/run": "1.0.0-dev.1692"
  }
}
```

`@optique/run@1.0.0-dev.1692` declares `"@optique/core": "1.0.0-dev.1692+5c265bd4"`
in its `dependencies`. This triggers the bug.

```sh
mkdir /tmp/vlt-repro && cd /tmp/vlt-repro
echo '{"dependencies":{"@optique/run":"1.0.0-dev.1692"}}' > package.json
vlt install
```

### Expected behavior

vlt strips build metadata from the version string before constructing the registry URL,
fetches `https://registry.npmjs.org/@optique/core/1.0.0-dev.1692` (200 OK),
and installs successfully.

### Actual behavior

vlt constructs `https://registry.npmjs.org/@optique/core/1.0.0-dev.1692+5c265bd4`,
which returns 404, and throws:

```
Error: failed to fetch manifest
  [cause]: {
    code: 'ERESOLVE',
    spec: Spec2 {
      type: 'registry',
      spec: '@optique/core@1.0.0-dev.1692+5c265bd4',
      registrySpec: '1.0.0-dev.1692+5c265bd4',
      overridden: false,
    },
    url: https://registry.npmjs.org/@optique/core/1.0.0-dev.1692+5c265bd4,
  }
```

### Registry verification

```sh
# Works -- version without build metadata
curl -I "https://registry.npmjs.org/@optique/core/1.0.0-dev.1692"
# HTTP/2 200

# Fails -- version with build metadata (literal +)
curl -I "https://registry.npmjs.org/@optique/core/1.0.0-dev.1692+5c265bd4"
# HTTP/2 404

# Fails -- version with URL-encoded + (%2B)
curl -I "https://registry.npmjs.org/@optique/core/1.0.0-dev.1692%2B5c265bd4"
# HTTP/2 404
```

## Root cause analysis

The bug spans two files in the vltpkg/vltpkg monorepo:

### 1. Spec parser preserves build metadata verbatim

`src/spec/src/browser.ts:644`:

```ts
this.registrySpec = this.bareSpec
```

When `bareSpec` is `"1.0.0-dev.1692+5c265bd4"`, `registrySpec` retains the `+` suffix.

### 2. Manifest URL includes unstripped build metadata

`src/package-info/src/index.ts:405-407`:

```ts
const version =
  hasLeadingRange ? registrySpec.slice(1) : registrySpec
const pakuURL = new URL(`${name}/${version}`, registry)
```

`version` is `"1.0.0-dev.1692+5c265bd4"`. The `new URL()` call preserves `+` literally
in the path component. The npm registry does not serve versions at paths containing `+`.

### 3. Single-version fast path is the only affected code path

`src/package-info/src/index.ts:601-603`:

```ts
const mani =
  spec.range?.isSingle ?
    await this.#registryManifestRequest(spec, options)
  : pickManifest(await this.packument(f, options), spec, options)
```

Version specs with build metadata parse as `isSingle === true`, triggering the
per-version manifest fetch. Range specs (`>=1.0.0-dev.0`) go through the full
packument path, which fetches by package name only and is not affected.

## Suggested fix

**Option A -- strip in `#registryManifestRequest` (minimal, targeted):**

```ts
// src/package-info/src/index.ts
const version =
  hasLeadingRange ? registrySpec.slice(1) : registrySpec
const versionClean = version.replace(/\+.*$/, '')
const pakuURL = new URL(`${name}/${versionClean}`, registry)
```

**Option B -- strip in Spec parser (comprehensive, prevents downstream issues):**

```ts
// src/spec/src/browser.ts:644
this.registrySpec = this.bareSpec.replace(/\+.*$/, '')
```

Option B is more comprehensive but changes the Spec's stored value,
which could affect lockfile serialization or other consumers that rely on
the full semver string. Option A is safer as a first fix.

Both options align with SemVer 2.0.0 spec items 10-11:
> "Build metadata MUST be ignored when determining version precedence."

The `conventionalRegistryTarball` getter (which constructs the guessed tarball URL)
has the same issue and would also need patching if Option A is chosen.

## Why this is rare

npm has stripped `+<build>` from version strings at publish time since 2014
(npm/npm#6379). The public npm registry has zero packages with build metadata
in version keys. The trigger requires a package that pins a dependency specifier
to an exact version with build metadata -- dependency specifier strings are
not stripped by `npm publish`, only the `version` field is. The `@optique` project
does this because its release toolchain writes `+<git-sha>` into both fields.

npm, pnpm, and yarn all handle this case by stripping or ignoring build metadata
before making registry requests.

## Environment

- vlt: 1.0.0-rc.24
- Node.js: v25.9.0
- OS: Linux 6.17.7-ba29.fc43.x86_64 (Fedora/Bazzite)
- Registry: https://registry.npmjs.org/
