# pi-terminal-title

Terminal tab title extension for pi: shows current tool, session state, and user prompt in the terminal window title.

## Installation

### Global (recommended)

```sh
pi install ./packages/pi/terminal-title
```

Or add to `~/.pi/agent/settings.json`:

```json
{
  "packages": ["./packages/pi/terminal-title"]
}
```

### Quick test

```sh
pi -e ./packages/pi/terminal-title/src/index.ts
```

## How it works

Subscribes to pi agent lifecycle events and updates the terminal window/tab title via `ctx.ui.setTitle()`. Titles use a `✳` prefix and are capped at 60 characters.

**Event → title mapping:**

| Event | Title example |
| ----- | ------------- |
| `tool_execution_start` | `✳ Reading index.ts` |
| `tool_execution_end` | `✳ Read index.ts` |
| `session_start` | `✳ Session startup` |
| `session_shutdown` | `✳ Session ended` |
| `agent_end` | `✳ Stopped` |
| `before_agent_start` | `✳ Refactor the auth module` |

**Tool registry:**

| Tool | Pre title | Post title |
| ---- | --------- | ---------- |
| `bash` | `✳ npm test` | `✳ npm test` |
| `read` | `✳ Reading index.ts` | `✳ Read index.ts` |
| `edit` | `✳ Editing config.ts` | `✳ Edited config.ts` |
| `write` | `✳ Writing output.ts` | `✳ Wrote output.ts` |
| `grep` | `✳ Searching "TODO"` | `✳ Searched "TODO"` |
| `find` | `✳ Finding "*.ts"` | `✳ Found "*.ts"` |
| `ls` | `✳ Listing src` | `✳ Listed src` |

Custom/MCP tools that are not in the registry display generically:
`✳ Running mcp__weather` / `✳ Ran mcp__weather`

## Source structure

```
src/
  index.ts           # Extension entry point, event handlers
  title-builder.ts   # titleForEvent(), titleForTool(): maps events to titles
  tool-titles.ts     # Tool name → formatter registry (pi tool names)
  formatter-utils.ts # truncate, shortPath, field, pathFormat, quotedFormat, shortCommand
```
