# mise 2026.5.15: rust `components` like `rust-src` apply only at install, not onto an already-installed toolchain

Declaring `rust = { version = "...", components = "rust-src" }` in a mise config
does nothing for a toolchain mise has already installed.
The component is added only when mise installs the toolchain for the first time.
For a version that was already present before the declaration, mise treats the
tool as installed, skips the backend install step, and the `--component` argument
is never passed to rustup.
The symptom that surfaced this: JetBrains (RustRover / IntelliJ Rust) keeps
showing "Standard library: Download via Rustup" because the std sources are
missing from the toolchain the IDE follows.

## Symptom

- JetBrains Rust settings show `Standard library: Download via Rustup` instead
  of a std source path, even though the active mise config declares
  `components = "rust-src"` for the rust tool.
- `rustup component list --toolchain <ver>` lists `rust-src` without the
  `(installed)` marker.
- The std source directory is absent:
  `<RUSTUP_HOME>/toolchains/<ver>-<host>/lib/rustlib/src/rust/library/std`
  does not exist.
- `mise install` / `mise upgrade` / the shell `enter` hook do not fix it: they
  report the tool as already installed and never reinstall, so the component is
  never added.

The inverse also holds and is the tell: a rolling channel (`nightly`, `stable`)
that mise reinstalls on `mise upgrade` does pick up the declared component,
because the reinstall re-enters the install path. So the same declaration
"works" for nightly and "does nothing" for a pinned, already-present stable.

## Root cause

mise's rust backend passes `--component` to rustup in exactly one place: the
backend install routine. From the clone of `jdx/mise` at commit `310e325`
(`src/plugins/core/rust.rs:213`):

```rust
async fn install_version_(&self, ctx: &InstallContext, tv: ToolVersion) -> Result<ToolVersion> {
    self.setup_rustup(ctx, &tv).await?;
    let ts = ctx.config.get_toolset().await?;

    let (profile, components, targets) = get_args(&tv);

    let mut cmd = CmdLineRunner::new(RUSTUP_BIN)
        .with_pr(ctx.pr.as_ref())
        .arg("toolchain")
        .arg("install")
        .arg(&tv.version)
        .opt_args("--component", components)   // components applied ONLY here
        .opt_args("--target", targets)
        ...
```

`components` originates from the tool options (`src/plugins/core/rust.rs:56`):

```rust
let components = rt
    .and_then(|rt| rt.components.clone())
    .or_else(|| self.comma_list("components"));
```

The question is whether `install_version_` runs at all for an already-installed
version. It does not. The decision to skip is in the generic backend layer, not
the rust backend. `is_version_installed` keys solely on the install path
existing (`src/backend/mod.rs:1294`):

```rust
fn is_version_installed(
    &self,
    config: &Arc<Config>,
    tv: &ToolVersion,
    check_symlink: bool,
) -> bool {
    let check_path = |install_path: &Path, check_symlink: bool| {
        let is_installed = install_path.exists();
        let is_not_incomplete = !self.incomplete_file_path(tv).exists();
        let is_valid_symlink = !check_symlink || !is_runtime_symlink(install_path);
        ...
```

For the rust backend the install path is a symlink mise creates pointing at the
rustup `bin` directory (`src/plugins/core/rust.rs:234`):

```rust
file::remove_all(tv.install_path())?;
file::make_symlink(&cargo_home().join("bin"), &tv.install_path())?;
```

So once `~/.local/share/mise/installs/rust/<ver>` exists, mise considers the
version installed and never calls the backend install routine again, regardless
of whether the declared `components` list changed. There is no
"declared components differ from installed components, reconcile" step anywhere;
`components` are only recorded into the lockfile
(`src/plugins/core/rust.rs:66` `lockfile_options`), not enforced against an
existing install.

Concretely on this machine: `rust = { version = "latest", components = "rust-src" }`
in the repo root config resolves `latest` to `1.96.0`, which was installed
before the `components` key was added. mise sees the install-path symlink, skips
install, and `rust-src` is never added to `1.96.0`. nightly, declared in
`packages/fuzz/forbidden-strings/mise.toml`, is a rolling channel mise reinstalls
on upgrade, so it did receive `rust-src`.

Earlier framing that was wrong: this is not "mise failing to auto-update."
mise's `enter` hook does run `mise install` and `mise upgrade`, but `install`
only installs missing tools and `upgrade` only re-resolves and reinstalls when
the resolved version changes (or for rolling channels). Neither reconciles the
component set of a version that is already present at its resolved number.

## Verification

- mise version: `2026.5.15 linux-x64 (2026-05-23)`.
- mise source: `jdx/mise` commit `310e325` (cloned 2026-06-02).
- Toolchain under test: `1.96.0-x86_64-unknown-linux-gnu`, installed before the
  `components` declaration.

Failure, as observed this session before remediation:

```console
$ rustup component list --toolchain 1.96.0 | grep rust-src
rust-src                                          # note: no "(installed)"

$ ls /home/user/.rustup/toolchains/1.96.0-x86_64-unknown-linux-gnu/lib/rustlib/src/rust/library/std
ls: cannot access '.../lib/rustlib/src/rust/library/std': No such file or directory

$ mise current | grep '^rust '
rust 1.96.0                                       # the version the IDE follows
```

mise does not reinstall, so the declared component is never reapplied:

```console
$ mise install rust
                                                  # no output: already installed, no-op

$ mise ls rust | grep -E '1\.96|nightly'
rust  nightly (symlink)
rust  1.96.0 (symlink)   .../mise.toml  latest
```

Contrast (works): the rolling nightly mise reinstalled on `mise upgrade` carries
the declared component:

```console
$ rustup component list --toolchain nightly | grep rust-src
rust-src (installed)
```

## Verified workarounds

1. Add the component to the already-installed toolchain directly with rustup:

   ```bash
   rustup component add rust-src --toolchain 1.96.0
   ```

   Verified: the std source directory appears and the component flips to
   `(installed)`:

   ```console
   $ rustup component add rust-src --toolchain 1.96.0
   info: downloading component rust-src
   $ ls -d /home/user/.rustup/toolchains/1.96.0-x86_64-unknown-linux-gnu/lib/rustlib/src/rust/library/std
   .../lib/rustlib/src/rust/library/std
   $ rustup component list --toolchain 1.96.0 | grep rust-src
   rust-src (installed)
   ```

   Tradeoff: the add is invisible to mise. It is not recorded in mise state or
   the lockfile, so a teammate running only `mise install` on a fresh machine
   still gets a toolchain without `rust-src` until the version is installed
   fresh (see workaround 3) or they run this command too. The mise declaration
   and this manual add are belt-and-suspenders, not redundant: the declaration
   covers fresh installs, the manual add covers the already-present one.

2. Force mise to reinstall the version so the install path re-runs with
   `--component`:

   ```bash
   mise uninstall rust@1.96.0
   mise install
   ```

   Tradeoff: `mise uninstall` for the rust backend runs `rustup toolchain
   uninstall 1.96.0` (`src/plugins/core/rust.rs:242`), removing the toolchain
   from rustup entirely, not just from mise. Anything else relying on that
   rustup toolchain loses it until the reinstall finishes, and the reinstall
   re-downloads the whole toolchain. Heavier and more disruptive than
   workaround 1 for the sole goal of adding one component.

3. Do nothing and let the next version bump carry it. When `latest` next
   resolves to a newer stable (e.g. `1.97.0`), mise installs that version fresh
   and passes `--component rust-src`, so the new toolchain has it.

   Tradeoff: indefinite wait, and it never fixes the currently-pinned version;
   the IDE stays broken until the bump. Not a fix for the present, only an
   explanation of why the problem self-heals on the next stable release.

## What does not work

- Adding `components = "rust-src"` to the mise config and running `mise install`,
  `mise upgrade`, or relying on the `enter` hook. For a version already present
  at its resolved number, all of these are no-ops on the component set (root
  cause above). This is the trap: the declaration looks like it should
  reconcile, and it silently does not.
- Expecting the lockfile to enforce it. `components` are written into
  `lockfile_options` (`src/plugins/core/rust.rs:66`) but the lockfile records
  intent; nothing reads it back to reconcile an installed toolchain's components.

## Why we do not file this upstream

Walking the five constraints (default policy is do not file):

1. **Is it really upstream's fault?** Partly. mise exposes `components` as a
   first-class, tested (`src/plugins/core/rust.rs:489` `rust_options_reads_install_args`),
   lockfile-recorded option, yet only applies it at first install. A user
   reasonably reads a declarative config as desired-state. But "apply options at
   install time only" is also a common, defensible version-manager design, not
   obviously a defect. This is behavior plus a documentation gap, not a clear
   bug.
2. **Can upstream fix it?** Not with a small change. The skip-if-installed
   decision lives in the generic backend layer keyed on path existence
   (`src/backend/mod.rs:1294` `is_version_installed`), so the rust backend's
   `install_version_` is never re-entered for an existing version. A real fix
   needs either a rust-backend reconcile hook that runs even when installed, or
   a general "declared options changed, reconcile" mechanism in the toolset
   core. That touches structural install logic shared by every backend, not the
   line(s) in `rust.rs` that pass `--component`. Constraint fails here.
3. **Are they supporting this use case?** Yes. `components` is documented and
   tested, so declaring it is supported; the gap is reconciliation, not support.
4. **Will they likely fix it?** No evidence either way. `gh search issues
   --repo jdx/mise "rust components"` returned nothing, so there is no existing
   report or visible movement in this code path to cite.
5. **Have we prototyped a minimal fix?** No, and the auto-prototype trigger is
   not met: it fires when constraint 2 names a small, scoped change. Here
   constraint 2 named a cross-cutting change to the generic install-skip core,
   which is explicitly out of "small and scoped." Prototyping a
   structural-core change is not the cheap probe the skill targets.

Decision: do not file. The gate fails at constraint 2 (the fix is structural,
not a scoped rust-backend tweak) and constraint 4 (no signal upstream is moving
on it), and constraint 1 is a soft yes at best given the apply-at-install design
is defensible. The local workaround (`rustup component add`, workaround 1) solves
the user-facing problem at our boundary regardless of upstream movement.

If a future session finds upstream has added an options-reconcile mechanism, or
decides to propose one, re-evaluate constraints 2 and 4 with that evidence. Draft
kept below for that re-evaluation; do not file as-is.

~~~md
Title: rust backend: declared `components`/`targets` not reconciled onto an already-installed toolchain

Labels: rust, enhancement

Description:
Declaring `rust = { version = "1.96.0", components = "rust-src" }` does not add
`rust-src` to a `1.96.0` toolchain that was already installed before the
declaration. `mise install`/`mise upgrade` treat the version as installed and
skip the backend install routine, which is the only place `--component` is
passed to rustup.

Root cause (commit 310e325):
- `--component` is passed only in `src/plugins/core/rust.rs` `install_version_`.
- `src/backend/mod.rs` `is_version_installed` returns true once the install path
  (a symlink to the rustup bin dir) exists, so `install_version_` is never
  re-entered for an existing version.
- `components` are recorded into the lockfile (`lockfile_options`) but never read
  back to reconcile an installed toolchain.

Reproduction:
1. `rustup toolchain install 1.96.0 --profile minimal` (no rust-src), or have any
   already-installed toolchain without rust-src.
2. Declare `rust = { version = "1.96.0", components = "rust-src" }` in a mise
   config and run `mise install`.
3. `rustup component list --toolchain 1.96.0 | grep rust-src` shows it is not
   installed; the std source dir is absent.

Suggested fix:
On install, when `is_version_installed` is already true, have the rust backend
diff declared `components`/`targets` against
`rustup component list --installed --toolchain <ver>` and run `rustup component
add` / `rustup target add` for the missing ones, rather than skipping entirely.
This is a rust-backend reconcile step; alternatively a generic
"options changed, reconcile" path in the toolset would cover all backends.
~~~
