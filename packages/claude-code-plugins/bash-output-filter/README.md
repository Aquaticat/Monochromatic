# bash-output-filter

Claude Code PreToolUse hook that pipes Bash tool output through a text filter
to strip wasteful patterns before the model sees them.

## Problem

Bash tool outputs contain patterns that waste tokens without providing value to the model:

- **Git commit boilerplate**:
   `create mode 100644` lines repeated per file (~5% of all Bash output)
- **Git transport progress**:
   `Enumerating objects`,
   `Counting objects`,
   `Writing objects` counters
- **Long lines**:
   minified JS/CSS lines thousands of chars long (~5% of output)
- **Repeated diagnostics**:
   linters emitting the same message for every violation (~2%)
- **Trailing whitespace**:
   spaces and tabs at end of lines

Combined,
 these account for ~12% of all Bash tool output tokens across typical sessions.

## How it works

The hook intercepts Bash tool calls at PreToolUse and rewrites the command to pipe
through a TypeScript filter:

```text
original_command 2>&1 | node ccbof-filter.mjs; _bof=${PIPESTATUS[0]}; (exit $_bof)
```

**Key design decisions:
**

- **Filter-by-default with denylist**:
   all commands are filtered unless they match
  a denylist (binary tools,
   file redirects,
   background processes,
   double-wrapping)
- **Runs inside the sandbox**:
   the filter executes as the right side of a pipe,
  inheriting the sandbox's filesystem and network restrictions
- **Preserves exit codes**:
   `PIPESTATUS[0]` captures the original command's exit code
  and replays it via `(exit $_bof)` so Claude Code sees failures correctly
- **Works with the pipe bug**:
   the sandbox's `< /dev/null` redirect
  lands on `(exit $_bof)` (the last simple command),
   not the filter

## Filter transformations

1. **Git file mode lines**:
    strips `create mode`,
    `delete mode`,
    `copy mode`,
   `rename`,
    `mode change` lines from commit output
2. **Git transport progress**:
    strips `Enumerating objects`,
    `Counting objects`,
   `Compressing objects`,
    `Writing objects`,
    `Total`,
    `Resolving deltas`,
   `Unpacking objects`,
    and their `remote:` prefixed variants
3. **Long line truncation**:
    lines over 500 characters are truncated with
   `... [N chars]` marker
4. **Consecutive duplicate collapsing**:
    3+ identical consecutive lines become
   `line (x6 repeated lines)` notation
5. **Trailing whitespace**:
    spaces and tabs at end of lines are removed

## Denylist

Commands matching these patterns are **not** filtered:

- Binary/hex tools (`xxd`,
   `hexdump`,
   `base64`,
   `tar`,
   `gzip`,
   etc.)
- Output redirections (`> file`,
   `>> file`)
- Commands already using the filter (`ccbof-filter`)
- Background commands (`&`,
   `nohup`,
   `setsid`)
- Interactive docker/podman exec/run
- `bun build` (structured output needed for verification)

## Setup

The plugin is registered via `.claude-plugin/plugin.json` and hooks into `PreToolUse`
with a `Bash` matcher.
 No manual configuration needed beyond installing the plugin.
