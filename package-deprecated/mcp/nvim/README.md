# @monochromatic-dev/mcp-nvim

> **Deprecated.** The Monochromatic project has moved away from Neovim
> and no longer maintains this package. The published version on npm
> remains installable indefinitely under npm's no-unpublish policy,
> and the source stays in `packages-deprecated/mcp/nvim/` for reference.
> Use at your own risk; no further updates are planned.

MCP server that exposes Neovim LSP diagnostics and buffer metadata to AI agents
(Factory Droid, Claude Code, etc.) over stdio.

## How it works

Connects to Neovim's built-in msgpack-RPC socket
(auto-discovered via `$NVIM` or `/run/user/$UID/nvim.*`)
and queries diagnostics using `vim.diagnostic.get()` through `nvim_exec_lua`.

No Neovim plugin required.

## Tools

**get_diagnostics**:
Returns the current buffer's absolute path, filetype, modified status,
and all LSP diagnostics (severity, line, column, message, source, code).

**get_all_diagnostics**:
Returns LSP diagnostics across all open buffers, grouped by file path.

## Installation and configuration

### Via npm (recommended for outside consumers)

```sh
npm install -g @monochromatic-dev/mcp-nvim
```

This installs a self-contained Node bundle. No runtime dependencies; the
`neovim` client and `@monochromatic-dev/mcp-stdio` framework are inlined.

Then add to `~/.factory/mcp.json` (or your agent's MCP config):

```json
{
  "nvim": {
    "type": "stdio",
    "command": "nvim-mcp"
  }
}
```

### From cloned source

```json
{
  "nvim": {
    "type": "stdio",
    "command": "bun",
    "args": [
      "run",
      "<path-to-monochromatic>/packages-deprecated/mcp/nvim/src/index.ts"
    ]
  }
}
```

Requires a running Neovim instance with an accessible RPC socket.
Works automatically when the agent runs from Neovim's `:terminal`
(which sets `$NVIM`).

## Bundled runtime dependencies

The published bundle inlines:

- `@monochromatic-dev/mcp-stdio`: stdio MCP framework
- `neovim`: msgpack-RPC client for Neovim
- `nano-spawn`: subprocess helper
