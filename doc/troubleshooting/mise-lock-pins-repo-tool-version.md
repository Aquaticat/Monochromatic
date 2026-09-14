# `mise upgrade` in the home directory moves the global tool version but leaves this repo on its `mise.lock` pin, so `pnpm` is 12.3.4 at `~` and 11.21.0 in the workspace

mise 2026.7.0,
 `pnpm = "latest"` in both `~/.config/mise/config.toml` and this repo's `mise.toml`,
 `mise.lock`
committed at the repo root.
Running `mise upgrade` from the home directory installs pnpm 12.3.4 and repoints the global tool,
 while every
command run inside the workspace keeps resolving pnpm 11.21.0.
The two versions differ by a major release,
 so behavior diverges by working directory.

## Symptom

The same tool name resolves to two versions depending on where the command runs:

```bash
cd ~            && mise current pnpm   # 12.3.4
cd <repo root>  && mise current pnpm   # 11.21.0
```

The installs directory shows both,
 with `latest` pointing at the newer one:

```text
~/.local/share/mise/installs/pnpm/
  11.21.0/
  12.3.4/
  12     -> ./12.3.4
  latest -> ./12.3.4
```

Nothing in the repo's `mise.toml` names 11:

```toml
pnpm = "latest"
```

The practical form of the symptom is a version-specific failure or message that does not match the version the
user believes is installed.
Here it was pnpm 11's `ERR_PNPM_IGNORED_BUILDS` and its rewriting of `pnpm-workspace.yaml`
(`doc/troubleshooting/pnpm-allow-builds-workspace-rewrite.md`),
 which pnpm 12.3.4 handles differently.

## Root cause

`mise.lock` at the repo root pins the concrete version,
 and lockfile resolution short-circuits the registry
lookup that `latest` would otherwise perform.

`mise.lock:958`

```toml
[[tools.pnpm]]
version = "11.21.0"
backend = "aqua:pnpm/pnpm"
```

Lockfiles are on by default.
From mise's own settings documentation (`settings.toml:1332`,
 the `[lockfile]` entry):

```text
When unset (the default), lockfiles are enabled (same as `true`) but there is no conflict with `locked` mode.
```

`mise settings lockfile` prints `true` here.

When a lockfile entry exists,
 resolution returns it immediately and never consults the backend for what `latest`
currently means.
From the mise source at tag `v2026.7.0`:

`src/toolset/tool_version.rs:87`

```rust
        if opts.use_locked_version
            && !has_linked_version(request.ba())
            && let Some(lt) = request.lockfile_resolve(config)?
        {
            return Ok(Self::from_lockfile(request.clone(), lt).with_before_date(opts.before_date));
        }
```

The pin is scoped to the config file that declares the tool,
 not to the machine.
Each config file gets its own lockfile path:

`src/toolset/mod.rs:697`

```rust
        if use_locked_version && Settings::get().lockfile_enabled() {
            let (lockfile_path, _) =
                lockfile_path_for_config(&path, config.monorepo_lockfile_root().as_deref());
```

mise's settings documentation states the naming rule directly:
 `mise.toml` pairs with `mise.lock`,
`.config/mise.toml` with `.config/mise.lock`.

`~/.config/mise/config.toml` has no `config.lock` beside it:

```text
~/.config/mise/
  age.txt
  config.toml
```

So the global `pnpm = "latest"` re-resolves against the registry on every upgrade,
 while the repo's
`pnpm = "latest"` is answered from `mise.lock` before any registry lookup happens.

`mise upgrade` only touches the configs active in the directory it runs in.
Its own help text says so,
 in the description of the flag that narrows it further:

```text
      --local
          Only upgrade tools defined in local config files

          This will only upgrade tools that are defined in project-local mise.toml and
          will skip tools defined in the global config (~/.config/mise/config.toml).
```

and,
 for the lockfile side:

```text
This will update mise.lock if it is enabled, see https://mise.en.dev/configuration/settings.html#lockfile
```

Run from `~`,
 the only active config is the global one,
 which has no lockfile:
 `latest` resolves to 12.3.4,
 that
version is installed,
 and the repo's `mise.lock` is never opened.
The filesystem timestamps corroborate this:
 `~/.config/mise/config.toml` and
`~/.local/share/mise/installs/pnpm/12.3.4/` are both stamped at the time of the upgrade,
 while the repo's
`mise.lock` retains an earlier timestamp and shows no modification in `git status`.

This is not a defect.
Pinning is what a lockfile is for,
 and a per-project pin surviving a global upgrade is the intended outcome.
The surprise is only that "I upgraded pnpm" is a per-config statement,
 not a per-machine one.

## Verification

Versions under test:
 mise 2026.7.0 (`linux-x64`,
 released 2026-07-02),
 mise source at tag `v2026.7.0`;
 pnpm
11.21.0 and 12.3.4 as installed by mise.

Confirm the split resolution and that the pin,
 not the config,
 decides:

```bash
mise --version                      # 2026.7.0 linux-x64
mise settings lockfile              # true
grep -A2 '^\[\[tools.pnpm\]\]' mise.lock
#   version = "11.21.0"
grep -n '^pnpm' mise.toml           # pnpm = "latest"
grep -n '^pnpm' ~/.config/mise/config.toml   # pnpm = "latest"

cd ~ && mise current pnpm           # 12.3.4
cd <repo root> && mise current pnpm # 11.21.0
```

Confirm what would move the repo pin,
 without moving it:

```bash
mise upgrade --dry-run pnpm
# Would uninstall pnpm@11.21.0
# Would install pnpm@12.3.4
```

Works cleanly:
 a tool with no `mise.lock` entry,
 or a config directory with no lockfile,
 resolves `latest`
against the registry on every upgrade.
That is why the home directory tracks 12.3.4.

Fails to propagate,
 by design:
 any `mise upgrade` invocation whose active configs exclude the repo's `mise.toml`.
Running it from `~` is the case observed here.

## Verified workarounds

Move the repo pin deliberately,
 from inside the repo:

```bash
mise upgrade pnpm      # rewrites the mise.lock entry to the newly resolved version
```

Tradeoff:
 `mise.lock` is a committed file,
 so this is a repository-wide change that lands in a commit and moves
every contributor and CI runner onto pnpm 12,
 the Rust rewrite.
That is a major-version migration to schedule,
 not a side effect to accept while chasing a version mismatch.
`mise upgrade --dry-run pnpm` shows the move first.

Leave the pin and treat the two versions as intentional.
Tradeoff:
 commands behave differently by working directory,
 which is exactly the confusion this document exists to
resolve;
 anyone comparing a failure inside the repo against a run from `~` needs `mise current pnpm` in both
places before trusting the comparison.

Pin the global config too,
 by creating `~/.config/mise/config.lock`,
 if the goal is that `mise upgrade` at `~`
stops silently tracking new majors.
Tradeoff:
 global tools then need explicit upgrades,
 which is more maintenance than most home-directory setups
want.

## What does not work

- Editing the repo's `mise.toml`.
   It already says `pnpm = "latest"`;
   the string is never consulted while a
  lockfile entry answers first,
   as `src/toolset/tool_version.rs:87` shows.
- Running `mise upgrade` again from `~`,
   or from any directory outside the repo.
   The repo's config is not
  active there,
   so its lockfile is not among the files the command updates.
- `mise install` inside the repo.
   It honors the same lockfile short-circuit and reinstalls the pinned
  11.21.0.
   Reasoned from `src/toolset/tool_version.rs:87` and the `[lockfile]` settings documentation rather
  than executed,
   since running it would mutate the main worktree's tool state for no diagnostic gain.
- Reading `~/.local/share/mise/installs/pnpm/latest` as the version in use.
   That symlink tracks the newest
  installed version (12.3.4),
   not the version any given directory resolves to.

## Upstream filing decision

`.out-of-scope/` holds no exemption covering mise or tool-version pinning.

No duplicate search was run and nothing is drafted,
 because there is nothing to file:
 constraint 1 fails at the
first step.
Walking the six constraints:

1.  Really upstream's fault?
    No.
    Honoring a committed lockfile pin over a symbolic `latest` is the documented
    purpose of the setting,
    stated in mise's own `[lockfile]` documentation.
    The behavior is correct.
2.  Can upstream fix it?
    Not applicable;
    there is no defect to fix.
    A version-skew warning when a tool
    resolves differently across active configs would be a feature request,
    and a noisy one.
3.  Are they supporting this use case?
    Yes,
    explicitly:
    per-project pinning with loose version strings is the
    stated motivation for lockfiles.
4.  Would the repo welcome our contribution?
    Not assessed,
    since no contribution is warranted.
5.  Will they likely fix it?
    Not applicable.
6.  Prototyped a minimal fix?
    Not applicable.

Decision:
 file nothing.
The durable value is this document plus the `mise current` check it names,
 not a tracker entry.

## Related

- `doc/troubleshooting/pnpm-allow-builds-workspace-rewrite.md`,
   the pnpm 11 behavior that surfaced this
  version split.
- `doc/troubleshooting/mise-npm-lock-stale-latest.md`,
   the neighboring failure mode where a lockfile pin is
  stale rather than merely older than the global tool.
