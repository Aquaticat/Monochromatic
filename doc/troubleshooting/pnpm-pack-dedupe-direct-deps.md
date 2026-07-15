# pnpm pack cannot resolve deduplicated workspace dependencies

## Symptom

Packing `@monochromatic-dev/git-policy-cli` with pnpm 11.10.0 failed:

```text
ERR_PNPM_CANNOT_RESOLVE_WORKSPACE_PROTOCOL
Cannot resolve workspace protocol of dependency "@monochromatic-dev/config-typescript"
because this dependency is not installed. Try running "pnpm install".
```

A normal filtered install and a forced filtered install both left that direct development dependency linked only at the
workspace root.
`packages/git-policy/cli/node_modules/@monochromatic-dev` did not contain `config-typescript`.

Using `npm pack` instead created a tarball,
but its manifest retained `catalog:` dependency specifiers.
A disposable npm consumer then failed with:

```text
EUNSUPPORTEDPROTOCOL
Unsupported URL Type "catalog:": catalog:
```

## Root cause

This workspace sets `dedupeDirectDeps: true` in `pnpm-workspace.yaml:151`.
The setting can deduplicate a direct workspace dependency to the root installation,
while pnpm's pack-time `workspace:` rewrite still expects the dependency under the package being packed.

Open pnpm issue [#9566][pnpm-9566] reports the same
`ERR_PNPM_CANNOT_RESOLVE_WORKSPACE_PROTOCOL` during pack or publish when `dedupeDirectDeps` is enabled.
Its reproducer states that disabling direct-dependency deduplication and forcing installation restores publishing.

Pnpm's workspace documentation says `pnpm pack` replaces `workspace:` dependencies with package versions
([workspace publishing][workspace-publishing]).
Its catalog documentation likewise says `pnpm pack` removes `catalog:` and writes ordinary version ranges
([catalog publishing][catalog-publishing]).
`npm pack` has no corresponding knowledge of the pnpm workspace catalog,
so it is not a valid replacement for packaging this repository's source manifest directly.

## Verification

The following sequence was tested against the cli-git package:

```text
pnpm install --force --config.dedupe-direct-deps=false --filter @monochromatic-dev/git-policy-cli
pnpm pack --pack-destination dist/pack
```

After the first command,
`packages/git-policy/cli/node_modules/@monochromatic-dev/config-typescript` existed.
The second command produced a tarball whose manifest contained ordinary registry versions instead of `catalog:` or
`workspace:` protocols.

A disposable project installed that tarball with npm,
imported the authoring API,
bundled a self-contained config through tsdown,
resolved the packaged shadow `git` bin before `/usr/bin/git`,
and forwarded `git --version` successfully.

## Verified workaround

`packages/git-policy/cli/mise.toml` makes `pack:npm` perform a forced package-filtered install with
`dedupe-direct-deps=false` immediately before `pnpm pack`.
The override is command-local;
it does not weaken workspace-wide deduplication.

Tradeoffs:

- the pack task relinks the filtered dependency graph before every tarball;
- `--force` is required by the upstream issue's workaround so existing deduplicated links are replaced;
- the package remains unpublished until deferred issue #358 is explicitly resumed.

## What does not work

### Repeat pnpm install with repository defaults

Both ordinary and forced installs preserve the deduplicated root-only workspace dependency,
so pack still cannot rewrite its `workspace:` specifier.

### Use npm pack directly

Npm creates an archive but does not expand pnpm catalogs.
The resulting tarball is not installable by a standalone npm consumer.

### Hand-edit the packed manifest

Rejected because it bypasses the package manager's workspace and catalog transformations,
creates version drift,
and violates the repository rule against hand-maintained generated dependency state.

## Upstream filing decision

Do not open a duplicate.
Pnpm issue [#9566][pnpm-9566] is open,
labeled `type: bug`,
and matches the observed error plus workaround.
The repository has a verified command-local mitigation;
no additional upstream report is needed unless pnpm maintainers request a new pnpm 11 reproduction.

[pnpm-9566]: https://github.com/pnpm/pnpm/issues/9566
[workspace-publishing]: https://pnpm.io/workspaces#publishing-workspace-packages
[catalog-publishing]: https://pnpm.io/catalogs#publishing
