# guardrail

PreToolUse hook that guards Agent tool calls with two checks:
general-purpose blocking and resume polling prevention.

## Problem

Claude attempts general-purpose Agent calls despite CLAUDE.md banning them.
The permission system blocks these, but the error message is generic and doesn't redirect
to `spawn-claude`. Separately, Claude sometimes polls background agents via `resume` calls
instead of waiting for automatic completion notifications.

## Solution

This hook denies Agent calls in two cases:

1. **General-purpose blocking**: when `subagent_type` is missing or `"general-purpose"`,
   the call is denied with a message directing Claude to use `spawn-claude`.
   Specialized agent types (Explore, Plan, etc.) pass through.

2. **Resume blocking**: when the call includes a `resume` parameter,
   it is denied with a message explaining that background agents notify automatically.

## Setup

Add to `.claude/settings.json`:

```jsonc
{
  "hooks": {
    "PreToolUse": [
      {
        "hooks": [{ "type": "command", "command": "ccgr" }],
      },
    ],
  },
}
```

## Binary

**`ccgr`**: Claude Code GuardRail
