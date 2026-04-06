/**
 * VM lifecycle tool definitions: list and update.
 * @module
 */
import { list, } from '@monochromatic-dev/cli-mvm/list';
import { update, } from '@monochromatic-dev/cli-mvm/update';
import {
  defineTool,
  type ToolEntry,
} from '@monochromatic-dev/mcp-stdio';

import {
  errorResponse,
  textResponse,
} from './response.ts';

//region Lifecycle tools -- VM listing and template updates

/** MCP tool: list all managed VMs and their state. */
export const listTool: ToolEntry = defineTool(
  'list_vms',
  {
    description:
      'Lists all managed VMs with their current state (running, shut off, etc.).',
    handler: async function handleListVms() {
      try {
        /** All managed VMs queried from libvirt. */
        const vms = await list();
        if (vms.length === 0)
          return textResponse('No VMs found.',);
        const lines = vms.map(function formatVmLine(vm,) {
          return `${vm.name}: ${vm.state}`;
        },);
        return textResponse(lines.join('\n',),);
      }
      catch (err: unknown) {
        return errorResponse(
          'list_vms',
          err,
        );
      }
    },
  },
);

/** MCP tool: re-download and rebuild all template images. */
export const updateTool: ToolEntry = defineTool(
  'update_templates',
  {
    description:
      'Re-downloads all base images and rebuilds all templates unconditionally. Use to refresh Windows evaluation ISOs (180-day expiry), pick up new Linux cloud image releases, or update virtio-win drivers. Builds templates for all registered images, even those never previously used. Windows template rebuild takes 15-30 minutes.',
    handler: async function handleUpdateTemplates() {
      try {
        await update();
        return textResponse('All template images updated successfully.',);
      }
      catch (err: unknown) {
        return errorResponse(
          'update_templates',
          err,
        );
      }
    },
  },
);

//endregion Lifecycle tools
