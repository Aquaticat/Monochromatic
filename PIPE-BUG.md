# Claude Code sandbox pipe breakage investigation

Status: **in progress** -- waiting for strace on host after reboot

## Summary

All pipes at the top level of Claude Code's bash sandbox are broken.
`echo hello | cat` produces no output. `echo hello | wc -l` produces no output.
Every piped command silently fails.

Appending `; true` (or any trailing command) after the pipe fixes it:
`echo hello | cat; true` works correctly.

## Evidence

### fd inspection inside the sandbox

Ran `ls -la /proc/self/fd/0` inside the right side of a pipe:

- **Broken** (`echo hello | ls -la /proc/self/fd/0`):
  fd 0 points to `/dev/null`
- **Working** (`echo hello | ls -la /proc/self/fd/0; true`):
  fd 0 points to `pipe:[491709]`

The right side of the pipe is receiving `/dev/null` as its stdin
instead of the pipe read end.

### Impact

- Pipes in Claude Code's Bash tool silently produce no output
- CLAUDE.md documents the workaround: "Don't use pipes in bash tool since they're broken for now.
  Workarounds like redirecting to file then reading the file works."
- The `; true` suffix also works as a workaround but wasn't previously known

## Claude Code's execution model

Claude Code runs each Bash tool invocation inside a bubblewrap (bwrap) sandbox.
The command goes through a nested eval chain before reaching user code.

### Eval chain structure

```
bash -c '...' where the script does:
  eval "source $SNAPSHOT && shopt -u extglob || true && eval \"$USER_CMD\" \< /dev/null && pwd -P >| /tmp/cwd-XXX"
```

### Shell snapshot

Claude Code saves and restores the user's interactive shell state via snapshot files
at `~/.claude/shell-snapshots/`. These snapshots restore:

- **`set -o monitor`** (job control / `set -m`)
- **`set -o onecmd`** (exit after one command / `set -t`)
- Functions, aliases, shell options, PATH, environment variables

### bwrap flags

```
--new-session --die-with-parent --unshare-pid --unshare-net
```

- `--new-session`: calls `setsid()` -- no controlling terminal
- `--unshare-pid`: bash is PID 1 in the namespace
- `--new-session` + `set -m`: job control with no controlling terminal

### Background processes

An EXIT trap kills two background socat proxy processes:

```bash
trap "kill %1 %2 2>/dev/null; exit" EXIT
```

### stdin

Claude Code communicates with bash via a socket.
The outer shell's stdin is this socket.
The inner eval redirects stdin to `/dev/null` via `\< /dev/null`.

## Environment factors that combine to trigger the bug

All of these are required. Removing any single factor does not reproduce the bug:

1. **Socket as stdin** (Claude Code's IPC channel, not a terminal or pipe)
2. **`set -m`** (job control enabled, restored from shell snapshot)
3. **`set -t`** (onecmd/exit-after-one-command, restored from shell snapshot)
4. **bwrap `--new-session`** (no controlling terminal)
5. **bwrap `--unshare-pid`** (bash is PID 1)
6. **Nested eval with `< /dev/null`** redirect on the inner eval
7. **Pipeline as the last command** in the inner eval

## Experimental log

### Pipe tests inside sandbox

All of these produce **no output** (broken):

```bash
echo hello | cat
echo -e "a\nb\nc" | wc -l           # returns 0
echo test | /usr/bin/cat
ls packages/config/eslint/src/ | wc -l  # returns 0
rg -l 'export' packages/ | wc -l     # returns 0
fd -g 'mise.toml' | wc -l            # returns 0
```

All of these **work** (with trailing command or redirect):

```bash
echo hello | cat; true               # returns "hello"
echo hello | cat; echo done          # returns "hello\ndone"
echo hello | cat > /tmp/file.txt     # file contains "hello"
echo "before" && echo hello | cat && echo "after"  # returns all three
rg -l export packages/ | wc -l; true # returns 867
```

Wrapping in `bash -c` also works:

```bash
bash -c 'echo hello | cat'           # returns "hello"
```

### Pipe tests outside sandbox (sandbox disabled)

All pipes work perfectly:

```bash
echo hello | cat                     # returns "hello"
rg -l 'export' packages/ | wc -l    # returns 866
```

### Shell option tests

At the top level of the sandbox:

```bash
set -o | grep -E 'onecmd|monitor'; true  # monitor on, onecmd on
```

Disabling them at top level does **not** fix the bug:

```bash
set +m; echo hello | cat              # still broken
set +t; echo hello | cat              # still broken
set +o monitor; echo hello | cat      # still broken
```

In subshells, they start off and pipes work:

```bash
bash -c 'set -o | grep onecmd'; true   # onecmd off
bash -c 'set -o | grep monitor'; true  # monitor off
bash -c 'set -o onecmd -o monitor; echo hello | cat'  # returns "hello" (works)
```

With the shell snapshot loaded in a subshell:

```bash
bash -c 'source $SNAPSHOT; echo hello | cat'           # returns "hello" (works)
bash -c 'source $SNAPSHOT; set +m; echo hello | cat'   # returns "hello" (works)
```

### fd inspection of the right side of a pipe

**Broken case** (pipeline is last command):

```bash
# Right side of pipe has fd 0 -> /dev/null (NOT the pipe!)
bash -c 'ls -la /proc/self/fd/' | bash -c 'ls -la /proc/self/fd/ > /tmp/right-fds.txt 2>&1; cat > /tmp/left-out.txt'
# right-fds.txt shows: fd 0 -> /dev/null
# left-out.txt is empty
```

**Working case** (with `; true` appended):

```bash
echo hello | bash -c 'ls -la /proc/self/fd/0' > /tmp/right-fd0.txt 2>&1; true
# right-fd0.txt shows: fd 0 -> pipe:[491709]
```

**Data read test**:

```bash
echo hello | bash -c 'read line; echo "got: $line" > /tmp/pipe-data.txt'
# pipe-data.txt contains "got:" (empty -- no data received)
```

### Eval chain reproduction (outside sandbox)

```bash
bash -c 'eval "echo hello | cat" < /dev/null'                    # returns "hello" (works)
bash -c 'eval "echo hello | cat"'                                # returns "hello"
bash -c 'eval "ls /tmp | wc -l" < /dev/null'                     # returns 38
bash -c 'eval "source $SNAPSHOT && eval \"echo hello | cat\" < /dev/null"'  # returns "hello"
```

Same eval chain inside sandbox (in a `bash -c` subshell):

```bash
bash -c 'eval "source $SNAPSHOT && eval \"echo hello | cat\" < /dev/null"'  # returns "hello" (works!)
bash -c 'set -m -t; eval "echo hello | cat" < /dev/null'         # returns "hello" (works)
```

### setsid reproduction attempts (red herring)

`setsid` detaches from the controlling terminal and the forked process gets killed
before output flushes. This breaks ALL output, not just pipes:

```bash
setsid bash -c 'echo hello' > /tmp/test.txt       # empty (all output broken)
setsid bash -c 'echo hello | cat' > /tmp/test.txt  # empty
setsid bash -c 'echo hello | cat; true' > /tmp/test.txt  # empty (even ; true doesn't help)
```

Abandoned this approach -- `setsid` the command forks and exits immediately,
which is a different failure mode from the pipe-specific bug.

### bwrap reproduction attempts

Basic bwrap with all Claude Code flags:

```bash
bwrap --new-session --unshare-pid --unshare-net --dev /dev --proc /proc --ro-bind / / \
  -- bash -c 'set -m -t; echo hello | cat'
# returns "hello" (works, bug does not reproduce)
```

Full Claude Code pattern with background jobs and trap:

```bash
bwrap ... -- bash -c 'sleep 999 & sleep 999 & trap "kill %1 %2 ..." EXIT; \
  eval "set -m -t && eval \"echo hello | cat\" < /tmp/devnull ..."'
# returns "hello" (works, bug does not reproduce)
```

Note: bwrap's `--dev /dev` creates a minimal `/dev` without a writable `/dev/null`,
so `/tmp/devnull` (an empty file) was used as a substitute.

### bwrap in Podman with strace

Ran full reproduction with strace in a privileged Podman container:

```bash
podman run --rm --privileged fedora:42 bash -c '
  dnf install -y strace bubblewrap ...
  bwrap ... -- bash -c "set -m -t; eval \"echo hello | cat\" < /tmp/devnull"
'
```

Both broken pattern and working pattern produced output correctly.
Strace showed `write(1, "hello\n", 6)` in both cases.
**Bug did not reproduce** even with all matching bwrap flags.

### xtrace analysis

Bash xtrace (`set -x`) inside the sandbox:

**Broken case** (`echo hello | cat` as last command):

```
+++ echo hello
+++ cat
++ pwd -P
+ kill %1 %2
+ exit
```

**Working case** (`echo hello | cat; true`):

```
+++ cat
+++ echo hello
+++ true
++ pwd -P
+ kill %1 %2
+ exit
```

Both show the pipeline commands executing. The difference is that in the broken case,
`pwd -P` (Claude Code's CWD tracking) runs immediately after the pipe.

### Strace attempts on host (failed)

- `strace` not installed on host (Fedora Atomic/Bazzite, immutable)
- Static strace binary download failed (GitHub release URL issues)
- Copying strace from Podman container failed (permission denied)
- User is installing strace via `rpm-ostree install` (requires reboot)

### Environment inspection

```bash
which bwrap && bwrap --version     # /usr/bin/bwrap, bubblewrap 0.11.0
cat /proc/self/cgroup              # user slice, ptyxis-spawn scope
```

Top-level sandbox process:

```bash
ls -la /proc/self/fd/
# fd 0 -> socket:[406120]  (Claude Code's IPC socket)
# fd 1 -> /tmp/claude-1000/.../tasks/XXX.output
# fd 2 -> /tmp/claude-1000/.../tasks/XXX.output
```

Process tree inside sandbox:

```
bwrap (PID 1)
  bash (PID 2) -- the wrapper shell with socat, trap, eval
    socat (background, HTTP proxy)
    socat (background, SOCKS proxy)
```

No seccomp filters active (`Seccomp: 0`, `Seccomp_filters: 0`).

## Reproduction summary

### What reproduces the bug

- Any pipe as the last command at the top level of the Claude Code sandbox

### What does NOT reproduce the bug

- Pipes inside `bash -c '...'` subshells (even inside the sandbox)
- Pipes with a trailing command (`; true`, `; echo done`, `&& echo after`)
- Pipes with output redirected to a file (`| cat > /tmp/file.txt`)
- Pipes outside the sandbox (sandbox disabled)
- `setsid bash -c '...'` (breaks everything, not pipe-specific)
- bwrap with matching flags in Podman (even with strace, even privileged)
- The eval chain with `< /dev/null` in any context outside Claude Code

### Why reproduction failed

The socket-as-stdin appears to be the missing ingredient that cannot be easily replicated.
Claude Code's bash process receives a Unix socket as fd 0 (its IPC channel).
Normal reproduction attempts use a terminal or pipe as stdin.

## Bash source code analysis

Bash source cloned to `~/temp/bash-src/` (version matches system bash).

### Relevant code paths

#### Pipeline execution: `execute_cmd.c`

- **`execute_pipeline()`** (line 2620): Creates pipes between commands using `pipe()`,
  then forks child processes for each pipeline component.
  Passes pipe file descriptors down to child setup.

- **`execute_connection()`** (line 2811): Handles `|`, `&&`, `||`, `;` connectors.
  For pipes, calls `execute_pipeline()`.

- **`execute_disk_command()`** (line 5770): Forks the child process for an external command.
  In the forked child, calls:
  1. `do_piping(pipe_in, pipe_out)` at line 5870 -- sets up pipe fds
  2. `do_redirections(redirects, RX_ACTIVE)` at line 5884 -- applies redirects

- **`do_piping()`** (line 6375): The function that should connect pipe stdin:
  ```c
  if (pipe_in != NO_PIPE)
    {
      if (dup2 (pipe_in, 0) < 0)
        dup_error (pipe_in, 0);
      if (pipe_in > 0)
        close (pipe_in);
    }
  ```
  This `dup2(pipe_in, 0)` should set fd 0 to the pipe read end.
  But fd 0 ends up as `/dev/null` in the broken case.

#### Key ordering: piping runs before redirections

In `execute_disk_command()`, the child process calls `do_piping()` first,
then `do_redirections()`. If the `< /dev/null` redirect from the eval
propagates down to the pipeline component's redirect list,
it would **overwrite** the pipe fd that `do_piping()` just set up.

#### Eval and fork optimization: `builtins/evalstring.c`

- **`should_suppress_fork()`** (line 125): ONESHOT optimization that avoids forking
  for the last command. Requires `job_control_active_p() == 0`.
  With `set -m`, job control is active, so this optimization is disabled.

- **`optimize_connection_fork()`** (line 148): Sets `CMD_NO_FORK` on the last
  simple command in connection chains (`;`, `&&`, `||`).

- **`parse_and_execute()`** (line 315): Main entry for eval'd strings.

#### Eval builtin: `builtins/eval.def`

The `eval` builtin passes `SEVAL_NOHIST|SEVAL_NOOPTIMIZE` to `parse_and_execute()`,
which disables the ONESHOT fork suppression.

#### Shell main: `shell.c`

`run_one_command()` (line 1457) passes `SEVAL_NOHIST|SEVAL_RESETLINE`
but does **not** pass `SEVAL_NOOPTIMIZE`.
This means the outer eval (from `bash -c`) could still optimize,
while the inner eval (the `eval` builtin) cannot.

#### set -t effect: `eval.c`

Line 206-207: `if (just_one_command) EOF_Reached = EOF;`
After executing one command with `set -t`, bash sets EOF to exit.
This interacts with pipeline cleanup and job control teardown.

## Primary hypothesis

The `< /dev/null` redirect attached to the inner `eval` builtin call propagates
through bash's redirect chain to the pipeline components.

When the pipeline is the **last command** in the eval string,
bash's redirect handling applies the eval's `< /dev/null` to the rightmost
pipeline component's redirect list. Since `do_redirections()` runs **after**
`do_piping()`, the `/dev/null` redirect overwrites the pipe connection
that `do_piping()` just established via `dup2(pipe_in, 0)`.

When there's a trailing `; true`, the pipeline is no longer the last command.
The connection node (`cmd1 | cmd2 ; true`) changes how bash propagates
the eval's redirects, so the pipeline components don't inherit `< /dev/null`.

### Why this only triggers in Claude Code's environment

The combination of socket-as-stdin, `set -m` (job control without a terminal),
`set -t` (onecmd), and bwrap's PID/session namespace likely changes
bash's internal redirect propagation or fork/exec decisions in a way
that causes the eval's `< /dev/null` to leak into pipeline components.

Without all these factors present, bash follows a different code path
where the eval's redirect does not propagate into the pipeline.

## Next steps

### 1. strace the broken case (primary)

After reboot (strace being installed on host), run inside Claude Code's sandbox:

```bash
strace -f -e trace=dup2,pipe2,open,openat,close bash -c 'eval "echo hello | cat" < /dev/null' 2>/tmp/strace-broken.log; true
```

```bash
strace -f -e trace=dup2,pipe2,open,openat,close bash -c 'eval "echo hello | cat; true" < /dev/null' 2>/tmp/strace-working.log; true
```

**What to look for in the strace output**:

1. In the `cat` child process (after fork): does `dup2(pipe_fd, 0)` appear?
2. After that `dup2`, does another `dup2(devnull_fd, 0)` appear that overwrites it?
3. What fd number does `open("/dev/null", ...)` return in the child?
4. Compare the two traces -- where do they diverge?

### 2. Test with individual factors removed

Systematically test inside the sandbox with each factor removed:

```bash
# Without set -m
set +m; echo hello | cat; true

# Without set -t
set +t; echo hello | cat; true

# Without < /dev/null (if possible to test)
```

### 3. Check redirect propagation in bash source

Trace how `add_undo_redirect()` and the redirect list are built
when `eval "pipeline" < /dev/null` is parsed.
Specifically look at whether the `< /dev/null` redirect gets added
to the pipeline's last command's redirect list
vs. being handled at the eval/subshell level.

Key functions to examine:
- `add_exec_redirect()` in `execute_cmd.c`
- How `execute_builtin()` handles the eval builtin's redirects
- Whether `execute_command_internal()` passes parent redirects
  to `execute_pipeline()` and how those merge with per-command redirects
