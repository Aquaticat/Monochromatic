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
 so the `pack:npm` workaround in the top-level "Verified workaround" section leaves `pnpm pack` failing with the same error.
`.github/workflows/npm-release.yml` moved to the environment variable in `c92279465`.
These places still pass the ignored flag and need the same change:

- `package/git-policy/cli/mise.toml:46`,
   the `pack:npm` task;
- `doc/runbook/publish-npm-package-first-time.md:93`;
- `doc/planning/private-npm-registry.md:295`,
   which says packing reuses the `npm-release.yml` flag.

### Root cause

pnpm 12 is the Rust CLI (formerly pacquet).
Every `--config.<key>=<value>` token goes through an allow-list that drops unported keys without a message,
 and `dedupe-direct-deps` is not on it.
The environment variable takes a separate path that covers every setting in the schema.
Source below is tag `v12.3.4`,
 commit `666c35e95c17f1a36414adc28bc25a73a8f1f67f`,
 in a depth-1 clone.

The CLI strips the tokens from argv before clap parses it:

```rust
// pnpm/crates/cli/src/lib.rs:96
    let (config_overrides, argv) = ConfigOverrides::extract(argv_with_alias);
```

`classify` accepts any dotted key.
It rejects a token only when `setting_takes` says the value does not fit,
 and `setting_takes` answers `true` for every key outside `BARE_SETTING_FLAGS`:

```rust
// pnpm/crates/cli/src/config_overrides.rs:829
    if let Some(rest) = arg.strip_prefix("--config.") {
        let Some((key, value)) = rest.split_once('=') else {
            return ConfigToken::Malformed;
        };
```

```rust
// pnpm/crates/cli/src/config_overrides.rs:980
fn setting_takes(key: &str, value: &str) -> bool {
    match named_bare_setting_flag(key) {
        Some((_, SettingArity::Boolean)) => parse_bool(value).is_some(),
        // ...
        None => true,
    }
}
```

`extract` then removes the token from argv and hands it to `set`:

```rust
// pnpm/crates/cli/src/config_overrides.rs:221
                ConfigToken::WellFormed { key, value } => overrides.set(key, value),
```

`set` matches a fixed list of keys,
 and everything else reaches the empty fallback arm:

```rust
// pnpm/crates/cli/src/config_overrides.rs:240
    fn set(&mut self, key: &str, value: &str) {
        match key {
            "allow-unused-patches" => self.allow_unused_patches = parse_bool(value),
            // ...
            "virtual-store-only" => self.virtual_store_only = parse_bool(value),
            _ => {}
        }
```

The `_ => {}` arm is line 302.
`rg dedupe pnpm/crates/cli/src/config_overrides.rs` prints nothing:
 `ConfigOverrides` has no `dedupe_direct_deps` field,
 so `ConfigOverrides::apply` (called at `pnpm/crates/cli/src/cli_args/dispatch.rs:145`) has nothing to copy onto `Config`.
The type's own doc comment states the tradeoff:

```rust
// pnpm/crates/cli/src/config_overrides.rs:93
/// Unknown keys are accepted silently: pnpm exposes a long tail of config
/// keys, and erroring on an unrecognized one would break the moment pnpm
/// adds a new key that pacquet hasn't ported yet. Dropping one is only
/// harmless when pnpm parsed the token first and delegated, leaving the
/// pacquet leg to fall back to the yaml value. When the binary runs
/// standalone there is no other leg, so a setting that changes what gets
/// installed has to be ported here.
```

The mise-installed pnpm 12.3.4 is that standalone binary
 (`~/.local/share/mise/installs/pnpm/12.3.4/pnpm`),
 so the flag is consumed and lost.

The environment variable works because `pnpm/crates/config/src/lib.rs:3717` calls `WorkspaceSettings::from_pnpm_config_env`,
 which reads the key directly:

```rust
// pnpm/crates/config/src/env_overlay.rs:225
        json_field!(dedupe_direct_deps, "DEDUPE_DIRECT_DEPS");
```

The module header explains both the precedence and why `npm_config_dedupe_direct_deps` does nothing:

```rust
// pnpm/crates/config/src/env_overlay.rs:4
//! Reads `pnpm_config_<key>` (or its `PNPM_CONFIG_<KEY>` uppercase form)
//! for every key in the schema and applies it to the config *after*
//! `pnpm-workspace.yaml`. That ordering means env vars override yaml.
//!
//! Pacquet does NOT read `npm_config_*` / `NPM_CONFIG_*` env vars (with
//! the exception of `NPM_CONFIG_WORKSPACE_DIR`, which has its own narrow
//! handler in [`crate::Config::current`]).
```

pnpm 11.10.0 honored the flag (the top-level "Verification" section),
 so this is a pnpm 12 regression.
pnpm.io still documents the form on its CLI page
 ([pnpm CLI][pnpm-cli], `pnpm/pnpm.io` `docs/pnpm-cli.md:29` and `:42` at `3ee793826`),
 and the v12.0.0 release notes do not mention removing it.
pnpm/pnpm `main` at `8f20a3fd69748b1f6eb5c6a7c54d5917456a2013` (after 12.4.1) still has no `dedupe` match in `pnpm/crates/cli/src/config_overrides.rs`.

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

#### Other `--config.` keys

Any key missing from `ConfigOverrides::set` is dropped the same way.
`config-flag-probe.ts` (that session's scratchpad) recreated a single-package project depending on `is-number@7.0.0`
 for each case,
 ran the pnpm 12.3.4 binary's `install` with the listed change,
 and checked the result:

```text
default: exit 0, node_modules/.pnpm true, node_modules/is-number true, pnpm-lock.yaml true
--config.lockfile=false (ported key, positive control): exit 0, node_modules/.pnpm true, node_modules/is-number true, pnpm-lock.yaml false
--config.symlink=false (unported key): exit 0, node_modules/.pnpm true, node_modules/is-number true, pnpm-lock.yaml true
env pnpm_config_symlink=false: exit 0, node_modules/.pnpm true, node_modules/is-number false, pnpm-lock.yaml true
--config.dedupe-direct-deps=false (unported key, no observable effect in a single project): exit 0, node_modules/.pnpm true, node_modules/is-number true, pnpm-lock.yaml true
```

- `lockfile` is on the allow-list (`"lockfile" => self.lockfile = parse_bool(value),` at `config_overrides.rs:264`),
   and the flag suppresses `pnpm-lock.yaml`,
   so the probe can show a flag taking effect.
- `symlink` is not on it:
   the flag leaves the direct link in place,
   while `pnpm_config_symlink=false` (`json_field!(symlink, "SYMLINK");` at `env_overlay.rs:170`) removes it.
- The single-project `dedupe-direct-deps` row shows nothing by design;
   the workspace probe in "Verification" is the evidence for that key.

`--config.node-linker=hoisted` was tried first as the control and discarded:
 neither the flag nor `pnpm_config_node_linker=hoisted` changed whether `node_modules/.pnpm` existed,
 so that check could not show a difference.
`node-linker` is on the allow-list,
 so it says nothing about dropped keys.

The bare flag is not a way around the drop:
 `pnpm install --dedupe-direct-deps=false` on 12.3.4 exits with clap's
 `error: unexpected argument '--dedupe-direct-deps' found`,
 because the key is also missing from `BARE_SETTING_FLAGS`.

### Verified workaround

Set `pnpm_config_dedupe_direct_deps=false` in the environment of every pnpm command in the packing job,
 as `.github/workflows/pnpr-publish.yml` does at job level.

Tradeoffs:

- the variable reaches every pnpm command in the job,
   including unrelated installs,
   which is acceptable in a disposable CI checkout but would change a developer's layout if exported locally;
- the variable outranks `pnpm-workspace.yaml` for every command it reaches
   (`env_overlay.rs:4` to `:6`),
   so a later yaml change to `dedupeDirectDeps` has no effect in that job.

## What does not work

### Pass `--config.dedupe-direct-deps=false` on pnpm 12.3.4

See "pnpm 12.3.4 ignores the command-line override":
 the flag installs the deduplicated layout unchanged,
 with or without `--force`,
 because `ConfigOverrides::set` drops the key.

### Pass `--dedupe-direct-deps=false` or `npm_config_dedupe_direct_deps=false` on pnpm 12.3.4

The bare flag fails argument parsing with `error: unexpected argument '--dedupe-direct-deps' found`.
The `npm_config_` variable is not read at all (`env_overlay.rs:8`),
 so the workspace probe keeps the root-only link.

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
