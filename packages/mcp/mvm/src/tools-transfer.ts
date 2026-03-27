/**
 * File transfer tool definitions: push and pull.
 * @module
 */
import {
  pullFile,
  pushFile,
} from '@monochromatic-dev/cli-mvm/file-transfer';
import { defineTool, } from '@monochromatic-dev/mcp-stdio';

import {
  errorResponse,
  textResponse,
} from './response.ts';

//region Transfer tools -- move files between host and guest VMs

/** MCP tool: push a file from the host into a running VM. */
export const pushTool = defineTool(
  'push_to_vm',
  {
  description:
    'Pushes a file from the host filesystem into a running VM via the QEMU guest agent. The file is written to the specified guest path, creating or overwriting as needed.',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'VM name to push to', },
      hostPath: { type: 'string',
        description:
          'Absolute or relative path on the host to read from', },
      guestPath: { type: 'string',
        description:
          'Absolute path inside the guest to write to', },
    },
    required: ['name', 'hostPath', 'guestPath',],
  },
  handler: async function handlePushToVm(args,) {
    const name = String(args.name,);
    const hostPath = String(args.hostPath,);
    const guestPath = String(args.guestPath,);
    try {
      await pushFile({ name, hostPath, guestPath, },);
      return textResponse(`Pushed ${hostPath} -> ${guestPath} in VM ${name}`,);
    }
    catch (err: unknown) {
      return errorResponse('push_to_vm', err,);
    }
  },
},
);

/** MCP tool: pull a file from a running VM to the host. */
export const pullTool = defineTool(
  'pull_from_vm',
  {
  description:
    'Pulls a file from a running VM to the host filesystem via the QEMU guest agent. The file is read from the specified guest path and written to the host path.',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'VM name to pull from', },
      guestPath: { type: 'string',
        description:
          'Absolute path inside the guest to read from', },
      hostPath: { type: 'string',
        description:
          'Absolute or relative path on the host to write to', },
    },
    required: ['name', 'guestPath', 'hostPath',],
  },
  handler: async function handlePullFromVm(args,) {
    const name = String(args.name,);
    const guestPath = String(args.guestPath,);
    const hostPath = String(args.hostPath,);
    try {
      const content = await pullFile({ name, guestPath, },);
      const { writeFile, } = await import('node:fs/promises');
      await writeFile(hostPath, content,);
      return textResponse(`Pulled ${guestPath} -> ${hostPath} from VM ${name} (${String(content.length,)} bytes)`,);
    }
    catch (err: unknown) {
      return errorResponse('pull_from_vm', err,);
    }
  },
},
);

//endregion Transfer tools
