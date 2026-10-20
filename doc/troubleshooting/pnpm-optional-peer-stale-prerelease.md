# pnpm keeps a stale `typescript@7.0.2` optional-peer instance for `valibot` after a prerelease catalog move

## Symptom

Moving the workspace catalog entry `'typescript'` from `7.0.2` to the `7.1.0-beta` prerelease
 (published 2026-10-20T16:45:47Z) kept `typescript@7.0.2` in `pnpm-lock.yaml` and in the virtual store after
 `pnpm install`.
Importers whose `valibot` sees the compiler only as an optional peer still resolved the old instance:

```text
# pnpm-lock.yaml, failing state during the move
      valibot: 1.5.0(typescript@7.0.2)
  valibot@1.5.0(typescript@7.0.2):
```

Two compiler instances therefore coexisted:
 the catalog-pinned `typescript@7.1.0-beta` and the stale `typescript@7.0.2`
 that `node_modules/.pnpm/valibot@1.5.0_typescript@7.0.2/` kept linked.

The trigger is a workspace package that depends on `valibot` without declaring `typescript` in its own dependencies.
In this workspace those were `package/mcp/mvm`,
`package/pi-plugin/advisor`,
`package/pi-plugin/search-fetch`,
and
 `package/pi-shared/model-selection`.
The five sibling `valibot` consumers that already declared `typescript: catalog:`
 (`package/agent-harness-shared/search-fetch`,
`package/mcp/search-fetch`,
`package/mcp/stdio`,
 `package/ssg/aquati.cat`,
and `package/webapp-productivity/rss`) resolved `valibot@1.5.0(typescript@7.1.0-beta)`
 as soon as the catalog moved.

The same move also had to clear the workspace's `minimumReleaseAge: 1440` strict hold,
 which needed `minimumReleaseAgeExclude` entries for the day-one beta.
The hold behavior is covered in
 [`pnpm-update-no-save-strict-release-age.md`](pnpm-update-no-save-strict-release-age.md).

## Root cause

### `7.1.0-beta` never satisfies `valibot`'s optional peer range

`valibot@1.5.0` declares `typescript` as an optional peer:

```json
// node_modules/.pnpm/valibot@1.5.0_typescript@7.1.0-beta/node_modules/valibot/package.json
"peerDependencies": {
    "typescript": ">=5"
  },
  "peerDependenciesMeta": {
    "typescript": {
      "optional": true
    }
  }
```

node-semver excludes a prerelease version from a comparator set unless a comparator of the same
 `[major, minor, patch]` tuple also carries a prerelease tag
 (see [Prerelease Tags][semver-prerelease]):
"If a version has a prerelease tag (for example,
`1.2.3-alpha.3`) then it will only be allowed to satisfy comparator
sets if at least one comparator with the same `[major, minor, patch]` tuple also has a prerelease tag."
`>=5` carries no prerelease comparator,
 so `7.1.0-beta` never satisfies it while the stable `7.0.2` does.
After the catalog move the only workspace version matching `valibot`'s peer range was therefore the stale one.

### The optional-peer lookup runs per importer

pnpm installs a missing optional peer only from a version that already satisfies the optional peer range
 (see [Optional Peer Dependencies][pnpm-optional-peers]):
"pnpm installs a missing optional peer dependency only if the workspace already has a version of it that satisfies the
optional peer range."
The lookup runs per importer,
 and `pnpm-workspace.yaml` sets `resolvePeersFromWorkspaceRoot: false`,
 so the workspace root's `typescript` is not a peer candidate for the other projects
 (see [`resolvePeersFromWorkspaceRoot`][pnpm-resolve-root]).
A workspace package that does not declare `typescript` itself supplies no candidate in its own dependency context,
 and its `valibot` keeps the instance that importer already resolved.

The migration verified this split:
 the importers that declared `typescript: catalog:` in their own devDependencies resolved
 `valibot@1.5.0(typescript@7.1.0-beta)` immediately,
 while the importers without the declaration kept `valibot@1.5.0(typescript@7.0.2)` until the declaration was added.

## Verification

Versions under test:
 pnpm `12.14.0` (measured with `pnpm --version` on 2026-10-20),
 `typescript@7.1.0-beta`,
 `valibot@1.5.0`.

The failing state is recorded in the lockfile replacement inside commit `27b1cf2eec`:

```sh
# /var/home/user/Monochromatic
git show 27b1cf2eec -- pnpm-lock.yaml
```

That diff deletes the `typescript@7.0.2` snapshot keys and every `valibot@1.5.0(typescript@7.0.2)` resolution,
 replacing them with `(typescript@7.1.0-beta)` forms.

Working catalog:

- an importer that declares `typescript: catalog:` in `devDependencies` resolves
  `valibot@1.5.0(typescript@7.1.0-beta)`;
- after the four declarations landed,
  `rg -n 'typescript@7\.0\.2' pnpm-lock.yaml` returns no match and only `typescript@7.1.0-beta` remains.

Failing catalog:

- an importer that depends on `valibot` without declaring `typescript` retained `valibot@1.5.0(typescript@7.0.2)`
  during the move;
- `typescript@7.0.2` therefore stayed in `pnpm-lock.yaml` and in `node_modules/.pnpm/` even though the catalog pin
  asked for `7.1.0-beta`.

## Verified workarounds

### Declare the compiler in each `valibot` consumer's own devDependencies (applied)

```json
// package/mcp/mvm/package.json
{
  "devDependencies": {
    "typescript": "catalog:"
  }
}
```

Applied in commit `27b1cf2eec` to `package/mcp/mvm`,
`package/pi-plugin/advisor`,
`package/pi-plugin/search-fetch`,
and
 `package/pi-shared/model-selection`.
Each importer then resolves `valibot`'s optional peer from its own dependencies,
 producing `valibot@1.5.0(typescript@7.1.0-beta)`,
 and `typescript@7.0.2` leaves `pnpm-lock.yaml` and the virtual store.

Tradeoff:
 every `valibot` consumer now declares the compiler even when it needs the package only for the optional peer,
 and a future `valibot` consumer that omits the declaration reopens the stale instance.
The `catalog:` specifier keeps the version centralized in `pnpm-workspace.yaml`,
 so the declaration follows the workspace pin.

## What does not work

- `peerDependencyRules.allowedVersions` (including a `valibot>typescript` selector):
  it only stops unmet-peer warnings for the named range
  (see [`peerDependencyRules.allowedVersions`][pnpm-allowed]),
  and the stale `valibot@1.5.0(typescript@7.0.2)` key survived it during the move.
- `peerDependencyRules.allowAny`:
  it mutes peer version-mismatch warnings
  (see [`peerDependencyRules.allowAny`][pnpm-allow-any]),
  and the stale key survived it too.
- `packageExtensions` peer-range widening:
  the extension is additive only and cannot replace `valibot`'s existing `typescript: >=5` range,
  so the prerelease still cannot match.
- Scoped `pnpm update`:
  the stale `valibot@1.5.0(typescript@7.0.2)` key survived it during the move.
- `pnpm dedupe`:
  the stale key survived it the same way.
- `pnpm install --fix-lockfile`:
  the lockfile kept `valibot@1.5.0(typescript@7.0.2)`.

## Upstream filing decision

`.out-of-scope/` holds no pnpm or peer-resolution exemption
 (checked `bun-install.md`,
`jsr.md`,
and `lightningcss.md`).
GitHub issue searches over `pnpm/pnpm` for `optional peer prerelease`,
`stale peer instance`,
`prerelease peer dependency`,
and `optional peer stale version` found no matching report on 2026-10-20.
Nothing to file and nothing to add:
 no draft issue or comment is kept.

1.  Really upstream's fault?
    Not established.
    The prerelease exclusion is node-semver's documented range rule,
    and the stale retention follows pnpm's documented optional-peer lookup.
2.  Can upstream fix it?
    pnpm could re-resolve an optional peer when the peer version moves,
    but nothing here proves the current behavior is a defect.
3.  Are they supporting this use case?
    Yes;
    workspace catalogs and optional peers are documented pnpm features.
4.  Would the repo welcome our contribution?
    Not evaluated,
    because constraint 1 fails and opening an external issue needs the user's authorization.
5.  Will they likely fix it?
    Unknown;
    no matching issue or stated policy was found.
6.  Have we prototyped a minimal fix compatible with their architecture?
    No;
    the consumer-side declaration in the `Verified workarounds` section resolves this repository's incident.

[semver-prerelease]: https://github.com/npm/node-semver#prerelease-tags
[pnpm-optional-peers]: https://pnpm.io/settings#optional-peer-dependencies
[pnpm-resolve-root]: https://pnpm.io/settings#resolvepeersfromworkspaceroot
[pnpm-allowed]: https://pnpm.io/settings#peerdependencyrulesallowedversions
[pnpm-allow-any]: https://pnpm.io/settings#peerdependencyrulesallowany
