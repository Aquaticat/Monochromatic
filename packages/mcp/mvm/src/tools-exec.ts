/**
 * Command execution tool definitions: exec and run.
 * @module
 */
import { exec, } from '@monochromatic-dev/cli-mvm/exec';
import { run, } from '@monochromatic-dev/cli-mvm/run';
import {
  defineTool,
  type ToolEntry,
} from '@monochromatic-dev/mcp-stdio';

import {
  errorResponse,
  formatExecResult,
  textResponse,
} from './response.ts';

//region Execution tools: run commands inside VMs

/** MCP tool: execute a command inside a named running VM. */
export const execTool: ToolEntry = defineTool(
  'exec_in_vm',
  {
    description:
      'Runs a shell command inside a named VM via the QEMU guest agent and returns stdout, stderr, and exit code. Linux VMs use bash; Windows VMs use PowerShell.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'VM name to execute in',
        },
        command: {
          type: 'string',
          description:
            'Shell command to run inside the VM (bash for Linux, PowerShell for Windows)',
        },
      },
      required: [
        'name',
        'command',
      ],
    },
    handler: async function handleExecInVm(args,) {
      const name = String(args.name,);
      const command = String(args.command,);
      try {
        const result = await exec({
          command,
          name,
        },);
        return textResponse(formatExecResult(result,),);
      }
      catch (err: unknown) {
        return errorResponse(
          'exec_in_vm',
          err,
        );
      }
    },
  },
);

/** MCP tool: create an ephemeral VM, run a command, then destroy it. */
export const runTool: ToolEntry = defineTool(
  'run_in_vm',
  {
    description:
      'Creates an ephemeral VM, runs a shell command inside it via the QEMU guest agent, then destroys the VM. Returns stdout, stderr, and exit code. Optionally clones from an existing VM instead of creating fresh. Linux VMs use bash; Windows VMs use PowerShell.',
    inputSchema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description:
            'Shell command to run inside the VM (bash for Linux, PowerShell for Windows)',
        },
        from: {
          type: 'string',
          description:
            'Clone from this existing VM name instead of creating fresh. Use list_vms to see available names (e.g. "win-01", not "windows").',
        },
      },
      required: ['command',],
    },
    handler: async function handleRunInVm(args,) {
      const command = String(args.command,);
      const from = typeof args.from === 'string' ? args.from : undefined;
      try {
        const result = await run({
          command,
          from,
        },);
        return textResponse(formatExecResult(result,),);
      }
      catch (err: unknown) {
        return errorResponse(
          'run_in_vm',
          err,
        );
      }
    },
  },
);

//endregion Execution tools
