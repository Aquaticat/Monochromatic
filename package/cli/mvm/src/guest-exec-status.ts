import { wait, } from '@monochromatic-dev/module-async-time/ts';

import { virsh, } from './virsh.ts';

/**
 * Completed or pending QEMU guest-exec status payload.
 *
 * @example
 * ```ts
 * const status: GuestExecStatus = { exited: false };
 * ```
 */
export type GuestExecStatus = {
  readonly exited: boolean;
  readonly exitcode?: number;
  readonly 'out-data'?: string;
  readonly 'err-data'?: string;
};

/**
 * Polls one QEMU guest process until its status reports completion.
 *
 * @param fullName - Prefixed libvirt domain name.
 *
 * @param pid - QEMU guest-agent process identifier.
 *
 * @param pollIntervalMs - Delay between incomplete status responses.
 *
 * @returns Completed guest status with captured output when requested at launch.
 *
 * @example
 * ```ts
 * const status = await waitForGuestExecStatus({
 *   fullName: 'mvm-dev',
 *   pid: 42,
 *   pollIntervalMs: 250,
 * });
 * ```
 */
export async function waitForGuestExecStatus({
  fullName,
  pid,
  pollIntervalMs,
}: {
  readonly fullName: string;
  readonly pid: number;
  readonly pollIntervalMs: number;
}): Promise<GuestExecStatus> {
  /**
   * Serialised status request reused for every poll of this guest process.
   */
  const statusPayload = JSON.stringify({
    execute: 'guest-exec-status',
    arguments: { pid, },
  },);
  /**
   * Latest guest status; the `exited` flag is the polling continuation condition.
   */
  const polling: { current: GuestExecStatus; } = {
    current: { exited: false, },
  };
  while (!(polling
    .current
    .exited)) {
    /**
     * Raw QEMU guest-agent status response for current sequential poll.
     */
    // oxlint-disable-next-line no-await-in-loop -- guest status polling must observe each response before issuing next request.
    const statusResult = await virsh({
      args: [
        'qemu-agent-command',
        fullName,
        statusPayload,
      ],
    },);
    /**
     * Parsed status response narrowed to QEMU guest-agent envelope.
     */
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- QEMU guest agent JSON protocol response
    const statusParsed = JSON.parse(statusResult,) as { return: GuestExecStatus; };
    polling.current = statusParsed.return;
    if (!(polling
      .current
      .exited)) {
      // oxlint-disable-next-line no-await-in-loop -- incomplete status requires one serial delay before next request.
      await wait(pollIntervalMs,);
    }
  }
  return polling.current;
}
