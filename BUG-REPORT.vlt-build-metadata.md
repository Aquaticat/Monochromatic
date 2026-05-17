# Draft bug report for vltpkg/vltpkg

Filed from: Monochromatic monorepo, vlt 1.0.0-rc.24, Node.js v25.9.0, Linux x86_64
Re-verified at vltpkg/vltpkg commit `8ece488d` (tag `v1.0.0-rc.29-1`), Node v26.1.0, Linux x86_64

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

```text
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
this.registrySpec = this.bareSpec;
```

When `bareSpec` is `"1.0.0-dev.1692+5c265bd4"`, `registrySpec` retains the `+` suffix.

### 2. Manifest URL includes unstripped build metadata

`src/package-info/src/index.ts:476-478` (rc.29; was `:405-407` at rc.24):

```ts
const version = hasLeadingRange ? registrySpec.slice(1,) : registrySpec;
const pakuURL = new URL(`${name}/${version}`, registry,);
```

`version` is `"1.0.0-dev.1692+5c265bd4"`. The `new URL()` call preserves `+` literally
in the path component. The npm registry does not serve versions at paths containing `+`.

### 3. Single-version fast path is the only affected code path

`src/package-info/src/index.ts:714-716` (rc.29; was `:601-603` at rc.24):

```ts
const mani = spec.range?.isSingle
  ? await this.#registryManifestRequest(spec, options,)
  : pickManifest(await this.packument(f, options,), spec, options,);
```

Version specs with build metadata parse as `isSingle === true`, triggering the
per-version manifest fetch. Range specs (`>=1.0.0-dev.0`) go through the full
packument path, which fetches by package name only and is not affected.

## Suggested fix

**Option A: strip in `#registryManifestRequest` (minimal, targeted):**

```ts
// src/package-info/src/index.ts
const version = hasLeadingRange ? registrySpec.slice(1,) : registrySpec;
const versionClean = version.replace(/\+.*$/, '',);
const pakuURL = new URL(`${name}/${versionClean}`, registry,);
```

**Option B: strip in Spec parser (comprehensive, prevents downstream issues):**

```ts
// src/spec/src/browser.ts:644
this.registrySpec = this.bareSpec.replace(/\+.*$/, '',);
```

Option B is more comprehensive but changes the Spec's stored value,
which could affect lockfile serialization or other consumers that rely on
the full semver string. Option A is safer as a first fix.

Both options align with SemVer 2.0.0 spec items 10-11:

> "Build metadata MUST be ignored when determining version precedence."

The `conventionalRegistryTarball` getter (which constructs the guessed tarball URL)
may also need patching for completeness. In the verified end-to-end repro,
Option A alone unblocks `vlt install`: the registry's manifest response carries
the build-metadata-stripped `dist.tarball`, so the guessed tarball URL is
not exercised on the success path. Patch it if you want belt-and-suspenders
coverage for registries that omit `dist.tarball`.

### Verification of Option A

Cloned `vltpkg/vltpkg` at commit `8ece488d` (`v1.0.0-rc.29-1`) into a fresh
`mktemp -d` workspace, bootstrapped with the published rc.29 (`vlt install`
in the monorepo), then ran the source-tree
`scripts/bins/vlt` against a one-line `package.json`
(`{"dependencies":{"@optique/run":"1.0.0-dev.1692"}}`).

Pre-patch, `vlt install` failed:

```text
Resolve Error: failed to fetch manifest
  While fetching: https://registry.npmjs.org/@optique/core/1.0.0-dev.1692+5c265bd4
  Response: { statusCode: 404, … }
```

Post-Option-A patch, `vlt install` exited 0, added both
`@optique/run@1.0.0-dev.1692` and `@optique/core@1.0.0-dev.1692`,
and wrote a valid `vlt-lock.json`. The fetched `@optique/core` tarball's
own `package.json` still records `"version": "1.0.0-dev.1692+5c265bd4"`,
which is preserved unchanged on disk.

The existing leading-prefix-strip test
(`src/package-info/test/index.ts:661`, "manifest strips leading semver
characters") covers the same URL-construction block this patch extends
and remains green under Option A; it exercises `=/^/~/v` prefixes and
the new `+`-suffix strip slots in alongside without altering that
behaviour.

`src/package-info` test suite under Node v26.1.0: 141 of 148 pass
post-patch, identical pre-patch. The 7 failures (`cache hit - manifest
returned from cache` and 6 sibling subtests in `cache manifests`) hit
`The property 'options.recursive' is no longer supported. Received true`,
the Node v26 removal of `recursive` from `fs.cp` / `fs.cpSync`. They are
unrelated to manifest URL construction.

## Why this is rare

npm has stripped `+<build>` from version strings at publish time since 2014
(npm/npm#6379). The public npm registry has zero packages with build metadata
in version keys. The trigger requires a package that pins a dependency specifier
to an exact version with build metadata; dependency specifier strings are
not stripped by `npm publish`, only the `version` field is. The `@optique` project
does this because its release toolchain writes `+<git-sha>` into both fields.

npm, pnpm, and yarn all handle this case by stripping or ignoring build metadata
before making registry requests.

## Environment

Original report:

- vlt: 1.0.0-rc.24
- Node.js: v25.9.0
- OS: Linux 6.17.7-ba29.fc43.x86_64 (Fedora/Bazzite)
- Registry: <https://registry.npmjs.org/>

Constraint-5 re-verification (2026-05-17):

- vlt: 1.0.0-rc.29 + 1 commit, source tree at `8ece488d`
- Node.js: v26.1.0
- OS: Linux 6.19.14-ogc5.1.fc44.x86_64 (Fedora/Bazzite)
- Registry: <https://registry.npmjs.org/>
