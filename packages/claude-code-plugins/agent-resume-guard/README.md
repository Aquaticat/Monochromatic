# agent-resume-guard

PreToolUse hook that blocks Agent tool calls containing a `resume` parameter.

## Problem

When Claude launches background agents, the system notifies automatically on completion.
However, the model sometimes enters a polling loop -- repeatedly trying to `resume` still-running agents,
which fails immediately and wastes context tokens on repeated error messages.

## Solution

This hook denies any `Agent` call that includes `resume`, returning an explanation
that directs Claude to wait for the automatic completion notification instead.

## Setup

Add to `.claude/settings.json`:

```jsonc
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Agent",
        "hooks": [{ "type": "command", "command": "ccarg" }]
      }
    ]
  }
}
```

## Binary

**`ccarg`** -- Claude Code Agent Resume Guard
