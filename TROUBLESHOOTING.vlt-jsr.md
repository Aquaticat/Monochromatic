# vlt + JSR: version-specific manifest endpoint 404

**Status**: Unreported as of 2026-04-04. Discovered during Bun-to-vlt migration.
**Affects**: vlt 1.0.0-rc.24 (latest) with any `@jsr/*` transitive dependency
**Root cause**: Dual bug -- JSR's npm bridge omits a standard endpoint, and vlt has no fallback

## Reproduction

Any npm package that transitively depends on `@jsr/*` packages will fail during `vlt install`.
Minimal case: `happy-opfs@2.0.2` depends on `"@std/path": "npm:@jsr/std__path@^1.1.4"`.

```bash
mkdir /tmp/vlt-jsr-repro && cd /tmp/vlt-jsr-repro
echo '{ "dependencies": { "happy-opfs": ">=2.0.2" } }' > package.json
echo '{ "config": { "scope-registries": { "@jsr": "https://npm.jsr.io/" } } }' > vlt.json
vlt install
# Error: failed to fetch manifest
# url: https://npm.jsr.io/@jsr/std__path/1.1.4
```

Without `scope-registries`, the error is instead a 404 on `registry.npmjs.org/@jsr/std__path`
(the package doesn't exist on npmjs.org at all).

## The two bugs

### Bug 1: JSR's npm bridge does not implement `GET /<package>/<version>`

The npm registry API includes a version-specific manifest endpoint:
`GET https://registry.npmjs.org/@types/node/22.0.0` returns 200.

JSR's `npm.jsr.io` does not implement this:
`GET https://npm.jsr.io/@jsr/std__path/1.1.4` returns 404.

The full packument endpoint works fine:
`GET https://npm.jsr.io/@jsr/std__path` returns 200.

**Root cause in JSR source** (`jsr-io/jsr`):
`npm.jsr.io` is a Cloudflare Worker (`lb/main.ts:89-119`) that proxies to R2 static storage.
The R2 bucket stores only the full packument at the `@jsr/scope__name` key
(`api/src/s3_paths.rs:62-71`). No per-version objects are stored,
so the version-specific URL path maps to a nonexistent R2 key.

Other registries also have partial support:
GitHub Packages (`npm.pkg.github.com`) returns 405 for the same pattern.

### Bug 2: vlt has no fallback when the version-specific endpoint fails

In `src/package-info/src/index.ts`:

```typescript
// Line 601-608: isSingle branch uses version-specific endpoint exclusively
const mani = spec.range?.isSingle
  ? await this.#registryManifestRequest(spec, options,) // /<pkg>/<version>
  : pickManifest(
    await this.packument(f, options,), // /<pkg> (full)
    spec,
    options,
  );
```

```typescript
// Line 407: Constructs the version-specific URL
const pakuURL = new URL(`${name}/${version}`, registry,);

// Line 413-423: Throws immediately on non-200, no fallback
if (response.statusCode !== 200) {
  throw this.#resolveError(spec, options, 'failed to fetch manifest', {
    url: pakuURL,
    response,
  },);
}
```

vlt already knows JSR registries are different -- it skips tarball URL guessing
for JSR at `spec/src/browser.ts:648-651`. But the equivalent carve-out is
missing from the manifest resolution path.

## Why vlt's built-in JSR support doesn't help

vlt has `defaultScopeRegistries = { '@jsr': 'https://npm.jsr.io/' }` in
`spec/src/browser.ts:57-58`, which should auto-route `@jsr/*` packages.
However, `getOptions()` at line 72 uses `options?.['scope-registries'] ?? {}`
which does NOT merge `defaultScopeRegistries`. The defaults are only merged
during lockfile loading (`graph/src/transfer-data/load.ts:48-51`),
not during fresh resolution.

This means on a first install (no lockfile), `@jsr/*` transitive deps
fall through to `registry.npmjs.org` unless you manually configure
`scope-registries` in `vlt.json`.

Even when you DO configure it, Bug 2 (the version-specific 404) blocks the install.

## Possible fixes

### vlt side (either would work)

**Option A**: Fall back to full packument on 404 in `#registryManifestRequest`:

```typescript
if (response.statusCode !== 200) {
  // Fall back to full packument for registries that don't support /<pkg>/<version>
  return pickManifest(
    await this.packument(spec.final, options,),
    spec,
    options,
  );
}
```

**Option B**: Skip the `isSingle` optimization for JSR scope-registries,
similar to the existing tarball guess skip.

**Option C**: Merge `defaultScopeRegistries` into `getOptions()` so `@jsr`
routing works out of the box on first install:

```typescript
// browser.ts line 72, currently:
'scope-registries': options?.['scope-registries'] ?? {},
// should be:
'scope-registries': {
  ...defaultScopeRegistries,
  ...(options?.['scope-registries'] ?? {}),
},
```

### JSR side

Implement the `GET /<package>/<version>` endpoint by extracting the relevant
version from the full packument JSON already stored in R2. This could be done
in the Cloudflare Worker without changing R2 storage.

## Workaround attempts (all failed)

- `scope-registries` for `@jsr` -- routes correctly but hits Bug 2 (version endpoint 404)
- `jsr:` protocol in catalog entries -- works for direct deps but not their transitive `@jsr/*` deps
- Using npm versions of JSR packages -- works for some (zod, @optique/*) but not all;
  some npm packages like `happy-opfs` have `@jsr/*` transitive deps baked into their package.json
- Removing `scope-registries` -- `@jsr/*` packages 404 on npmjs.org instead

## Issues to file

- **vltpkg/vltpkg**: "package-info: version-specific manifest request 404s on registries that only serve full packuments (JSR, GitHub Packages)"
  - Include: repro steps, source code references, proposed fix (Option A is the safest)
  - Note the `defaultScopeRegistries` merge gap as a separate issue

- **jsr-io/jsr**: "npm.jsr.io does not implement version-specific packument endpoint (GET /@jsr/pkg/version)"
  - Include: comparison with npmjs.org behavior, impact on vlt (and potentially other PMs)
  - Note that pnpm had a related but different issue (pnpm/pnpm#10915 -- tarball URL stripping)

## Environment

- vlt: 1.0.0-rc.24 (latest as of 2026-04-04)
- Node.js: 25.9.0
- Triggering package: `happy-opfs@2.0.2` -> `@jsr/std__path@^1.1.4`
- JSR source examined: `jsr-io/jsr` main branch, `lb/main.ts` and `api/src/s3_paths.rs`
- vlt source examined: `vltpkg/vltpkg` main branch, `src/package-info/src/index.ts`
