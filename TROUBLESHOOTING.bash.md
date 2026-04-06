# Bash and CLI troubleshooting

## `2>&1 > file` splits stderr and stdout, producing interleaved output

### Problem

Capturing combined stdout+stderr to a file with `cmd 2>&1 > file; cat file`
produces output where stderr and stdout lines appear in the wrong order,
making it impossible to determine the actual execution sequence.

This was discovered when verifying that `mise run //pkg:build` completes
before `bun test` starts in the `buildAndTest` task.
The build-completion lines appeared **after** test results,
suggesting concurrent execution -- but the commands were actually sequential.

### Root cause

Bash processes redirections left-to-right, and each one operates on the fd table **as it exists at that point**:

```bash
cmd 2>&1 > file
```

1. `2>&1` -- duplicate fd 1 (currently the terminal) onto fd 2. Stderr now points to the **terminal**.
2. `> file` -- redirect fd 1 to `file`. Stdout now points to **file**.

Result: stderr goes to the terminal, stdout goes to the file.
`cat file` then shows only stdout.
The terminal separately showed stderr.
When both are captured by an outer process (like Claude Code's Bash tool),
the two streams recombine with unpredictable interleaving.

### Fix

Place the file redirect **before** the fd duplication:

```bash
# Correct: both stdout and stderr go to the file
cmd > file 2>&1; cat file

# Also correct: subshell redirect captures both
(cmd) > file 2>&1; cat file
```

With `> file 2>&1`:

1. `> file` -- redirect fd 1 to `file`.
2. `2>&1` -- duplicate fd 1 (now `file`) onto fd 2. Stderr also points to **file**.

### Alternatively, use `2>&1` without a file redirect

When the goal is simply to see combined output in order (not to save it),
pipe both streams together without a file:

```bash
cmd 2>&1
```

This is what worked for verifying the `buildAndTest` task's execution order.
