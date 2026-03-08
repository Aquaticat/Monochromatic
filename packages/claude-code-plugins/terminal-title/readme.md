# cc-terminal-title

Claude Code hook that sets the terminal tab title to reflect current activity.

## What it shows

- **Bash**: `Claude: Running git status`
- **Read**: `Claude: Reading index.ts`
- **Edit/Write**: `Claude: Editing foo.ts`
- **Grep**: `Claude: Searching "pattern"`
- **Agent**: `Claude: Agent: find API endpoints`
- **WebSearch**: `Claude: Searching "react hooks"`
- **WebFetch**: `Claude: Fetching example.com`
- **Stop**: `Claude: Idle`

## Terminal compatibility

Works with any terminal that supports OSC 0 title sequences:
Ptyxis, Konsole, Wezterm, Ghostty, iTerm2, kitty, and others.

## How it works

The hook receives JSON on stdin from Claude Code,
extracts a descriptive summary based on the tool and its input,
and writes `\x1b]0;title\x07` directly to `/dev/tty`.

Hooks run outside the sandbox, so `/dev/tty` is accessible.

## Setup

Hooks are configured in `.claude/settings.local.json` under `PreToolUse` and `Stop` events,
pointing to `bun packages/claude-code-plugins/cc-terminal-title/src/hook.ts`.
