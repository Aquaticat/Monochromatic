import { join, } from 'node:path';
import { tagged, } from '@monochromatic-dev/module-logger/ts';

import {
  validateName,
  VM_PREFIX,
  VMS_DIR,
} from './config.ts';
import {
  decodeBase64,
  execArgs,
} from './exec-shell.ts';
import { waitForGuestExecStatus, } from './guest-exec-status.ts';
import { readVmMeta, } from './meta.ts';
import { virsh, } from './virsh.ts';

/**
 * Logger root for mvm after removing the package log shim.
 *
 * @example
 * ```ts
 * const rl = tagged({ tag: someFunction.name, l, },);
 * ```
 */
const l = tagged({ tag: 'mvm', },);

/**
 * Milliseconds to wait between polling for guest-exec completion.
 */
const POLL_INTERVAL_MS = 250;

/**
 * Result of executing a command inside a VM via guest agent.
 */
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
export async function exec(
  {
    command,
    name,
  }: {
    readonly command: string;
    readonly name: string;
  },
): Promise<ExecResult> {
  validateName(name,);
  /**
   * Logger scoped to this exec call so log lines carry the function name.
   */
  const rl = tagged({
    tag: exec.name,
    l,
  },);
  /**
   * Prefixed libvirt domain name; required because libvirt namespaces VMs under {@link VM_PREFIX}.
   */
  const fullName = `${VM_PREFIX}${name}`;

  /**
   * Per-VM directory holding `meta.json`; used below to determine guest shell.
   */
  const vmDir = join(
    VMS_DIR,
    name,
  );
  /**
   * Stored VM metadata; the osFamily and shell drive the guest-exec invocation shape.
   */
  const meta = await readVmMeta(vmDir,);
  /**
   * Shell-specific `path` and `arg` array shaped for the guest's native shell.
   */
  const {
    arg,
    path,
  } = execArgs({
    command,
    osFamily: meta.osFamily,
    shell: meta.shell,
  },);

  rl.debug(`executing command in VM ${name} (${meta.osFamily}, ${path}): ${command}`,);

  /**
   * Serialised `guest-exec` request body; assembled once because the same payload runs the command.
   */
  const execPayload = JSON.stringify({
    execute: 'guest-exec',
    arguments: {
      path,
      arg,
      'capture-output': true,
    },
  },);

  /**
   * Raw response text from the initial `guest-exec` call; carries the pid for polling.
   */
  const execResult = await virsh({
    args: [
      'qemu-agent-command',
      fullName,
      execPayload,
    ],
  },);
  /**
   * Parsed exec response narrowed to the pid carrier; pid is destructured next.
   */
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- QEMU guest agent JSON protocol response
  const execParsed = JSON.parse(execResult,) as { return: { pid: number; }; };
  /**
   * Guest process id assigned by the QEMU guest agent; reused on every poll.
   */
  const { pid, } = execParsed.return;
  rl.debug(`guest-exec started with pid ${String(pid,)}`,);

  /**
   * Completed status after serial QEMU guest-agent polling.
   */
  const status = await waitForGuestExecStatus({
    fullName,
    pid,
    pollIntervalMs: POLL_INTERVAL_MS,
  },);
  /**
   * Decoded stdout text; QMP captures it as base64 so it needs decoding before returning.
   */
  const stdout = status['out-data']
    !== undefined
    ? decodeBase64(status['out-data'],)
    : '';
  /**
   * Decoded stderr text; mirrors the stdout decode path.
   */
  const stderr = status['err-data']
    !== undefined
    ? decodeBase64(status['err-data'],)
    : '';
  /**
   * Guest exit code; defaulted to 0 because the agent omits the field on a clean exit.
   */
  const exitCode = status.exitcode
    ?? 0;

  rl.debug(`command exited with code ${String(exitCode,)}`,);
  return {
    exitCode,
    stderr,
    stdout,
  };
}
