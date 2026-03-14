# claude-spawn

Claude Code plugin that spawns steerable child Claude Code sessions in terminal windows
with automatic result forwarding via hooks.

## Prerequisites

- [terminal-exec](../../cli/terminal-exec/) must be installed and on `PATH`
  (resolves the preferred terminal emulator on Linux/Windows)
- [Bun](https://bun.sh/) runtime (hooks and CLI run via `bun`)

## Installing

### From a marketplace

If this plugin is published to a marketplace:

```bash
claude plugin install claude-spawn@Monochromatic
```

Or from within a Claude Code session:

```
/plugin install claude-spawn@Monochromatic
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

### From the Monochromatic GitHub marketplace

First add the marketplace, then install:

```bash
claude plugin marketplace add Aquaticat/Monochromatic
claude plugin install claude-spawn@Monochromatic
```

## Building

The hooks require a build step before first use:

```bash
mise run //packages/claude-code-plugins/claude-spawn:build:js:node
```

The CLI (`src/cli.ts`) runs from raw TypeScript source via Bun and does not need building.

## Usage

The `spawn-claude` CLI launches a child Claude session in a visible terminal window:

```bash
spawn-claude "implement feature X"
spawn-claude --cwd /some/path "fix the bug"
spawn-claude --extra-arguments "--model sonnet" "refactor module Y"
```

Prints `{"spawnId":"<uuid>"}` on success.
Completed child results are injected into the parent's context automatically via hooks.

To check on a child manually, read `~/.claude/spawn-results/spawns/{spawnId}.json`.

## Verifying installation

After installing, start a new Claude Code session.
The plugin registers hooks on 9 events automatically.

Test the CLI:

```bash
spawn-claude "say hello and exit"
```

A new terminal window opens with a Claude session.
When that session ends, its result appears in the parent's context.

## Publishing

### To the Monochromatic marketplace

This plugin is already registered in `.claude-plugin/marketplace.json` at the repo root
under the `Monochromatic` marketplace. After pushing, users install with:

```bash
claude plugin marketplace add Aquaticat/Monochromatic
claude plugin install claude-spawn@Monochromatic
```

### To npm

1.  Remove `"private": true` from `package.json` (or publish under a scope).
2.  Ensure `dist/` is built: `mise run //packages/claude-code-plugins/claude-spawn:build:js:node`
3.  Publish: `npm publish`
4.  Reference in marketplace.json:

    ```json
    {
      "name": "claude-spawn",
      "source": { "source": "npm", "package": "@monochromatic-dev/claude-code-plugins-claude-spawn" },
      "description": "Spawn steerable child Claude sessions with automatic result forwarding.",
      "version": "0.0.1"
    }
    ```

### Validating before publishing

```bash
claude plugin validate ./packages/claude-code-plugins/claude-spawn
```

## How it works

The plugin has two components: a CLI tool and a set of hooks.

### CLI tool (`spawn-claude`)

Launches a child Claude session in a new terminal window via `terminal-exec`.
Sets environment variables on the child (`CLAUDE_SPAWN_ID`, `CLAUDE_SPAWNED_BY_SESSION`)
that identify it as a spawned session and link it to its parent.
Resolves the calling Claude session by walking the process tree upward,
matching ancestor PIDs against `.by-pid/` coordination files.
Returns a `spawnId` immediately without waiting for the child to finish.

### Hooks (automatic result forwarding)

Since all Claude sessions in the workspace share the same hooks, the child session
self-reports its state through the shared hook infrastructure:

- **SessionStart**: writes a PID-to-session mapping (for CLI coordination)
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
  written by SessionStart hook, read by CLI via process tree walk
- `spawns/{spawnId}.json` — spawn state for each child session
- `spawns/{spawnId}.reported` — atomically renamed after result injection to
  prevent duplicate delivery

## Limitations

- The process tree walk reads `/proc/{pid}/status` to find ancestor PIDs,
  which requires Linux; macOS and Windows would need platform-specific alternatives
- Results are delivered on the next hook event that supports `additionalContext`;
  if the parent is completely idle with no hook activity, delivery waits until the
  next user message
