# @monochromatic-dev/mcp-nvim

MCP server that exposes Neovim LSP diagnostics and buffer metadata to Factory Droid
over stdio.

## How it works

Connects to Neovim's built-in msgpack-RPC socket
(auto-discovered via `$NVIM` or `/run/user/$UID/nvim.*`)
and queries diagnostics using `vim.diagnostic.get()` through `nvim_exec_lua`.

No Neovim plugin required.

## Tools

**get_diagnostics** --
Returns the current buffer's absolute path, filetype, modified status,
and all LSP diagnostics (severity, line, column, message, source, code).

**get_all_diagnostics** --
Returns LSP diagnostics across all open buffers, grouped by file path.

## Configuration

Add to `~/.factory/mcp.json`:

```json
{
  "nvim": {
    "type": "stdio",
    "command": "bun",
    "args": ["run", "<path-to-monochromatic>/packages/mcp/nvim/src/index.ts"]
  }
}
```

Requires a running Neovim instance with an accessible RPC socket.
Works automatically when Factory Droid runs from Neovim's `:terminal`
(which sets `$NVIM`).

## Dependencies

- `@monochromatic-dev/mcp-stdio` -- stdio MCP framework (workspace)
- `neovim` -- msgpack-RPC client for Neovim
