# @monochromatic-dev/mcp-mvm

MCP server that exposes [mvm](../../cli/mvm/) VM management operations to AI agents over stdio.

## Tools

- **list_vms**:
   lists all managed VMs with their current state
- **create_vm**:
   creates and starts a new VM (image plus,
   for hetzner,
   `server_type`/`location`)
- **destroy_vm**:
   force-stops and deletes a VM by name,
   or all managed VMs when `all` is true
- **exec_in_vm**:
   runs a shell command inside a running VM (guest agent for libvirt,
   SSH for hetzner)
- **run_in_vm**,
   **push_to_vm**,
   **pull_from_vm**,
   **update_templates**:
   ephemeral run,
   file transfer,
   and image refresh

Every tool accepts an optional `backend` argument (`libvirt`,
 the default,
 or
`hetzner`).
 It mirrors the CLI's `--backend`/`MVM_BACKEND` selection.
 Since
there is no record of which backend a VM lives on,
 pass the same `backend` to
follow-up tool calls that you used in `create_vm`.

## Backends

- **libvirt** (default):
   local QEMU/KVM.
   Linux only.
- **hetzner**:
   Hetzner Cloud over the HTTP API;
   requires `HCLOUD_TOKEN` and an
  OpenSSH 9.0+ client.
   Provisions real,
   billed servers.
   Tunables:
  `MVM_HCLOUD_SERVER_TYPE`,
   `MVM_HCLOUD_LOCATIONS` (ordered fallback list).

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

- **libvirt backend** (default):
   libvirt/QEMU with a user session connection (`qemu:///session`);
   Linux only.
- **hetzner backend**:
   `HCLOUD_TOKEN` plus an OpenSSH 9.0+ client;
   runs on any platform.
