# @monochromatic-dev/mcp-mvm

MCP server that exposes [mvm](../../cli/mvm/) VM management operations to AI agents over stdio.

## Tools

- **list_vms**: lists all managed VMs with their current state
- **create_vm**: creates and starts a new Ubuntu VM
- **destroy_vm**: force-stops and deletes a VM by name, or all managed VMs when `all` is true
- **exec_in_vm**: runs a shell command inside a running VM via the QEMU guest agent

## Usage

```json
{
  "mcpServers": {
    "mvm": {
      "command": "bun",
      "args": ["run", "/path/to/packages/mcp/mvm/src/index.ts"]
    }
  }
}
```

## Requirements

Same as mvm: libvirt/QEMU with a user session connection (`qemu:///session`).
