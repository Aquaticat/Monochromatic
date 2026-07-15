/**
 * File transfer tool definitions: push and pull.
 * @module
 */
import {
  defineTool,
  type ToolEntry,
} from '@monochromatic-dev/mcp-stdio/ts';

import {
  BACKEND_PROPERTY,
  backendFromArgs,
} from './backend.ts';
import {
  errorResponse,
  textResponse,
} from './response.ts';
import { requiredStringArgument, } from './required-string-argument.ts';

//region Transfer tools: move files between host and guest VMs

/**
 * MCP tool: push a file from the host into a running VM, on the backend
 * resolved via {@link backendFromArgs}.
 */
export const pushTool: ToolEntry = defineTool({
  name: 'push_to_vm',
  entry: {
    description:
      'Pushes a file from the host filesystem into a running VM. libvirt writes via the virtiofs shared mount; hetzner copies to the given absolute remote path over SCP.',
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
        backend: BACKEND_PROPERTY,
      },
      required: [
        'name',
        'hostPath',
        'guestPath',
      ],
    },
    handler: async function handlePushToVm(args,) {
      /**
       * Target VM name validated as string so downstream calls receive a stable type regardless of MCP client encoding.
       */
      const name = requiredStringArgument(args.name,);
      /**
       * Host source path validated as string for the same reason as `name`.
       */
      const hostPath = requiredStringArgument(args.hostPath,);
      /**
       * Guest destination path validated as string for the same reason as `name`.
       */
      const guestPath = requiredStringArgument(args.guestPath,);
      try {
        /**
         * Backend resolved from the optional `backend` arg, env, or default.
         */
        const backend = await backendFromArgs(args,);
        await backend.pushFile({
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

/**
 * MCP tool: pull a file from a running VM to the host, on the backend
 * resolved via {@link backendFromArgs}.
 */
export const pullTool: ToolEntry = defineTool({
  name: 'pull_from_vm',
  entry: {
    description:
      'Pulls a file from a running VM to the host filesystem. libvirt reads via the virtiofs shared mount; hetzner copies from the given absolute remote path over SCP.',
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
        backend: BACKEND_PROPERTY,
      },
      required: [
        'name',
        'guestPath',
        'hostPath',
      ],
    },
    handler: async function handlePullFromVm(args,) {
      /**
       * Source VM name validated as string so downstream calls receive a stable type regardless of MCP client encoding.
       */
      const name = requiredStringArgument(args.name,);
      /**
       * Guest source path validated as string for the same reason as `name`.
       */
      const guestPath = requiredStringArgument(args.guestPath,);
      /**
       * Host destination path validated as string for the same reason as `name`.
       */
      const hostPath = requiredStringArgument(args.hostPath,);
      try {
        /**
         * Backend resolved from the optional `backend` arg, env, or default.
         */
        const backend = await backendFromArgs(args,);
        /**
         * Raw file bytes pulled from the guest, written to the host below.
         */
        const content = await backend.pullFile({
          name,
          guestPath,
        },);
        /**
         * Lazy-imported `writeFile` so the heavy fs/promises module loads only on the pull path.
         */
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
