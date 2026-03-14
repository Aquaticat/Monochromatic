# claude-spawn

Claude Code plugin that spawns steerable child Claude Code sessions in terminal windows
with automatic result forwarding via hooks.

## How it works

The plugin has two components: an MCP server and a set of hooks.

### MCP server (`spawn_claude` tool)

Launches a child Claude session in a new terminal window via `terminal-exec`.
Sets environment variables on the child (`CLAUDE_SPAWN_ID`, `CLAUDE_SPAWNED_BY_SESSION`)
that identify it as a spawned session and link it to its parent.
Returns a `spawnId` immediately without waiting for the child to finish.

### Hooks (automatic result forwarding)

Since all Claude sessions in the workspace share the same hooks, the child session
self-reports its state through the shared hook infrastructure:

- **SessionStart**: writes a PID-to-session mapping (for MCP server coordination)
  and registers child sessions in `~/.claude/spawn-results/spawns/`
- **Stop**: updates the child's `lastMessage` with the latest assistant response
- **SessionEnd**: marks the child as `"stopped"`
- **PreToolUse, PostToolUse, PostToolUseFailure, UserPromptSubmit, Notification,
  SubagentStart, SessionStart**: checks for completed children and injects their
  results into the parent's context via `additionalContext`

Results appear in the parent at the earliest possible moment: between tool calls
if the parent is actively working, or on the next user message if idle.

## Nesting

Arbitrary nesting depth is supported. Each session acts as both a potential parent
(checks for completed children) and a potential child (reports to its parent).
The `parentSessionId` field in spawn state files links each child to exactly
one parent using Claude Code's `session_id` from hook event data.

## File layout

All coordination files live under `~/.claude/spawn-results/`:

- `.by-pid/{claude_pid}` — maps Claude process PID to `{sessionId, transcriptPath}`;
  written by SessionStart hook, read by MCP server via `process.ppid`
- `spawns/{spawnId}.json` — spawn state for each child session
- `spawns/{spawnId}.reported` — atomically renamed after result injection to
  prevent duplicate delivery

## Limitations

- If two root Claude sessions (both without `CLAUDE_SPAWN_ID`) run in the same
  workspace simultaneously and both spawn children, each root session only sees
  its own children because parent-child linking uses `session_id`, not a shared
  "root" identifier
- The `process.ppid` coordination between the SessionStart hook and MCP server
  assumes both are direct children of the Claude process, which holds for standard
  hook command execution and stdio MCP servers
- Results are delivered on the next hook event that supports `additionalContext`;
  if the parent is completely idle with no hook activity, delivery waits until the
  next user message
