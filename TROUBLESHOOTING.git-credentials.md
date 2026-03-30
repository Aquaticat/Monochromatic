# Git credential helper troubleshooting

## `git push` fails after mise upgrades `gh`

### Problem

`git push` fails intermittently with authentication errors.
Running `gh auth setup-git` restores credentials, but the fix does not persist
across `gh` version upgrades.

### Minimal repro

```sh
# Working state
git push  # succeeds

# mise upgrades gh (e.g. 2.89.0 -> 2.90.0)
mise upgrade gh

# Broken state
git push  # fails with credential/auth error

# Temporary fix
gh auth setup-git  # rewrites gitconfig with new versioned path
git push  # succeeds again, until next upgrade
```

### Root cause

`gh auth setup-git` resolves its own binary path via `os.Executable()` and writes
an absolute version-pinned path into `~/.gitconfig`:

```ini
[credential "https://github.com"]
    helper =
    helper = !/var/home/user/.local/share/mise/installs/gh/2.89.0/gh_2.89.0_linux_amd64/bin/gh auth git-credential
```

The relevant code path in [cli/cli](https://github.com/cli/cli):

1. `pkg/cmd/auth/setupgit/setupgit.go:56` -- calls `f.Executable()` to get the binary path
2. `pkg/cmdutil/factory.go:42-51` -- checks `GH_PATH` env var first; if unset, calls `executable()`
3. `pkg/cmdutil/factory.go:69-105` -- `executable()` uses `os.Executable()` to get the process path,
   then scans PATH for a symlink that resolves to the same real binary via `filepath.EvalSymlinks`

The symlink detection is designed for Homebrew (where `/usr/local/bin/gh` symlinks to
`/usr/local/Cellar/gh/<version>/bin/gh`). It fails with mise because mise shims work differently:

- Mise shim: `~/.local/share/mise/shims/gh` -> `~/.local/bin/mise` (the mise binary itself)
- `filepath.EvalSymlinks` on the shim resolves to the **mise binary**, not the gh binary
- The comparison at `factory.go:98` (`realP == realExe`) fails because mise != gh
- Falls back to the versioned install path from `os.Executable()`

When mise installs a new gh version, the old versioned directory
(e.g. `mise/installs/gh/2.89.0/`) is removed, and the gitconfig entry points to a nonexistent binary.

### Verified in

- mise 2026.3.8 linux-x64
- gh 2.89.0

### Solution

Two changes, both required:

**Fix 1: Replace versioned paths in `~/.gitconfig` with the stable mise shim path**

```ini
[credential "https://github.com"]
    helper =
    helper = !/var/home/user/.local/share/mise/shims/gh auth git-credential
[credential "https://gist.github.com"]
    helper =
    helper = !/var/home/user/.local/share/mise/shims/gh auth git-credential
```

The shim is a symlink to the mise binary, which dynamically resolves the correct gh version at runtime.
It survives version upgrades because the shim path never changes.

**Fix 2: Set `GH_PATH` so future `gh auth setup-git` writes the shim path**

In `~/.config/mise/config.toml`:

```toml
[env]
# Prevents `gh auth setup-git` from writing a version-pinned absolute path
# into ~/.gitconfig. Without this, mise upgrades break the credential helper.
# See: https://github.com/cli/cli/blob/trunk/pkg/cmdutil/factory.go
GH_PATH = "/var/home/user/.local/share/mise/shims/gh"
```

`factory.go:43-46` checks `GH_PATH` before calling `os.Executable()`.
With this env var set, `gh auth setup-git` writes the shim path instead of the versioned path.

### What does not work

- Running `gh auth setup-git` after each upgrade -- rewrites the versioned path every time;
  the fix is temporary by design
- Setting the credential helper to bare `gh` (no absolute path) -- Homebrew's `brew update`
  runs git commands without `/usr/local/bin` in PATH, so bare `gh` fails in that context.
  The gh authors intentionally use absolute paths to work around this
  (see comment at `factory.go:57-68`). Not a problem for mise users since the shim path is absolute.
- Expecting `gh auth setup-git` to detect mise shims -- the symlink resolution logic
  cannot follow the mise shim indirection (shim -> mise binary, not shim -> gh binary)

### Additional note on token type

`gh auth status` may show a `gho_*` token (OAuth) rather than a `ghp_*` token (PAT).
OAuth tokens can expire independently of the credential helper path issue.
If credentials fail even with a correct shim path, check `gh auth status` for token expiry
and re-authenticate with `gh auth login`.
