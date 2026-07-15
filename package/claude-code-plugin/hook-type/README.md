# @monochromatic-dev/claude-code-plugin-hook-type

TypeScript type definitions for all 18 Claude Code hook events,
sourced from the [official hooks reference](https://docs.anthropic.com/en/docs/claude-code/hooks).

## Usage

```ts
import type {
  HookInput,
  PreToolUseInput,
} from '@monochromatic-dev/claude-code-plugin-hook-type';

const event = JSON.parse(raw,) as HookInput;

switch (event.hook_event_name) {
  case 'PreToolUse':
    console.log(event.tool_name, event.tool_input,);
    break;
  case 'Stop':
    console.log(event.stop_hook_active,);
    break;
}
```

The `HookInput` discriminated union narrows via `hook_event_name`,
giving you typed access to event-specific fields after a type guard.

## Covered events

SessionStart,
 InstructionsLoaded,
 UserPromptSubmit,
 PreToolUse,
 PermissionRequest,
PostToolUse,
 PostToolUseFailure,
 Notification,
 SubagentStart,
 SubagentStop,
 Stop,
TeammateIdle,
 TaskCompleted,
 ConfigChange,
 WorktreeCreate,
 WorktreeRemove,
PreCompact,
 SessionEnd.

## Tool input types

Built-in tool input shapes are exported individually
(`BashToolInput`,
 `EditToolInput`,
 `ReadToolInput`,
 etc.)
and as a `BuiltInToolInputMap` for indexed access by tool name.
MCP tool inputs remain `Record<string, unknown>`.
