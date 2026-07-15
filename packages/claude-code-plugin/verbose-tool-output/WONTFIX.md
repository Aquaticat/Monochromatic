# verbose-tool-output plugin; won't fix

PostToolUse hook plugin that would print full tool output to the terminal,
compensating for Claude Code's renderer which only shows summary lines like "Read 200 lines".

## Status: abandoned

Claude Code's ink-based TUI renderer makes this approach unviable.
No output channel available to PostToolUse hooks can reliably display content
inline in the terminal without corruption.

## Investigation (2026-03-25)

### Problem

Claude Code's "verbose output" setting controls turn-by-turn agentic flow visibility
but does not display the actual content returned by tools (Read,
 Grep,
 Bash,
 etc.).
The user sees "Read 200 lines" but never the 200 lines themselves.

### Attempted solution

A PostToolUse hook that receives `tool_response` on stdin and writes the content
to the terminal so the user can see what Claude sees.

### Channels tested

#### `/dev/tty` (direct terminal write)

- Result:
   **garbled output**
- The write reaches the terminal content area,
   but ink repaints over it immediately.
  The hook's output gets interleaved with ink's render pass,
   producing corrupted text.
  Observed:
   `Readi5ilines1m 36s` instead of `Read 5 lines`:
   the tty marker text
  was spliced into the middle of ink's summary line.
- OSC escape sequences (used by `terminal-title`) work because they modify the
  terminal title bar,
   not the content area.
   Arbitrary visible text does not survive.

#### stderr

- Result:
   **completely swallowed**
- No trace of stderr output appeared in the terminal.
  ink likely captures or redirects stderr from child processes.

### Channels not tested (and why)

#### `systemMessage` (hook JSON output)

- The hook can return `{"systemMessage": "..."}` which Claude Code displays in its UI.
- Not suitable for full file contents:
   designed for short status messages,
  likely truncated or poorly formatted for multi-hundred-line output.

#### `additionalContext` (hook JSON output)

- Injects text back into Claude's context budget.
- Defeats the purpose:
   the goal was to show content to the user
  without polluting the model's context.

### Workarounds that would work but aren't worth a plugin

- **Log file + tail -f** in a split pane:
   hook appends to a file,
   user watches it.
  Simple but requires manual terminal setup on every session.
- **Named pipe (FIFO)**:
   same idea with slightly better ergonomics.
- **Dedicated side-channel terminal**:
   hook writes to a specific pts.
  Fragile and platform-specific.

All of these shift the problem to "user must maintain a second terminal,
"
which is not meaningfully better than reading the conversation JSON logs.

### Root cause

Claude Code uses [ink](https://github.com/vadimdemedes/ink) (React for CLIs)
which takes full control of the terminal's alternate screen / content area.
Any writes to the content area from outside ink's render tree are immediately
overwritten or corrupted on the next render cycle.

This is a fundamental architectural constraint of ink-based TUIs,
not a bug that can be worked around from a hook.

### What would actually fix this

An upstream change to Claude Code's renderer that optionally displays
tool output inline,
 controlled by a setting or verbosity level.
The data is already present in the conversation;
 only the renderer suppresses it.

## Original plan (preserved for reference)

### Motivation

A PostToolUse hook plugin covering Read,
 Grep,
 and Bash tools,
writing formatted tool responses to `/dev/tty` with ANSI dim headers,
line numbers,
 and configurable truncation.

### Package structure

Would have followed the `terminal-title` plugin pattern:
TypeScript entry point built with tsdown,
 distributed as a compiled JS hook,
using `hook-types` and `hook-utils` workspace dependencies.
