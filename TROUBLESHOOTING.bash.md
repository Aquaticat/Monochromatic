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

## rg `--glob` finds files but `-l` with a content pattern does not

### Problem

Searching for test files with rg returns far fewer results than expected,
appearing to skip files in directories with spaces:

```bash
# Returns 3 files -- all in paths without spaces
rg --glob '*.test.ts' -l '\.test\.' packages/

# Returns 81 files -- including paths with spaces
rg --files --glob '*.test.ts' packages/
```

The missing files seem correlated with spaces in paths,
but spaces are a red herring.

### Root cause

`--glob` and `-l` serve different purposes:

- `--glob '*.test.ts'` filters **which files to search** (by file name)
- `-l '\.test\.'` searches **file contents** for the regex `\.test\.`

The 3 files that matched happen to contain the literal string `.test.`
somewhere in their source code (e.g. in an import path or comment).
The other 78 test files contain `test` (from `bun:test`, `test(...)`)
but never `.test.` surrounded by dots.

The spaces in directory names had no effect --
rg handles spaces in paths correctly.

### Fix

Use `--files` with `--glob` to list files by name pattern,
not `-l` with a content regex:

```bash
# List files whose NAME matches *.test.ts (no content search)
rg --files --glob '*.test.ts' packages/

# Search file CONTENTS for "test" in files named *.test.ts
rg --glob '*.test.ts' -l 'test' packages/

# These are different operations -- don't confuse them
```

### How this confusion arises

When debugging "rg can't find my files," the first instinct is to suspect
path handling (spaces, special characters, symlinks).
The actual cause -- a content pattern that doesn't match -- is invisible
because you never see which files rg searched and rejected.
Adding `--debug` or switching to `--files --glob` immediately reveals
whether the issue is file discovery or content matching.
