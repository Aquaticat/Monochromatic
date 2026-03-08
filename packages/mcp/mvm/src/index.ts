#!/usr/bin/env bun
import { clone } from '@monochromatic-dev/cli-mvm/clone';
import { create } from '@monochromatic-dev/cli-mvm/create';
import { destroy, destroyAll } from '@monochromatic-dev/cli-mvm/destroy';
import { ephemeralExec } from '@monochromatic-dev/cli-mvm/ephemeral-exec';
import { exec } from '@monochromatic-dev/cli-mvm/exec';
import { list } from '@monochromatic-dev/cli-mvm/list';
import { createMcpServer, defineTool, serve } from '@monochromatic-dev/mcp-stdio';

export {};

//region Tool definitions -- each tool maps to an mvm CLI operation

/** MCP tool: list all managed VMs and their state. */
const listTool = defineTool('list_vms', {
  description: 'Lists all managed VMs with their current state (running, shut off, etc.).',
  handler: async () => {
    try {
      const vms = await list();
      if (vms.length === 0) {
        return { content: [{ type: 'text', text: 'No VMs found.' }] };
      }
      const lines = vms.map((vm) => `${vm.name}: ${vm.state}`);
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[mcp-mvm] list_vms failed:', err);
      return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
    }
  },
});

/** MCP tool: create a new Ubuntu VM, optionally cloned from an existing one. */
const createTool = defineTool('create_vm', {
  description: 'Creates and starts a new Ubuntu VM. When `from` is provided, clones from that existing VM instead of creating fresh from the base image.',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'VM name (alphanumeric, hyphens, underscores)' },
      from: { type: 'string', description: 'Clone from this existing VM instead of creating fresh' },
    },
    required: ['name'],
  },
  handler: async (args) => {
    const name = args.name as string;
    const from = args.from as string | undefined;
    try {
      if (from !== undefined) {
        await clone({ destination: name, source: from });
      } else {
        await create({ name });
      }
      const suffix = from !== undefined ? ` (cloned from ${from})` : '';
      return { content: [{ type: 'text', text: `VM ${name} created${suffix} and started. Use exec_in_vm to run commands inside it.` }] };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[mcp-mvm] create_vm failed:', err);
      return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
    }
  },
});

/** MCP tool: destroy VMs by name or all at once. */
const destroyTool = defineTool('destroy_vm', {
  description: 'Force-stops and deletes a VM by name, or all managed VMs when `all` is true. Provide exactly one of `name` or `all`.',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'VM name to destroy (mutually exclusive with all)' },
      all: { type: 'boolean', description: 'Destroy every managed VM (mutually exclusive with name)' },
    },
  },
  handler: async (args) => {
    const name = args.name as string | undefined;
    const all = args.all as boolean | undefined;
    try {
      if (all === true) {
        await destroyAll();
        return { content: [{ type: 'text', text: 'All VMs destroyed.' }] };
      }
      if (name !== undefined) {
        await destroy({ name });
        return { content: [{ type: 'text', text: `VM ${name} destroyed.` }] };
      }
      return { content: [{ type: 'text', text: 'Error: provide either `name` or `all: true`.' }], isError: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[mcp-mvm] destroy_vm failed:', err);
      return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
    }
  },
});

/** MCP tool: execute a command inside a running VM. */
const execTool = defineTool('exec_in_vm', {
  description: 'Runs a shell command inside a VM via the QEMU guest agent and returns stdout, stderr, and exit code. When `destroy` is true, creates an ephemeral VM (optionally cloned from `from`), executes the command, and destroys the VM afterward.',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'VM name to execute in (ignored when destroy is true)' },
      command: { type: 'string', description: 'Shell command to run inside the VM' },
      destroy: { type: 'boolean', description: 'Create an ephemeral VM, execute, then destroy it' },
      from: { type: 'string', description: 'Clone from this existing VM instead of creating fresh (only with destroy)' },
    },
    required: ['command'],
  },
  handler: async (args) => {
    const command = args.command as string;
    const shouldDestroy = args.destroy as boolean | undefined;
    const from = args.from as string | undefined;
    try {
      const result = shouldDestroy === true
        ? await ephemeralExec({ command, from })
        : await exec({ command, name: args.name as string });
      const parts: string[] = [];
      if (result.stdout.length > 0) {
        parts.push(`stdout:\n${result.stdout}`);
      }
      if (result.stderr.length > 0) {
        parts.push(`stderr:\n${result.stderr}`);
      }
      parts.push(`exit code: ${String(result.exitCode)}`);
      return { content: [{ type: 'text', text: parts.join('\n\n') }] };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[mcp-mvm] exec_in_vm failed:', err);
      return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
    }
  },
});

//endregion Tool definitions

//region Server setup -- create and serve the MCP server

const server = createMcpServer(
  { name: 'mvm', version: '0.1.0' },
  [listTool, createTool, destroyTool, execTool],
);

await serve(server);

//endregion Server setup
