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

Subscribes to pi agent lifecycle events and updates the terminal window/tab title via `ctx.ui.setTitle()`. Titles use a `π` prefix and are capped at 60 characters.

**Event → title mapping:**

| Event                  | Title example                |
| ---------------------- | ---------------------------- |
| `tool_execution_start` | `π Reading index.ts`         |
| `tool_execution_end`   | `π Read index.ts`            |
| `session_start`        | `π Session startup`          |
| `session_shutdown`     | `π Session ended`            |
| `agent_end`            | `π Stopped`                  |
| `before_agent_start`   | `π Refactor the auth module` |

**Tool registry:**

| Tool    | Pre title             | Post title           |
| ------- | --------------------- | -------------------- |
| `bash`  | `π npm test`          | `π npm test`         |
| `read`  | `π Reading index.ts`  | `π Read index.ts`    |
| `edit`  | `π Editing config.ts` | `π Edited config.ts` |
| `write` | `π Writing output.ts` | `π Wrote output.ts`  |
| `grep`  | `π Searching "TODO"`  | `π Searched "TODO"`  |
| `find`  | `π Finding "*.ts"`    | `π Found "*.ts"`     |
| `ls`    | `π Listing src`       | `π Listed src`       |

Custom/MCP tools that are not in the registry display generically:
`π Running mcp__weather` / `π Ran mcp__weather`

## Source structure

```
src/
  index.ts           # Extension entry point, event handlers
  title-builder.ts   # titleForEvent(), titleForTool(): maps events to titles
  tool-titles.ts     # Tool name → formatter registry (pi tool names)
  formatter-utils.ts # truncate, shortPath, field, pathFormat, quotedFormat, shortCommand
```
