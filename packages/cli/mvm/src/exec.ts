import { join } from 'node:path';

import { VM_PREFIX, VMS_DIR, validateName } from './config.ts';
import { decodeBase64, execArgs } from './exec-shell.ts';
import { l, tagged } from './log.ts';
import { readVmMeta } from './meta.ts';
import { virsh } from './virsh.ts';

/** Milliseconds to wait between polling for guest-exec completion. */
const POLL_INTERVAL_MS = 250;

/** Result of executing a command inside a VM via guest agent. */
export type ExecResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

/**
 * Executes a command inside a running VM via the QEMU guest agent.
 * Reads VM metadata to determine the correct shell for the guest OS:
 * Linux VMs use bash/ash, Windows VMs use PowerShell.
 *
 * @param command - Shell command to run inside the VM
 *
 * @param name - VM name without the mvm- prefix
 *
 * @returns Captured stdout, stderr, and exit code
 *
 * @throws Error when the guest agent is unreachable
 *
 * @example
 * ```ts
 * // Linux VM
 * const result = await exec({ command: 'uname -a', name: 'dev-01' });
 *
 * // Windows VM
 * const winResult = await exec({ command: 'Get-ComputerInfo', name: 'win-01' });
 * ```
 */
export async function exec({ command, name }: { command: string; name: string }): Promise<ExecResult> {
  validateName(name);
  const rl = tagged({ tag: exec.name, l, });
  const fullName = `${VM_PREFIX}${name}`;

  const vmDir = join(VMS_DIR, name);
  const meta = await readVmMeta(vmDir);
  const { arg, path } = execArgs({
    command,
    osFamily: meta.osFamily,
    shell: meta.shell,
  });

  rl.debug(`executing command in VM ${name} (${meta.osFamily}, ${path}): ${command}`);

  const execPayload = JSON.stringify({
    execute: 'guest-exec',
    arguments: {
      path,
      arg,
      'capture-output': true,
    },
  });

  const execResult = await virsh({ args: ['qemu-agent-command', fullName, execPayload], });
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- QEMU guest agent JSON protocol response
  const execParsed = JSON.parse(execResult) as { return: { pid: number } };
  const { pid } = execParsed.return;
  rl.debug(`guest-exec started with pid ${String(pid)}`);

  const statusPayload = JSON.stringify({
    execute: 'guest-exec-status',
    arguments: { pid, },
  });

  // oxlint-disable-next-line typescript/no-unnecessary-condition -- polling loop
  while (true) {
    // oxlint-disable-next-line no-await-in-loop -- deliberate serial polling loop
    const statusResult = await virsh({ args: ['qemu-agent-command', fullName, statusPayload], });
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- QEMU guest agent JSON protocol response
    const statusParsed = JSON.parse(statusResult) as { return: {
      exited: boolean;
      exitcode?: number;
      'out-data'?: string;
      'err-data'?: string;
    } };
    const status = statusParsed.return;

    if (!status.exited) {
      // oxlint-disable-next-line no-await-in-loop, promise/avoid-new -- deliberate serial polling with setTimeout
      await new Promise(function execPollDelay(resolve) { setTimeout(resolve, POLL_INTERVAL_MS); });
      continue;
    }

    const stdout = status['out-data'] !== undefined ? decodeBase64(status['out-data']) : '';
    const stderr = status['err-data'] !== undefined ? decodeBase64(status['err-data']) : '';
    const exitCode = status.exitcode ?? 0;

    rl.debug(`command exited with code ${String(exitCode)}`);
    return { exitCode, stderr, stdout };
  }
}
