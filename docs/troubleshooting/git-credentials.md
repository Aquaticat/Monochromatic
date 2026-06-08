# `gh auth setup-git` writes a version-pinned absolute path into `~/.gitconfig`, breaking `git push` on every `mise upgrade gh`

## Symptom

`git push` works.
 `mise upgrade gh` runs successfully (e.g. moves
gh from 2.89.0 to 2.90.0).
 `git push` now fails with an
authentication error.
 Running `gh auth setup-git` again restores
credentials,
 but the fix lasts only until the next upgrade.

```sh
git push                 # works
mise upgrade gh          # upgrades 2.89.0 -> 2.90.0
git push                 # auth failure
gh auth setup-git        # rewrites gitconfig with new versioned path
git push                 # works again, until next upgrade
```

## Root cause

`gh auth setup-git` resolves its own binary path via
`os.Executable()` and writes that absolute version-pinned path
into `~/.gitconfig`:

```ini
[credential "https://github.com"]
    helper =
    helper = !/var/home/user/.local/share/mise/installs/gh/2.89.0/gh_2.89.0_linux_amd64/bin/gh auth git-credential
```

Source citations from [cli/cli](https://github.com/cli/cli):

- `pkg/cmd/auth/setupgit/setupgit.go:56`:
   calls `f.Executable()`
  to get the binary path:

```go
// Approximate excerpt from the referenced file
path, err := f.Executable()
```

- `pkg/cmdutil/factory.go:42-51`:
   checks `GH_PATH` env var
  first;
   if unset,
   calls `executable()`:

```go
if path := os.Getenv("GH_PATH"); path != "" {
    return path, nil
}
return executable()
```

- `pkg/cmdutil/factory.go:69-105`:
   `executable()` calls
  `os.Executable()` to get the running binary,
   then scans
  `$PATH` for any symlink whose `filepath.EvalSymlinks` target
  equals the same real binary.
   The intent is to prefer a stable
  Homebrew-style symlink (e.g. `/usr/local/bin/gh`) over the
  versioned cellar path.

The symlink walk is designed for Homebrew:

- `/usr/local/bin/gh` -> `/usr/local/Cellar/gh/<version>/bin/gh`

With mise it fails:

- Mise shim:
   `~/.local/share/mise/shims/gh` ->
  `~/.local/bin/mise` (the mise binary itself,
   not the gh
  binary).
- `filepath.EvalSymlinks` on the shim resolves to the **mise
  binary**,
   not the gh binary.
- The comparison at `factory.go:98` (`realP == realExe`) fails
  because `mise != gh`.
- The fallback returns the versioned install path from
  `os.Executable()`.

When mise installs a new gh version,
 the old versioned directory
(`mise/installs/gh/2.89.0/`) is removed,
 and the gitconfig entry
points to a nonexistent binary.
 The credential helper invocation
fails;
 git falls back to interactive auth or errors out.

## Verification

Versions under test:

- mise 2026.3.8 linux-x64
- gh 2.89.0 (before upgrade),
   2.90.0 (after)
- git 2.45+

Reproduce:
 install gh via mise;
 run `gh auth setup-git`;
 inspect
`~/.gitconfig` to see the versioned path;
 run `mise upgrade gh`;
attempt `git push`;
 observe the auth failure.

## Verified workaround: rewrite to the stable mise shim path + set `GH_PATH` env

Two changes,
 both required.

### Fix 1: Replace versioned paths in `~/.gitconfig` with the stable mise shim

```ini
[credential "https://github.com"]
    helper =
    helper = !/var/home/user/.local/share/mise/shims/gh auth git-credential
[credential "https://gist.github.com"]
    helper =
    helper = !/var/home/user/.local/share/mise/shims/gh auth git-credential
```

The shim is a symlink to the mise binary,
 which dynamically
resolves the correct gh version at runtime.
 The shim path never
changes across upgrades.

Tradeoff:
 the gitconfig is hand-edited;
 future `gh auth
setup-git` invocations will overwrite it back to the versioned
path unless Fix 2 is also applied.

### Fix 2: Set `GH_PATH` so future `gh auth setup-git` writes the shim path

In `~/.config/mise/config.toml`:

```toml
[env]
# Prevents `gh auth setup-git` from writing a version-pinned absolute
# path into ~/.gitconfig. Without this, mise upgrades break the
# credential helper. See:
# https://github.com/cli/cli/blob/trunk/pkg/cmdutil/factory.go
GH_PATH = "/var/home/user/.local/share/mise/shims/gh"
```

`factory.go:43-46` checks `GH_PATH` before calling
`os.Executable()`.
 With this env var set,
 `gh auth setup-git`
writes the shim path instead of the versioned path.

Tradeoff:
 `GH_PATH` overrides gh's own resolution everywhere,
 not
just for `setup-git`.
 Acceptable because the shim is the correct
binary in all gh invocations on this machine.

## What does not work

- Running `gh auth setup-git` after each upgrade:
   rewrites the
  versioned path every time;
   fix is temporary by design.
- Setting the credential helper to bare `gh` (no absolute path):
  Homebrew's `brew update` runs git commands without
  `/usr/local/bin` in PATH,
   so bare `gh` fails in that context.
  The gh authors intentionally use absolute paths to work around
  this (see comment at `factory.go:57-68`).
   Not a problem for
  mise users since the shim path is absolute.
- Expecting `gh auth setup-git` to detect mise shims:
   the
  symlink resolution logic cannot follow the mise shim
  indirection (shim -> mise binary,
   not shim -> gh binary).

## Token expiry note

`gh auth status` may show a `gho_*` token (OAuth) rather than a
`ghp_*` token (PAT).
 OAuth tokens can expire independently of
the credential-helper path issue.
 If credentials fail even with
a correct shim path,
 check `gh auth status` for token expiry and
re-authenticate via `gh auth login`.

## Why we do not file this upstream

1. **Is it really upstream's fault?
   ** Borderline.
    gh's
   absolute-path discipline is correct for Homebrew.
    The mise
   shim layout breaks the symlink-walk heuristic;
    that is a
   compatibility gap,
    not a defect.
2. **Can upstream fix it?
   ** Yes;
    extend `executable()` to
   recognise mise shims (e.g. follow the shim,
    run `gh --version`
   on the resolved target,
    compare versions).
    Non-trivial.
3. **Are they supporting this use case?
   ** mise is not explicitly
   supported;
    the `GH_PATH` escape hatch is the documented
   override.
4. **Will they likely fix it?
   ** Probably not without a PR.
5. **Have we prototyped a minimal fix?
   ** No.

Decision:
 no upstream report at this time.
 The
shim-path-plus-`GH_PATH` workaround is small and stable.
