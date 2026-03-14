# claude-spawn

Claude Code plugin that spawns steerable child Claude Code sessions in terminal windows
with automatic result forwarding via hooks.

## Prerequisites

- [terminal-exec](../../cli/terminal-exec/) must be installed and on `PATH`
  (resolves the preferred terminal emulator on Linux/Windows)
- [Bun](https://bun.sh/) runtime (hooks and MCP server run via `bun`)

## Installing

### From a marketplace

If this plugin is published to a marketplace:

```bash
claude plugin install claude-spawn@marketplace-name
```

Or from within a Claude Code session:

```
/plugin install claude-spawn@marketplace-name
```

Choose a scope:
- `--scope user` — personal, all projects (`~/.claude/settings.json`)
- `--scope project` — team-shared via version control (`.claude/settings.json`)
- `--scope local` — gitignored, this machine only (`.claude/settings.local.json`)

### From a local directory

For development or when running from this monorepo:

```bash
claude --plugin-dir ./packages/claude-code-plugins/claude-spawn
```

Or install permanently by adding to settings:

```bash
claude plugin install ./packages/claude-code-plugins/claude-spawn --scope user
```

### From a Git repository

```bash
claude plugin install claude-spawn@owner/repo
```

Where `owner/repo` is a GitHub repository with a `marketplace.json` that includes this plugin.

## Building

The hooks require a build step before first use:

```bash
mise run //packages/claude-code-plugins/claude-spawn:build:js:node
```

The MCP server (`src/mcp.ts`) runs from raw TypeScript source via Bun and does not need building.

## Verifying installation

After installing, start a new Claude Code session.
The plugin registers hooks on 9 events and an MCP server automatically.

Confirm the MCP tool is available:

```
What tools do you have access to?
```

Look for `spawn_claude` (or `mcp__claude-spawn__spawn_claude` if prefixed).

## Publishing

### To a GitHub marketplace

1.  Create a repository (or use an existing one) with a `.claude-plugin/marketplace.json` at the root:

    ```json
    {
      "name": "your-marketplace",
      "owner": { "name": "Your Name" },
      "plugins": [
        {
          "name": "claude-spawn",
          "source": { "source": "git-subdir", "url": "https://github.com/owner/repo.git", "path": "packages/claude-code-plugins/claude-spawn" },
          "description": "Spawn steerable child Claude sessions with automatic result forwarding.",
          "version": "0.0.1"
        }
      ]
    }
    ```

2.  Push to GitHub.

3.  Users add your marketplace and install:

    ```bash
    claude plugin marketplace add owner/repo
    claude plugin install claude-spawn@your-marketplace
    ```

### To npm

1.  Remove `"private": true` from `package.json` (or publish under a scope).
2.  Ensure `dist/` is built: `mise run //packages/claude-code-plugins/claude-spawn:build:js:node`
3.  Publish: `npm publish`
4.  Reference in marketplace.json:

    ```json
    {
      "name": "claude-spawn",
      "source": { "source": "npm", "package": "@your-scope/claude-code-plugins-claude-spawn" },
      "description": "Spawn steerable child Claude sessions with automatic result forwarding.",
      "version": "0.0.1"
    }
    ```

### Validating before publishing

```bash
claude plugin validate ./packages/claude-code-plugins/claude-spawn
```

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

- The `process.ppid` coordination between the SessionStart hook and MCP server
  assumes both are direct children of the Claude process, which holds for standard
  hook command execution and stdio MCP servers
- Results are delivered on the next hook event that supports `additionalContext`;
  if the parent is completely idle with no hook activity, delivery waits until the
  next user message
