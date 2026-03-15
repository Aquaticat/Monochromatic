/**
 * VM lifecycle tool definitions: list, create, destroy, update.
 * @module
 */
import { clone } from '@monochromatic-dev/cli-mvm/clone';
import { create } from '@monochromatic-dev/cli-mvm/create';
import { destroy, destroyAll } from '@monochromatic-dev/cli-mvm/destroy';
import { list } from '@monochromatic-dev/cli-mvm/list';
import { update } from '@monochromatic-dev/cli-mvm/update';
import { defineTool } from '@monochromatic-dev/mcp-stdio';

import { errorResponse, textResponse } from './response.ts';

//region Lifecycle tools -- VM creation, listing, destruction, and template updates

/** MCP tool: list all managed VMs and their state. */
export const listTool = defineTool('list_vms', {
  description: 'Lists all managed VMs with their current state (running, shut off, etc.).',
  handler: async function handleListVms() {
    try {
      /** All managed VMs queried from libvirt. */
      const vms = await list();
      if (vms.length === 0) {
        return textResponse('No VMs found.');
      }
      const lines = vms.map(function formatVmLine(vm) { return `${vm.name}: ${vm.state}`; });
      return textResponse(lines.join('\n'));
    } catch (err: unknown) {
      return errorResponse('list_vms', err);
    }
  },
});

/** MCP tool: create a new VM, optionally cloned from an existing one. */
export const createTool = defineTool('create_vm', {
  description: 'Creates and starts a new VM. Supports ubuntu (default), fedora, alpine, windows, or a custom template name via the `image` parameter. Windows VMs use a Windows Server 2025 evaluation ISO with unattended install (first creation takes 15-30 minutes). When `from` is provided, clones from that existing VM instead of creating fresh.',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'VM name (alphanumeric, hyphens, underscores)' },
      from: { type: 'string', description: 'Clone from this existing VM instead of creating fresh' },
      image: { type: 'string', description: 'Image to use: ubuntu (default), fedora, alpine, windows, or a custom template name' },
    },
    required: ['name'],
  },
  handler: async function handleCreateVm(args) {
    const name = String(args.name);
    const from = typeof args.from === 'string' ? args.from : undefined;
    const image = typeof args.image === 'string' ? args.image : undefined;
    try {
      await (from !== undefined
        ? clone({ destination: name, source: from })
        : create({ image, name }));
      const suffix = from !== undefined ? ` (cloned from ${from})` : '';
      return textResponse(`VM ${name} created${suffix} and started. Use exec_in_vm to run commands inside it.`);
    } catch (err: unknown) {
      return errorResponse('create_vm', err);
    }
  },
});

/** MCP tool: destroy VMs by name or all at once. */
export const destroyTool = defineTool('destroy_vm', {
  description: 'Force-stops and deletes a VM by name, or all managed VMs when `all` is true. Provide exactly one of `name` or `all`.',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'VM name to destroy (mutually exclusive with all)' },
      all: { type: 'boolean', description: 'Destroy every managed VM (mutually exclusive with name)' },
    },
  },
  handler: async function handleDestroyVm(args) {
    const name = typeof args.name === 'string' ? args.name : undefined;
    const all = typeof args.all === 'boolean' ? args.all : undefined;
    try {
      if (all === true) {
        await destroyAll();
        return textResponse('All VMs destroyed.');
      }
      if (name !== undefined) {
        await destroy({ name });
        return textResponse(`VM ${name} destroyed.`);
      }
      return { content: [{ type: 'text' as const, text: 'Error: provide either `name` or `all: true`.' }], isError: true as const };
    } catch (err: unknown) {
      return errorResponse('destroy_vm', err);
    }
  },
});

/** MCP tool: re-download and rebuild all template images. */
export const updateTool = defineTool('update_templates', {
  description: 'Re-downloads all base images and rebuilds all templates unconditionally. Use to refresh Windows evaluation ISOs (180-day expiry), pick up new Linux cloud image releases, or update virtio-win drivers. Builds templates for all registered images, even those never previously used. Windows template rebuild takes 15-30 minutes.',
  handler: async function handleUpdateTemplates() {
    try {
      await update();
      return textResponse('All template images updated successfully.');
    } catch (err: unknown) {
      return errorResponse('update_templates', err);
    }
  },
});

//endregion Lifecycle tools
