# pnpm lockfile v9 records npm registry tarball integrity as sha512 because npm publish and SRI use SHA-2 tokens

> Scratch-path note:
> `/tmp/agent` paths in this document are historical.
> Use `~/temp/agent` for current work.

This document explains why dependency entries in `pnpm-lock.yaml` commonly use `sha512-...` for
`resolution.integrity`.
It also explains why browser Subresource Integrity (SRI) is limited to these tokens:

- `sha256`
- `sha384`
- `sha512`

SHA-3,
 BLAKE2,
 and BLAKE3 are not in the current SRI set.
That is a web-platform interoperability decision,
 not a finding that those hashes are bad.

The behavior is not a bug.
It is an intentional compatibility path across npm registry metadata,
 pnpm lockfile serialization,
 and
browser-facing SRI syntax.

## Symptom

A pnpm lockfile contains package-resolution entries like this:

```yaml
# pnpm-lock.yaml
'@csstools/css-tokenizer@4.0.0':
  resolution:
    integrity: sha512-QxULHAm7cNu72w97JUNCBFODFaXpbDg+dP8b/oWFAZ2MTRppA3U00Y2L1HqaS4J6yBqxwa/...
```

This can look surprising when the project otherwise sees `sha256` checksums,
or when faster modern hash functions,
 for example BLAKE3,
 seem attractive.

This document is scoped to dependency tarball integrity entries under package `resolution` records.
Other pnpm lockfile fields can use different checksums for different purposes,
 for example
`packageExtensionsChecksum: sha256-...` and `pnpmfileChecksum: sha256-...` in this repository's lockfile.

## Root cause

### Step 1: npm publish writes SHA-512 into `dist.integrity`

The npm CLI publish code sets SHA-512 as the default publish-time integrity algorithm.
In npm CLI commit `abf78b3c143a1825de910c0e401d01c0d3f5199b`,
`workspaces/libnpmpublish/lib/publish.js:25-30` sets `algorithms` to `['sha512']`:

```js
// /tmp/agent/npm-cli-sha512-check/workspaces/libnpmpublish/lib/publish.js
opts = {
  access: null,
  algorithms: ['sha512'],
  defaultTag: 'latest',
  ...opts,
  spec,
}
```

The same source computes both SHA-1 and SHA-512 over the tarball bytes.
It stores SHA-512 in the modern `dist.integrity` field.
It keeps SHA-1 only in the legacy `dist.shasum` field.
`workspaces/libnpmpublish/lib/publish.js:111-120`:

```js
// /tmp/agent/npm-cli-sha512-check/workspaces/libnpmpublish/lib/publish.js
const integrity = ssri.fromData(tarballData, {
  algorithms: [...new Set(['sha1'].concat(algorithms))],
})

manifest._id = `${manifest.name}@${manifest.version}`
manifest.dist = { ...manifest.dist }
// Don't bother having sha1 in the actual integrity field
manifest.dist.integrity = integrity.sha512[0].toString()
// Legacy shasum support
manifest.dist.shasum = integrity.sha1[0].hexDigest()
```

So modern npm registry metadata normally exposes both fields:

```json
{
  "dist": {
    "integrity": "sha512-...",
    "shasum": "..."
  }
}
```

### Step 2: pnpm copies `dist.integrity` into the lockfile

The pnpm npm resolver writes the selected package's registry `dist` data into a resolution object.
In pnpm commit `c18cbd4cad22be4c94c97af734990a82a96bb029`,
`resolving/npm-resolver/src/index.ts:588-591` records `getIntegrity(pickedPackage.dist)` as
`resolution.integrity`:

```ts
// /tmp/agent/pnpm-sha512-check/resolving/npm-resolver/src/index.ts
const id = `${pickedPackage.name}@${pickedPackage.version}` as PkgResolutionId
const resolution = {
  integrity: getIntegrity(pickedPackage.dist),
  tarball: normalizeRegistryUrl(pickedPackage.dist.tarball),
}
```

The helper returns registry `dist.integrity` when present.
It only falls back to legacy SHA-1 `dist.shasum` when no `dist.integrity` exists.
`resolving/npm-resolver/src/index.ts:1056-1068`:

```ts
// /tmp/agent/pnpm-sha512-check/resolving/npm-resolver/src/index.ts
function getIntegrity (dist: {
  integrity?: string
  shasum: string
  tarball: string
}): string | undefined {
  if (dist.integrity) {
    return dist.integrity
  }
  if (!dist.shasum) {
    return undefined
  }
  const integrity = ssri.fromHex(dist.shasum, 'sha1')
```

So `pnpm-lock.yaml` has `sha512-...` because the npm registry metadata that pnpm received has
`dist.integrity: "sha512-..."`.

### Step 3: SRI standardized only three SHA-2 tokens

SRI's current source names exactly three valid algorithm tokens.
In `w3c/webappsec-subresource-integrity` commit `632bf53a241e927330e491d909da8f0b6ae5f4b2`,
`index.bs:190-199` defines the valid token set:

```text
// /tmp/agent/webappsec-subresource-integrity-doc/index.bs
The SHA-256, SHA-384, and SHA-512 are part
of the SHA-2 set of cryptographic hash functions defined by the
NIST. [[!SHA2]]

The valid SRI hash algorithm token set is the [=ordered set=]
« "`sha256`", "`sha384`", "`sha512`" » (corresponding to [=SHA-256=],
[=SHA-384=], and [=SHA-512=] respectively). The ordering of this set is
meaningful, with stronger algorithms appearing later in the set.
```

The same file gives the priority rule at `index.bs:325-332`:

```text
// /tmp/agent/webappsec-subresource-integrity-doc/index.bs
The prioritization of hash algorithms is specified via the ordering of their
respective tokens in the [=valid SRI hash algorithm token set=]. Algorithms
appearing earlier in that set are weaker than algorithms appearing later in
that set.

As currently specified, [=SHA-256=] is weaker than [=SHA-384=], which is in
turn weaker than [=SHA-512=]. No other hashing algorithms are currently
supported by this specification.
```

The security guidance excludes known-weak hashes,
 not every hash outside the set.
`index.bs:689-693` says:

```text
// /tmp/agent/webappsec-subresource-integrity-doc/index.bs
Digests are only as strong as the hash function used to generate them. It is
recommended that user agents refuse to support known-weak hashing functions and
limit supported algorithms to those known to be collision resistant. Examples of
hashing functions that are not recommended include MD5 and SHA-1. At the time of
writing, SHA-384 is a good baseline.
```

### Step 4: SRI reuses CSP hash syntax

SRI encodes integrity metadata in the same style as CSP hash sources.
The CSP source grammar also names exactly those SHA-2 tokens.
In `w3c/webappsec-csp` commit `4e01ae77ba0a252b9e6662ee14d92461eedbd9a3`,
`index.bs:708-709` defines the hash syntax:

```text
// /tmp/agent/webappsec-csp-doc/index.bs
<dfn>hash-source</dfn>    = "'" <a>hash-algorithm</a> "-" <a>base64-value</a> "'"
<dfn>hash-algorithm</dfn> = "sha256" / "sha384" / "sha512"
```

That syntax choice matters for interoperability.
A browser SRI value is not a general-purpose digest label.
It is a web-platform syntax with a small required implementation set.

### Step 5: SHA-3 and BLAKE were not rejected as bad hashes

The upstream SRI tracker has separate feature requests for these algorithms:

- `w3c/webappsec-subresource-integrity#11`,
   `SHA-3/Keccak`,
   opened in 2015.
- `w3c/webappsec-subresource-integrity#104`,
   `Add support for BLAKE hashes in subresource integrity`,
  opened in 2021.

The issue history shows standards-process and browser-implementation blockers,
 not a cryptographic rejection.

For SHA-3,
 an SRI editor wrote on `#11` that adding SHA-3 to SRI v1 would move SRI away from the
two shipping compliant implementations.
Later,
 Chromium participants said SHA-3 was unlikely without BoringSSL support.
Adam Langley summarized the browser-side cost in that thread:
 adding primitives costs implementation time,
validation and compliance time,
 code size,
 and testing across protocols.
He also stated that SHA-256 and SHA-512 already provide secure hash functions for this use case.

For BLAKE,
 an SRI collaborator wrote on `#104` that web standards depend on what browsers agree to implement.
That thread also says W3C Recommendation status needs more than two interoperable implementations,
and that the BLAKE functions were relatively new when SRI was specified.
The suggested path was an explainer,
 spec pull request,
 and browser implementation work.

BLAKE3 was announced after SRI v1 reached W3C Recommendation status,
so it could not have been part of the original interoperable set.

## Verification

### Versions and sources checked

- Project lockfile:
   `/var/home/user/Monochromatic/pnpm-lock.yaml`,
   `lockfileVersion: '9.0'`.
- pnpm source:
   `pnpm/pnpm` at `c18cbd4cad22be4c94c97af734990a82a96bb029`.
- npm CLI source:
   `npm/cli` at `abf78b3c143a1825de910c0e401d01c0d3f5199b`.
- SRI source:
   `w3c/webappsec-subresource-integrity` at `632bf53a241e927330e491d909da8f0b6ae5f4b2`.
- CSP source:
   `w3c/webappsec-csp` at `4e01ae77ba0a252b9e6662ee14d92461eedbd9a3`.
- Upstream SRI tracker:
   `w3c/webappsec-subresource-integrity#11` and `#104`.

### Local lockfile catalog

This repository's dependency tarball integrity entries are all SHA-512:

```bash
# /var/home/user/Monochromatic
node --input-type=module <<'JS'
import { readFileSync } from 'node:fs'

const text = readFileSync('pnpm-lock.yaml', 'utf8')
const counts = {}

for (const match of text.matchAll(/integrity:\s*(sha[0-9]+)-/g)) {
  counts[match[1]] = (counts[match[1]] ?? 0) + 1
}

console.log(JSON.stringify(counts, null, 2))
JS
```

Observed output:

```json
{
  "sha512": 772
}
```

This verifies the concrete lockfile symptom for dependency tarball integrity entries.
It does not say every checksum-like field in the lockfile uses SHA-512.

### Registry metadata catalog

Fetching one package that appears in this repository's lockfile shows registry metadata with these fields:

- `dist.integrity` as SHA-512
- `dist.shasum` as legacy SHA-1

```bash
# /var/home/user/Monochromatic
node --input-type=module <<'JS'
const response = await fetch(
  'https://registry.npmjs.org/@csstools%2Fcss-tokenizer/4.0.0',
)
const data = await response.json()

console.log(JSON.stringify({
  name: data.name,
  version: data.version,
  dist: data.dist,
}, null, 2))
JS
```

Observed output,
 with the full SHA-512 digest shortened for line length:

```json
{
  "name": "@csstools/css-tokenizer",
  "version": "4.0.0",
  "dist": {
    "integrity": "sha512-QxULHAm7cNu72w97JUNCBFODFaXpbDg+dP8b/oWFAZ2MTRppA3U00Y2L1HqaS4J6...",
    "shasum": "798a33950d11226a0ebb6acafa60f5594424967f",
    "tarball": "https://registry.npmjs.org/@csstools/css-tokenizer/-/css-tokenizer-4.0.0.tgz",
    "fileCount": 6,
    "unpackedSize": 46929
  }
}
```

The lockfile contains the same `dist.integrity` string for that package:

```text
pnpm-lock.yaml:3089:  '@csstools/css-tokenizer@4.0.0':
pnpm-lock.yaml:3090:    resolution.integrity matches the registry dist.integrity value above.
```

### Browser SRI catalog

Valid browser SRI hash tokens under the current spec:

```text
sha256-
sha384-
sha512-
```

Not current browser SRI tokens:

```text
sha1-
sha3_512-
sha3-512-
blake2b_512-
blake3-
```

`sha1-` is intentionally excluded as known weak.
The SHA-3 and BLAKE examples are outside the standardized token set,
even if they are cryptographic hashes that can be appropriate in other systems.

## Verified workarounds

### Use the generated SHA-512 lockfile entry

For pnpm installs from the npm registry,
 keep the generated `sha512-...` `resolution.integrity` value.
This is the interoperable path across npm metadata,
 pnpm,
 and the npm package manager ecosystem.

Tradeoff:
 this verifies bytes against a digest,
 but it does not authenticate the publisher.
Use registry signatures,
 provenance,
 or package review for publisher/authorship questions.

### Use browser-supported SRI tokens for browser SRI

For HTML `integrity` attributes,
 use one of these forms:

- `sha384-...`
- `sha512-...`
- `sha256-...`,
   when that is the only available digest

`sha384` is the spec's stated good baseline.
`sha512` is the strongest currently ordered SRI token.

Tradeoff:
 stronger tokens are longer in HTML.
The compatibility gain is worth more than the byte savings from a non-standard token.

### Use a separate content-addressing format outside browser SRI

If a non-browser system wants BLAKE3 or a multihash-style identifier,
store that digest in a separate field or format rather than calling it SRI.

Tradeoff:
 that field will not be consumed by browsers or npm/pnpm as SRI metadata.
The consuming tool must define and verify its own algorithm registry.

## What does not work

### Treating SRI as an arbitrary hash label format

SRI syntax is intentionally constrained.
A value like `blake3-...` can be useful inside a private tool,
but it is not valid browser SRI under the current spec.

### Treating SHA-3 or BLAKE absence as a security finding by itself

The upstream issues show process and implementation-cost reasons for the current set.
The absence of SHA-3,
 BLAKE2,
 or BLAKE3 does not mean SHA-256,
 SHA-384,
 or SHA-512 are currently
broken for SRI's use case.

### Editing `pnpm-lock.yaml` to prefer a different algorithm

Changing generated lockfile integrity values away from registry `dist.integrity` creates a local divergence from
the metadata pnpm resolved.
It also does not make npm publish or browser SRI support the new token.

## Upstream filing decision

### Duplicate search

Checked existing upstream SRI issues and pull requests with terms for SHA-3,
 SHA3,
 BLAKE,
 BLAKE2,
 BLAKE3,
and hash algorithm naming.

Existing matching issues:

- `w3c/webappsec-subresource-integrity#11`,
   `SHA-3/Keccak`.
- `w3c/webappsec-subresource-integrity#104`,
   `Add support for BLAKE hashes in subresource integrity`.
- `w3c/webappsec-subresource-integrity#89`,
   `Specify hash function naming`,
   for naming ambiguity around
  future algorithms.

These issues already contain the relevant upstream status:

- browser implementer interest is the gate
- SHA-3 lacks Chromium/BoringSSL support
- BLAKE needs an explainer and implementation path
- future algorithm names need careful syntax choices

Nothing in this investigation adds a new reproduction,
 source trace,
 prototype,
 or browser implementation signal
beyond those threads,
 so there is no additive comment to post.

### Out-of-scope check

Checked `.out-of-scope/` in this repository.
No file mentions SRI,
 pnpm lockfile integrity,
 npm registry metadata integrity,
 SHA-3,
 BLAKE2,
 or BLAKE3.
No local upstream-filing exemption applies.

### Six-constraint check

1.  Is it really upstream's fault?
    No bug was found.
    The current behavior is the documented SRI token set plus npm and pnpm source behavior.
2.  Can upstream fix it?
    Yes,
     as a feature.
    It requires SRI spec changes,
     browser implementer interest,
     tests,
     and implementation bugs.
3.  Are they supporting this use case?
    Partly.
    SRI supports hash agility within its token set.
    It does not claim to be an arbitrary digest registry.
4.  Would the repo welcome our contribution?
    A contribution path exists.
    `CONTRIBUTING.md` requires W3C Working Group participation or a non-member patent licensing commitment.
    The pull request template requires at least two interested implementers,
     web-platform tests,
    Chromium,
     Gecko,
     and WebKit implementation bugs,
     and an MDN issue.
5.  Will they likely fix it?
    Not without implementer interest.
    Existing issue comments explicitly make browser interest the key question.
6.  Have we prototyped a minimal fix compatible with their architecture?
    No.
    A prototype would need at least a spec pull request,
     web-platform tests,
     and browser implementation work.
    Because constraints 1 and 5 do not hold,
     auto-prototyping is not triggered.

### Filing artifact

Do not file a new upstream issue.
Do not comment on the existing issues unless a future investigation produces new browser implementer interest,
a concrete spec pull request,
 web-platform tests,
 or a working browser patch.

No draft issue is kept because the existing upstream issues already cover the question,
and this document has no additive content for them.
