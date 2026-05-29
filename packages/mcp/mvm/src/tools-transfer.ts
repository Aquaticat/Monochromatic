/**
 * File transfer tool definitions: push and pull.
 * @module
 */
import {
  pullFile,
  pushFile,
} from '@monochromatic-dev/cli-mvm/ts';
import {
  defineTool,
  type ToolEntry,
} from '@monochromatic-dev/mcp-stdio/ts';

import {
  errorResponse,
  textResponse,
} from './response.ts';

//region Transfer tools: move files between host and guest VMs

/** MCP tool: push a file from the host into a running VM. */
export const pushTool: ToolEntry = defineTool({
  name: 'push_to_vm',
  entry: {
    description:
      'Pushes a file from the host filesystem into a running VM via the QEMU guest agent. The file is written to the specified guest path, creating or overwriting as needed.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'VM name to push to',
        },
        hostPath: {
          type: 'string',
          description: 'Absolute or relative path on the host to read from',
        },
        guestPath: {
          type: 'string',
          description: 'Absolute path inside the guest to write to',
        },
      },
      required: [
        'name',
        'hostPath',
        'guestPath',
      ],
    },
    handler: async function handlePushToVm(args,) {
      /** Target VM name coerced to string so downstream calls receive a stable type regardless of MCP client encoding. */
      const name = String(args.name,);
      /** Host source path coerced to string for the same reason as `name`. */
      const hostPath = String(args.hostPath,);
      /** Guest destination path coerced to string for the same reason as `name`. */
      const guestPath = String(args.guestPath,);
      try {
        await pushFile({
          name,
          hostPath,
          guestPath,
        },);
        return textResponse(`Pushed ${hostPath} -> ${guestPath} in VM ${name}`,);
      }
      catch (err: unknown) {
        return errorResponse({
          tag: 'push_to_vm',
          err,
        },);
      }
    },
  },
},);

/** MCP tool: pull a file from a running VM to the host. */
export const pullTool: ToolEntry = defineTool({
  name: 'pull_from_vm',
  entry: {
    description:
      'Pulls a file from a running VM to the host filesystem via the QEMU guest agent. The file is read from the specified guest path and written to the host path.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'VM name to pull from',
        },
        guestPath: {
          type: 'string',
          description: 'Absolute path inside the guest to read from',
        },
        hostPath: {
          type: 'string',
          description: 'Absolute or relative path on the host to write to',
        },
      },
      required: [
        'name',
        'guestPath',
        'hostPath',
      ],
    },
    handler: async function handlePullFromVm(args,) {
      /** Source VM name coerced to string so downstream calls receive a stable type regardless of MCP client encoding. */
      const name = String(args.name,);
      /** Guest source path coerced to string for the same reason as `name`. */
      const guestPath = String(args.guestPath,);
      /** Host destination path coerced to string for the same reason as `name`. */
      const hostPath = String(args.hostPath,);
      try {
        /** Raw file bytes pulled from the guest, written to the host below. */
        const content = await pullFile({
          name,
          guestPath,
        },);
        /** Lazy-imported `writeFile` so the heavy fs/promises module loads only on the pull path. */
        const { writeFile, } = await import('node:fs/promises');
        await writeFile(
          hostPath,
          content,
        );
        return textResponse(
          `Pulled ${guestPath} -> ${hostPath} from VM ${name} (${
            String(content.length,)
          } bytes)`,
        );
      }
      catch (err: unknown) {
        return errorResponse({
          tag: 'pull_from_vm',
          err,
        },);
      }
    },
  },
},);

//endregion Transfer tools
