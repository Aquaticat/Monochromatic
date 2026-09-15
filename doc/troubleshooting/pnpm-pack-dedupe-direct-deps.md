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
`package/git-policy/cli/node_modules/@monochromatic-dev` did not contain `config-typescript`.

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
`package/git-policy/cli/node_modules/@monochromatic-dev/config-typescript` existed.
The second command produced a tarball whose manifest contained ordinary registry versions instead of `catalog:` or
`workspace:` protocols.

A disposable project installed that tarball with npm,
imported the authoring API,
bundled a self-contained config through tsdown,
resolved the packaged shadow `git` bin before `/usr/bin/git`,
and forwarded `git --version` successfully.

## Verified workaround

`package/git-policy/cli/mise.toml` makes `pack:npm` perform a forced package-filtered install with
`dedupe-direct-deps=false` immediately before `pnpm pack`.
The override is command-local;
it does not weaken workspace-wide deduplication.

Tradeoffs:

- the pack task relinks the filtered dependency graph before every tarball;
- `--force` is required by the upstream issue's workaround so existing deduplicated links are replaced;
- the package remains unpublished until deferred issue #358 is explicitly resumed.

## pnpm 12.3.4 ignores the command-line override

Found 2026-09-15 while verifying `package/config/pnpr/src/publish-missing-versions.ts`.
On pnpm 12.3.4,
 `--config.dedupe-direct-deps=false` no longer changes the install layout,
 so the workaround above (and the install step in `.github/workflows/npm-release.yml` and
 `package/git-policy/cli/mise.toml` `pack:npm`) leaves `pnpm pack` failing with the same error.

### Verification

A disposable worktree at `00bd2867b` deleted every `node_modules` directory before each case,
 ran `pnpm install --frozen-lockfile` with the listed change,
 and checked for `package/module/or-throw/node_modules/@monochromatic-dev/config-typescript`
 (script `dedupe-env-probe.ts` in that session's scratchpad):

```text
default: install exit 0, config-typescript linked in or-throw: false
cli --config.dedupe-direct-deps=false: install exit 0, config-typescript linked in or-throw: false
env pnpm_config_dedupe_direct_deps=false: install exit 0, config-typescript linked in or-throw: true
env npm_config_dedupe_direct_deps=false: install exit 0, config-typescript linked in or-throw: false
```

With the environment variable set for the whole run,
 `pnpm pack` succeeded for `module-or-throw` and `oxlint-plugin-tsdoc`,
 and both published to a local pnpr and installed in a disposable consumer.
Adding `--force` to the command-line form did not link the dependency either.

A layout installed with the variable does not survive a later plain `pnpm install`:
 a publish run whose build tasks invoked pnpm without the variable restored the root-only link,
 and pack failed again.

### Verified workaround

Set `pnpm_config_dedupe_direct_deps=false` in the environment of every pnpm command in the packing job,
 as `.github/workflows/pnpr-publish.yml` does at job level.

Tradeoffs:

- the variable reaches every pnpm command in the job,
   including unrelated installs,
   which is acceptable in a disposable CI checkout but would change a developer's layout if exported locally;
- the source-level reason pnpm 12 ignores the `--config.` form is not traced yet.

## What does not work

### Pass `--config.dedupe-direct-deps=false` on pnpm 12.3.4

See "pnpm 12.3.4 ignores the command-line override":
 the flag installs the deduplicated layout unchanged,
 with or without `--force`.

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
