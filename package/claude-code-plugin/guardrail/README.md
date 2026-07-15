# guardrail

PreToolUse hook that guards Agent and Bash tool calls with two checks:
resume polling prevention and `bun test` blocking.

## Problem

Claude sometimes polls background agents via `resume` calls instead of waiting
for automatic completion notifications,
 which wastes context tokens on repeated
error messages.
 Separately,
 `bun test` misreports under this repo's custom
`@monochromatic-dev/module-test` harness:
 the harness runs tests as a side
effect of module import,
 so `bun test <file>` prints `PASS` lines and then
reports `0 pass / 0 fail` (bun's runner finds no `bun:test` registrations),
which looks like a broken run when every test passed.

General-purpose Agent calls are no longer blocked here.
 The ban was lifted once
the Claude Code UI let a human observe and message subagent sessions directly;
see `doc/decision/general-purpose-subagent-ban.md`.

## Solution

This hook denies tool calls in two cases:

1. **Resume blocking**:
    when an Agent call includes a `resume` parameter,
   it is denied with a message explaining that background agents notify
   automatically.

2. **`bun test` blocking**:
    when a Bash call invokes `bun test`,
    it is denied
   with a message directing the caller to `mise run //package/<path>:test:unit`
   (or `node <file>` for ad-hoc single-file runs).

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

**`ccgr`**:
 Claude Code GuardRail
