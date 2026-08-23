# Hermes Agent 0.19.0 installed by mise 2026.7.0 can use Python 3.14 and report a missing entry point

## Symptom

The plain global install succeeds:

```console
$ mise use --global --yes 'pipx:hermes-agent[extras=all]@latest'
Installed 3 executables: hermes, hermes-acp, hermes-agent
```

On a host whose default interpreter is Python 3.14,
 the resulting command can report:

```text
Hermes Agent v0.19.0 (2026.7.20)
Python: 3.14.6
Up to date
```

That interpreter is outside the wheel's declared range:

```text
Requires-Python: <3.14,>=3.11
```

`hermes doctor` also reports this warning even though mise installed a working executable:

```text
⚠ Venv entry point not found
  (hermes not in venv/bin/ or .venv/bin/ — reinstall with pip install -e '.[all]')
```

The same run warns that `python-telegram-bot` and `discord.py` are not installed.
Those are optional SDKs deliberately excluded from the curated `all` extra and lazy-installed on first use,
 not evidence that uv dropped requested dependencies.

There is a separate support constraint.
 Hermes Agent's current
[platform support page][hermes-platform-support] explicitly lists PyPI installs,
 including
`uv tool install hermes-agent`,
 as unsupported.
 The published PyPI version was `0.19.0` during verification,
while `pyproject.toml` on upstream `main` declared `0.20.5`.

## Root cause

### Mise delegates the install to uv

Mise 2026.7.0's pipx backend constructs an unqualified `uv tool install` command.
 It adds a Python selection only
when the tool configuration supplies one through `uvx_args`.

`jdx/mise` `src/backend/pipx.rs:277-300` at tag `v2026.7.0`:

```rust
let pipx_request = self
    .tool_name()
    .parse::<PipxRequest>()?
    .pipx_request(&tv.version, &options);

if let Some(uv_program) = uv_program {
    self.warn_if_uv_may_not_support_exclude_newer(ctx).await;
    ctx.pr
        .set_message(format!("uv tool install {pipx_request}"));
    let mut cmd = Self::uvx_cmd(
        &uv_program,
        &ctx.config,
        &["tool", "install", &pipx_request],
        self,
        &tv,
        &ctx.ts,
        ctx.pr.as_ref(),
    )
    .await?;
    cmd = cmd.args(Self::uv_exclude_newer_args(ctx.before_date));
    if let Some(args) = options.uvx_args() {
        cmd = cmd.args(shell_words::split(args)?);
    }
    cmd.execute()?;
}
```

Mise documents `extras` and `uvx_args` as pipx tool options in
`jdx/mise` `docs/dev-tools/backends/pipx.md:136-188`.

### Uv ignores dependency `Requires-Python` upper bounds

Hermes Agent 0.19.0 intentionally excludes Python 3.14.

`NousResearch/hermes-agent` `pyproject.toml:8-20` at tag `v2026.7.20`:

```toml
[project]
name = "hermes-agent"
version = "0.19.0"
readme = "README.md"
# Upper bound is load-bearing, not cosmetic. uv resolves the project's
# Python from `requires-python`, and an inherited `UV_PYTHON` env var (or a
# fresh distro whose newest interpreter uv auto-picks) will otherwise select
# 3.14, where Rust-backed transitives (e.g. pydantic-core) have no cp314
# wheel yet and fall back to a maturin source build that fails. Capping at
# <3.14 makes uv refuse 3.14 with a clear error instead of attempting that
# build. Raise the ceiling once our Rust transitives ship cp314 wheels.
requires-python = ">=3.11,<3.14"
```

Uv 0.12.3 reads only the lower bound when it forks resolution for a dependency's Python requirement.

`astral-sh/uv` `crates/uv-resolver/src/resolver/environment.rs:617-633` at tag `0.12.3`:

```rust
/// Fork the resolver based on a `Requires-Python` specifier.
pub(crate) fn fork_version_by_python_requirement(
    requires_python: &VersionSpecifiers,
    python_requirement: &PythonRequirement,
    env: &ResolverEnvironment,
) -> Vec<ResolverEnvironment> {
    let requires_python = RequiresPython::from_specifiers(requires_python.clone());
    let lower = requires_python.range().lower().clone();

    // Attempt to split the current Python requirement based on the `requires-python` specifier.
    //
    // For example, if the current requirement is `>=3.10`, and the split point is `>=3.11`, then
    // the result will be `>=3.10 and <3.11` and `>=3.11`.
    //
    // However, if the current requirement is `>=3.10`, and the split point is `>=3.9`, then the
    // lower segment will be empty, so we should return an empty list.
    let Some((lower, upper)) = python_requirement.split(lower.into()) else {
```

This matches uv's documented compatibility rule:
 dependency `Requires-Python` upper bounds are ignored.
The upstream discussion in [astral-sh/uv#14110][uv-14110] confirms that this rule also affects
`uv tool install`.

Mise therefore receives a successful exit even when uv creates the Hermes environment with Python 3.14.
Mise is not bypassing a uv error.

### Hermes doctor assumes the source-checkout layout

Hermes derives `PROJECT_ROOT` from the installed `hermes_cli` package.

`NousResearch/hermes-agent` `hermes_cli/config.py:757-759` at tag `v2026.7.20`:

```python
def get_project_root() -> Path:
    """Get the project installation directory."""
    return Path(__file__).parent.parent.resolve()
```

The command-installation check then searches only for a nested `venv` or `.venv` beneath that directory.
A uv tool environment instead puts the executable in the active environment's `bin` directory.

`NousResearch/hermes-agent` `hermes_cli/doctor.py:1491-1518` at tag `v2026.7.20`:

```python
if sys.platform != "win32":
    _section("Command Installation")
    # Determine the venv entry point location
    _venv_bin = None
    for _venv_name in ("venv", ".venv"):
        _candidate = PROJECT_ROOT / _venv_name / "bin" / "hermes"
        if _candidate.exists():
            _venv_bin = _candidate
            break

    # Determine the expected command link directory (mirrors install.sh logic)
    _prefix = os.environ.get("PREFIX", "")
    _is_termux_env = bool(os.environ.get("TERMUX_VERSION")) or "com.termux/files/usr" in _prefix
    if _is_termux_env and _prefix:
        _cmd_link_dir = Path(_prefix) / "bin"
        _cmd_link_display = "$PREFIX/bin"
    else:
        _cmd_link_dir = Path.home() / ".local" / "bin"
        _cmd_link_display = "~/.local/bin"
    _cmd_link = _cmd_link_dir / "hermes"

    if _venv_bin is None:
        check_warn(
            "Venv entry point not found",
            "(hermes not in venv/bin/ or .venv/bin/ — reinstall with pip install -e '.[all]')"
        )
        manual_issues.append(
            f"Reinstall entry point: cd {PROJECT_ROOT} && source venv/bin/activate && pip install -e '.[all]'"
        )
```

The warning is a false positive for this layout.
 The suggested editable reinstall is not appropriate inside
an installed `site-packages` directory.

### The all extra omits lazy messaging dependencies

Hermes Agent 0.19.0 intentionally keeps opt-in provider and messaging dependencies outside `all`.
The package installs those dependencies on first use instead.

`NousResearch/hermes-agent` `pyproject.toml:273-305` at tag `v2026.7.20`:

```toml
all = [
  # Policy (2026-05-12): `[all]` includes only extras that genuinely
  # CAN'T be lazy-installed via `tools/lazy_deps.py` — i.e. things every
  # session can use, things needed before the agent loop is alive
  # (terminal/CLI), and skill deps that packagers (Nix, AUR, Homebrew)
  # need in the wheel. Anything an opt-in backend (provider, search,
  # TTS, image, memory, messaging platform, terminal sandbox) needs
  # MUST live exclusively in `LAZY_DEPS` and resolve at first use —
  # otherwise one quarantined PyPI release breaks every fresh install.
  #
  # Removed from [all] on 2026-05-12 (covered by lazy-install):
  #   anthropic, exa, firecrawl, parallel-web, fal, edge-tts,
  #   modal, daytona, messaging (telegram/discord/slack),
  #   matrix, slack, honcho, voice (faster-whisper),
  #   dingtalk, feishu, bedrock, tts-premium (elevenlabs)
  "hermes-agent[cron]",
  "hermes-agent[cli]",
  "hermes-agent[pty]",
  "hermes-agent[mcp]",
  "hermes-agent[homeassistant]",
  "hermes-agent[sms]",
  "hermes-agent[acp]",
  "hermes-agent[google]",
  "hermes-agent[web]",
  "hermes-agent[youtube]",
]
```

The optional-SDK warnings therefore scope the verified result:
 the core CLI and curated `all` feature set load,
 while optional messaging integrations have not been exercised.

## Verification

The observed versions and source revisions were:

- mise `2026.7.0`,
   tag `v2026.7.0`,
   commit `857b73f6a6b39a3bc90c44119a1e86ee11bd7273`;
- uv `0.12.3`,
   tag `0.12.3`,
   commit `507230998c9541d67814b57463ac00e454ff6991`;
- Hermes Agent `0.19.0`,
   tag `v2026.7.20`,
   commit `3ef6bbd201263d354fd83ec55b3c306ded2eb72a`;
- Hermes Agent wheel SHA-256
  `bd0bac012aee38a60894781f4597dc29ee7bedb3448540249921f10d3bef327f`.

### Disposable runtime harness

The following keeps uv's test environment outside user state:

```bash
scratch_dir="$(mktemp --directory)"
trap 'rm --recursive --force -- "$scratch_dir"' EXIT

UV_TOOL_DIR="$scratch_dir/tool" \
UV_TOOL_BIN_DIR="$scratch_dir/bin" \
mise exec uv -- uv tool install 'hermes-agent[all]==0.19.0' --python 3.14

"$scratch_dir/bin/hermes" --version
mise exec uv -- uv pip check \
  --python "$scratch_dir/tool/hermes-agent/bin/python"
```

The install returned success and `hermes --version` reported Python `3.14.6`.
 The positive-control check then
returned failure:

```text
Found 1 incompatibility
The package `hermes-agent` requires Python >=3.11, <3.14, but `3.14.6` is installed
```

Changing the install argument to `--python 3.13` produced Python `3.13.15`.
 The same `uv pip check` command
then returned:

```text
All installed packages are compatible
```

### Working catalog

- `uvx_args = "--python 3.13"` installs Hermes into a Python 3.13 environment.
- `uv pip check` reports every installed package compatible in that environment.
- A new login shell resolves `hermes` through mise and `hermes --version` succeeds.
- After the Python 3.13 reinstall,
  `mise exec pipx:hermes-agent -- hermes --help` returns status `0` and loads the complete CLI parser.
- `hermes version` returns status `0` and reports Python `3.13.15`.
- `hermes doctor` returns status `0` despite counting the missing scratch configuration and false entry-point
  warning as issues.

### Failing or misleading catalog

- Omitting `uvx_args` can select Python 3.14 and still return a successful install.
- Explicit `uv tool install ... --python 3.14` also returns success despite the wheel's `<3.14` upper bound.
- `uv pip check` exposes the resulting incompatibility and returns status `1`.
- `hermes doctor` reports the entry point missing even when `mise which hermes` resolves an executable and
  `hermes --version` succeeds.
- `hermes --version` says `Up to date` for PyPI `0.19.0`,
   while upstream has retired PyPI distribution and
  moved its source version beyond that release.

## Supported alternatives

The current upstream support matrix gives Linux on x86-64 and ARM64 two Tier 1 installation methods:
 the Git-backed `install.sh` layout and the official Docker image.
Nix is Tier 2 and maintained on a best-effort basis.
PyPI,
 including `uv tool install` and `pip install`,
 remains explicitly unsupported.

`NousResearch/hermes-agent` `website/docs/getting-started/platform-support.md:13-50` at commit
`c9c44d0df92279815bfd00ad53b82a256781d497` records those tiers.
The manual clone instructions in `website/docs/developer-guide/contributing.md:77-104` are a developer fallback,
 not another Tier 1 distribution method.

### Run the official installer without a pipe

Downloading the official installer to a file,
 inspecting it,
 and then invoking that file avoids the `curl | bash` pipeline while retaining the Tier 1 install layout.
On 2026-08-23,
 the bytes served by `https://hermes-agent.nousresearch.com/install.sh` exactly matched
`scripts/install.sh` at upstream commit `c9c44d0df92279815bfd00ad53b82a256781d497`.
Both files had SHA-256
`0582d9b1562efcb6e0ac62f4451021667830b830a72ce7d91eaea9fee8b6c09b`.
Invoking the downloaded file with `--help` returned status `0`.

This removes the pipeline,
 not shell execution or network-fetched dependencies.
The installer itself downloads the uv installer to a temporary file and executes it when
`$HERMES_HOME/bin/uv` is absent.

`NousResearch/hermes-agent` `scripts/install.sh:566-615` at the same commit:

```bash
local _managed_uv="$HERMES_HOME/bin/uv"

if [ -x "$_managed_uv" ]; then
    UV_CMD="$_managed_uv"
    UV_VERSION=$($UV_CMD --version 2>/dev/null)
    log_success "Managed uv found ($UV_VERSION)"
    return 0
fi

log_info "Installing managed uv into $HERMES_HOME/bin ..."
mkdir -p "$HERMES_HOME/bin"

# Two-stage: download the installer, then run it.  Piping
# `curl | sh` masks curl failures (sh exits 0 on empty stdin)
# and conflates network errors with installer errors.
local _uv_install_log _uv_installer
_uv_install_log="$(mktemp 2>/dev/null || echo "/tmp/hermes-uv-install.$$.log")"
_uv_installer="$(mktemp 2>/dev/null || echo "/tmp/hermes-uv-installer.$$.sh")"
if ! curl -LsSf https://astral.sh/uv/install.sh -o "$_uv_installer" 2>"$_uv_install_log"; then
    log_error "Failed to download uv installer from https://astral.sh/uv/install.sh"
    log_info "curl output:"
    sed 's/^/    /' "$_uv_install_log" >&2
    log_info "Install manually: https://docs.astral.sh/uv/getting-started/installation/"
    rm -f "$_uv_install_log" "$_uv_installer"
    exit 1
fi
# UV_UNMANAGED_INSTALL tells the astral installer to place the binary
# directly into $HERMES_HOME/bin instead of ~/.local/bin.
if UV_UNMANAGED_INSTALL="$HERMES_HOME/bin" sh "$_uv_installer" >>"$_uv_install_log" 2>&1; then
    rm -f "$_uv_installer"
    if [ -x "$_managed_uv" ]; then
        UV_CMD="$_managed_uv"
    else
        log_error "uv installer reported success but binary not found at $_managed_uv"
        log_info "Installer output:"
        sed 's/^/    /' "$_uv_install_log" >&2
        rm -f "$_uv_install_log"
        exit 1
    fi
    rm -f "$_uv_install_log"
    UV_VERSION=$($UV_CMD --version 2>/dev/null)
    log_success "Managed uv installed ($UV_VERSION)"
else
    log_error "Failed to install uv"
    log_info "Installer output:"
    sed 's/^/    /' "$_uv_install_log" >&2
    log_info "Install manually: https://docs.astral.sh/uv/getting-started/installation/"
    rm -f "$_uv_install_log" "$_uv_installer"
    exit 1
fi
```

Tradeoff:
 this route is upstream-supported and host-native,
 but Hermes owns its checkout and environment under `~/.hermes` rather than mise.
There is no upstream-supported installation in which mise owns the Hermes package.
An existing executable at `$HERMES_HOME/bin/uv` skips the nested uv download,
 but that prerequisite must remain compatible with the installer.

The official container is the Tier 1 alternative when executing the installer script is itself unacceptable.
It avoids a host Python checkout,
 but changes terminal,
 filesystem,
 browser,
 audio,
 and service integration boundaries.

## Verified workarounds

### Pin the tool's interpreter through mise

Use the curated `all` extra and pass uv's Python selector through mise:

```bash
mise use --global --force --yes \
  'pipx:hermes-agent[extras=all,uvx_args=--python 3.13]@latest'
```

This writes:

```toml
[tools]
"pipx:hermes-agent" = { version = "latest", extras = "all", uvx_args = "--python 3.13" }
```

Verification showed Python `3.13.15`,
 a successful login-shell invocation,
 and a clean `uv pip check`.

Tradeoff:
 this fixes the interpreter mismatch but does not turn the PyPI route into a supported Hermes
installation.
 Mise can install only versions available from that backend.
 PyPI remained on `0.19.0` during
verification.
The curated `all` set also excludes optional messaging and provider SDKs that Hermes intends to install lazily.

### Keep mise as the installation owner

Check or apply upgrades through the same backend that owns the environment:

```bash
mise upgrade --dry-run pipx:hermes-agent
mise upgrade --yes pipx:hermes-agent
```

The dry run completed and reported the published channel up to date.

Tradeoff:
 this prevents Hermes's self-management commands from competing with mise's environment ownership,
 but the retired PyPI channel still cannot supply versions that upstream does not publish there.

### Treat the doctor entry-point message as layout-specific

Before ignoring the warning,
 verify both the command and its environment:

```bash
mise which hermes
hermes --version
hermes_python="$(dirname "$(readlink --canonicalize "$(mise which hermes)")")/python"
mise exec uv -- uv pip check --python "$hermes_python"
```

Tradeoff:
 the command remains usable,
 but `hermes doctor` continues to count the false warning as an issue.
Other doctor findings still require independent attention.

## What does not work

- A plain `pipx:hermes-agent` declaration does not constrain uv's interpreter.
   On this host it initially chose
  Python 3.14.
- Hermes's `<3.14` package metadata does not protect this uv tool install because uv intentionally ignores
  dependency upper bounds.
- `hermes doctor --fix` is not a valid repair for this mise layout.
   The 0.19.0 source would propose an editable
  install from the resolved package directory under `site-packages`.
- Reinstalling the same PyPI release cannot obtain current upstream Hermes code.
   Current upstream source blocks
  wheel and sdist builds outside Nix and lists PyPI installs as unsupported.
- Treating `Up to date` as an upstream-current result is incorrect for the retired PyPI channel.
   It means only
  that no newer version is available through that channel.
- Optional `python-telegram-bot` and `discord.py` doctor warnings do not mean the `all` resolve is incomplete.
  Those SDKs belong to the separate `messaging` extra and lazy-install path.

## Upstream filing decision

No `.out-of-scope/` entry matched Hermes Agent,
 mise,
 pipx,
 uv,
 or Python runtime selection.

Duplicate searches covered open and closed issues and pull requests using the warning text,
 `pipx`,
`Requires-Python`,
 `tool install`,
 and Python-version terms.

- [astral-sh/uv#14110][uv-14110] already tracks `uv tool install` ignoring `Requires-Python` upper bounds.
  The Hermes reproduction confirms behavior already described in that thread and adds no missing mechanism or
  workaround.
   There is nothing additive to comment.
- [NousResearch/hermes-agent#49529][hermes-49529] already tracks the wheel-install doctor false positive.
  [NousResearch/hermes-agent#77428][hermes-77428] contains a candidate fix.
   The installed `0.19.0` release
  predates it.
   There is nothing additive to comment.

The six filing constraints resolve as follows:

1.  **Upstream fault:**
     mixed.
     Hermes's doctor warning is produced by its source-layout assumption,
     but PyPI is
    now an explicitly unsupported distribution.
     Uv's upper-bound behavior is intentional and documented.
    Mise forwards the configuration as documented.
2.  **Upstream can fix it:**
     yes technically.
     Hermes has an open candidate fix.
     Uv maintainers describe strict
    upper-bound handling as possible but difficult.
3.  **Supported use case:**
     no. Hermes rejects PyPI installs as unsupported,
     and uv documents that dependency
    `Requires-Python` upper bounds are ignored.
4.  **Contribution welcome:**
     no for these actions.
     Hermes says PRs for unsupported distribution methods will
    not be accepted.
     Astral's `CONTRIBUTING.md:29-34` incorporates its
    [AI policy][astral-ai-policy],
     which forbids autonomous-agent contributions and AI-generated maintainer
    comments.
5.  **Likely fix:**
     no current basis for this installed channel.
     Hermes retired the channel.
     Uv retains the
    intentional upper-bound rule,
     and its duplicate remains open.
6.  **Minimal compatible prototype:**
     not attempted because constraints 1,
     3,
     4,
     and 5 fail,
     and both findings
    already have upstream tracking artifacts.

No new issue or comment should be filed from this investigation.
 The duplicate threads already contain the
reproduction shape,
 root cause,
 and workaround.

[astral-ai-policy]: https://github.com/astral-sh/.github/blob/main/AI_POLICY.md
[hermes-49529]: https://github.com/NousResearch/hermes-agent/issues/49529
[hermes-77428]: https://github.com/NousResearch/hermes-agent/pull/77428
[hermes-platform-support]: https://hermes-agent.nousresearch.com/docs/getting-started/platform-support
[uv-14110]: https://github.com/astral-sh/uv/issues/14110
