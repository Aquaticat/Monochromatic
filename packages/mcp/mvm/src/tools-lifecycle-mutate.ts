/**
 * VM mutation tool definitions: create and destroy.
 * @module
 */
import { clone, } from '@monochromatic-dev/cli-mvm/clone';
import { create, } from '@monochromatic-dev/cli-mvm/create';
import {
  destroy,
  destroyAll,
} from '@monochromatic-dev/cli-mvm/destroy';
import {
  defineTool,
  type ToolEntry,
} from '@monochromatic-dev/mcp-stdio';

import {
  errorResponse,
  textResponse,
} from './response.ts';

//region Mutation tools: VM creation and destruction

/** MCP tool: create a new VM, optionally cloned from an existing one. */
export const createTool: ToolEntry = defineTool({
  name: 'create_vm',
  entry: {
    description:
      'Creates and starts a new VM. Supports ubuntu (default), fedora, alpine, windows, or a custom template name via the `image` parameter. Windows VMs use a Windows Server 2025 evaluation ISO with unattended install (first creation takes 15-30 minutes). When `from` is provided, clones from that existing VM instead of creating fresh.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'VM name (alphanumeric, hyphens, underscores)',
        },
        from: {
          type: 'string',
          description: 'Clone from this existing VM instead of creating fresh',
        },
        image: {
          type: 'string',
          description:
            'Image to use: ubuntu (default), fedora, alpine, windows, or a custom template name',
        },
      },
      required: ['name',],
    },
    handler: async function handleCreateVm(args,) {
      /** New VM name coerced to string so libvirt receives a stable type regardless of MCP client encoding. */
      const name = String(args.name,);
      /** Optional source VM to clone from; `undefined` selects the create-fresh path below. */
      const from = ((typeof args.from) === 'string') ? args.from : undefined;
      /**
       * Optional image template; absence falls back to the default in {@link create}.
       */
      const image = ((typeof args.image) === 'string') ? args.image : undefined;
      try {
        await (from !== undefined
          ? clone({
            destination: name,
            source: from,
          },)
          : create({
            name,
            ...(image !== undefined ? { image, } : {}),
          },));
        /** Trailing fragment appended to the success message to disclose clone provenance when applicable. */
        const suffix = from !== undefined ? ` (cloned from ${from})` : '';
        return textResponse(
          `VM ${name} created${suffix} and started. Use exec_in_vm to run commands inside it.`,
        );
      }
      catch (err: unknown) {
        return errorResponse({
          tag: 'create_vm',
          err,
        },);
      }
    },
  },
},);

/** MCP tool: destroy VMs by name or all at once. */
export const destroyTool: ToolEntry = defineTool({
  name: 'destroy_vm',
  entry: {
    description:
      'Force-stops and deletes a VM by name, or all managed VMs when `all` is true. Provide exactly one of `name` or `all`.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'VM name to destroy (mutually exclusive with all)',
        },
        all: {
          type: 'boolean',
          description: 'Destroy every managed VM (mutually exclusive with name)',
        },
      },
    },
    handler: async function handleDestroyVm(args,) {
      /** Optional single-VM target; mutually exclusive with `all` and validated below. */
      const name = ((typeof args.name) === 'string') ? args.name : undefined;
      /** Optional destroy-everything flag; mutually exclusive with `name` and validated below. */
      const all = ((typeof args.all) === 'boolean') ? args.all : undefined;
      try {
        if (all === true) {
          await destroyAll();
          return textResponse('All VMs destroyed.',);
        }
        if (name !== undefined) {
          await destroy({ name, },);
          return textResponse(`VM ${name} destroyed.`,);
        }
        return {
          content: [{
            type: 'text' as const,
            text: 'Error: provide either `name` or `all: true`.',
          },],
          isError: true as const,
        };
      }
      catch (err: unknown) {
        return errorResponse({
          tag: 'destroy_vm',
          err,
        },);
      }
    },
  },
},);

//endregion Mutation tools
