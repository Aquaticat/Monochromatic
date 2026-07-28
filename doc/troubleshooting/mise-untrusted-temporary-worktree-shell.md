# mise rejects a trusted repository config copied into a new temporary worktree path

## Symptom

A background command started with a fresh Git worktree as its current directory failed before pnpm ran:

```text
mise ERROR error parsing config file: .../wg-lock.xiO9ehOx/mise.toml
mise ERROR Config files in .../wg-lock.xiO9ehOx/mise.toml are not trusted.
bash: command not found: pnpm
```

The source repository's `mise.toml` was already trusted.
The temporary worktree contained the same committed config bytes at a new path.

## Root cause

mise trust applies to the config path being loaded,
not to every future copy of the same repository config.
A newly-created worktree therefore presents an untrusted path.

The process harness starts a shell in the requested working directory.
That shell's mise integration tries to load the worktree config before executing the requested command.
In this non-interactive background process it cannot prompt,
so config loading fails and mise-provided tools such as pnpm are absent from `PATH`.
The later `command not found` is a consequence of the mise trust diagnostic,
not evidence that pnpm is uninstalled.

Current `mise help trust` states that trust allows mise to parse a config which can execute code or affect the
environment.
It also states that an untrusted config may fail when mise cannot prompt.

## Verification

Observed on 2026-07-28 with mise 2026.7.0 and a detached worktree created from the current repository commit.
The process exited 127 without invoking pnpm.

Running pnpm from the already-trusted main worktree while passing the temporary worktree through pnpm's `--dir`
option avoids loading the temporary path during shell startup.
The pnpm operation still targets the disposable worktree.

## Verified workarounds

### Start in a trusted directory and pass the target explicitly

```console
pnpm --dir /path/to/temporary-worktree install --lockfile-only
```

Set the process working directory to an already-trusted repository or another directory whose shell startup does not
load the temporary config.
Use the target tool's native directory option.

Tradeoff:
 this works only when the target tool can address its working tree explicitly.
It is preferable for one command because it adds no persistent trust record.

### Declare the inspected config path for the process

After inspecting the copied config,
set:

```console
MISE_TRUSTED_CONFIG_PATHS=/path/to/temporary-worktree/mise.toml command
```

Tradeoff:
 this authorizes that config for the process.
Use an exact path and do not widen it to an uninspected directory tree.

### Persist trust for the temporary config

```console
mise trust /path/to/temporary-worktree/mise.toml
```

Tradeoff:
 this creates persistent trust state for a disposable path that will soon disappear.
It is appropriate only when the worktree will be reused and its config has been inspected.

## What does not work

- Retrying the same background command with the same untrusted working directory reaches the same trust check.
- Assuming trust follows repository identity does not work;
  the new worktree path is independently evaluated.
- Treating `command not found: pnpm` as the primary failure sends diagnosis in the wrong direction.
  The preceding mise trust error explains why the tool path was not activated.

## Upstream filing decision

No upstream issue or pull-request draft is warranted.
Trusting a config by path and refusing to prompt in a background process are intended security behavior.
The local correction is to choose a trusted startup directory or explicitly trust the inspected temporary config.
