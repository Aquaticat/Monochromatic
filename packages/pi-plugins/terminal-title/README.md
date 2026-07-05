# pi-terminal-title

Terminal tab title extension for pi:
 shows current tool,
 session state,
 and user prompt in the terminal window title.

## Installation

### Global (recommended)

```sh
pi install ./packages/pi-plugins/terminal-title
```

Or add to `~/.pi/agent/settings.json`:

```json
{
  "packages": ["./packages/pi-plugins/terminal-title"]
}
```

### Quick test

```sh
pi -e ./packages/pi-plugins/terminal-title/src/index.ts
```

## How it works

Subscribes to pi agent lifecycle events and updates the terminal window/tab title via `ctx.ui.setTitle()`.
 Titles use a `π` prefix and are capped at 60 characters.

**Event → title mapping:
**

<table>
<thead>
<tr>
<th>Event</th>
<th>Title example</th>
</tr>
</thead>
<tbody>
<tr>
<td>`tool_execution_start`</td>
<td>`π Reading index.ts`</td>
</tr>
<tr>
<td>`tool_execution_end`</td>
<td>`π Read index.ts`</td>
</tr>
<tr>
<td>`session_start`</td>
<td>`π Session startup`</td>
</tr>
<tr>
<td>`session_shutdown`</td>
<td>`π Session ended`</td>
</tr>
<tr>
<td>`agent_end`</td>
<td>`π Stopped`</td>
</tr>
<tr>
<td>`before_agent_start`</td>
<td>`π Refactor the auth module`</td>
</tr>
</tbody>
</table>

**Tool registry:
**

<table>
<thead>
<tr>
<th>Tool</th>
<th>Pre title</th>
<th>Post title</th>
</tr>
</thead>
<tbody>
<tr>
<td>`bash`</td>
<td>`π npm test`</td>
<td>`π npm test`</td>
</tr>
<tr>
<td>`read`</td>
<td>`π Reading index.ts`</td>
<td>`π Read index.ts`</td>
</tr>
<tr>
<td>`edit`</td>
<td>`π Editing config.ts`</td>
<td>`π Edited config.ts`</td>
</tr>
<tr>
<td>`write`</td>
<td>`π Writing output.ts`</td>
<td>`π Wrote output.ts`</td>
</tr>
<tr>
<td>`grep`</td>
<td>`π Searching "TODO"`</td>
<td>`π Searched "TODO"`</td>
</tr>
<tr>
<td>`find`</td>
<td>`π Finding "*.ts"`</td>
<td>`π Found "*.ts"`</td>
</tr>
<tr>
<td>`ls`</td>
<td>`π Listing src`</td>
<td>`π Listed src`</td>
</tr>
</tbody>
</table>

Custom/MCP tools that are not in the registry display generically:
`π Running mcp__weather` / `π Ran mcp__weather`

## Source structure

```text
src/
  index.ts           # Extension entry point, event handlers
  title-builder.ts   # titleForEvent(), titleForTool(): maps events to titles
  tool-titles.ts     # Tool name → formatter registry (pi tool names)
  formatter-utils.ts # truncate, shortPath, field, pathFormat, quotedFormat, shortCommand
```
