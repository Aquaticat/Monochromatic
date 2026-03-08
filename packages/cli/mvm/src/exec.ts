import { VM_PREFIX, validateName } from './config.ts';
import { l, tagged } from './log.ts';
import { virsh } from './virsh.ts';

/** Milliseconds to wait between polling for guest-exec completion. */
const POLL_INTERVAL_MS = 250;

/**
 * Decodes a base64-encoded string to UTF-8 text.
 *
 * @param encoded - base64 string from guest agent response
 * @returns Decoded UTF-8 string
 *
 * @example
 * ```ts
 * decodeBase64('aGVsbG8='); // => "hello"
 * ```
 */
function decodeBase64(encoded: string): string {
  return Buffer.from(encoded, 'base64').toString('utf-8');
}

/**
 * Executes a command inside a running VM via the QEMU guest agent.
 * Runs the command as the `ubuntu` user, captures stdout and stderr,
 * and reflects the output back to the host.
 *
 * @param options - VM name without prefix and the command string to execute
 * @throws Error when the guest agent is unreachable or the command fails
 *
 * @example
 * ```ts
 * await exec({ command: 'uname -a', name: 'dev-01' });
 * ```
 */
export async function exec({ command, name }: { command: string; name: string }): Promise<void> {
  validateName(name);
  const rl = tagged({ tag: exec.name, l, });
  const fullName = `${VM_PREFIX}${name}`;

  rl.debug(`executing command in VM ${name}: ${command}`);

  const execPayload = JSON.stringify({
    execute: 'guest-exec',
    arguments: {
      path: '/bin/bash',
      arg: ['-c', command],
      'capture-output': true,
    },
  });

  const execResult = await virsh({ args: ['qemu-agent-command', fullName, execPayload], });
  const { pid } = JSON.parse(execResult).return as { pid: number };
  rl.debug(`guest-exec started with pid ${String(pid)}`);

  const statusPayload = JSON.stringify({
    execute: 'guest-exec-status',
    arguments: { pid, },
  });

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- polling loop
  while (true) {
    const statusResult = await virsh({ args: ['qemu-agent-command', fullName, statusPayload], });
    const status = JSON.parse(statusResult).return as {
      exited: boolean;
      exitcode?: number;
      'out-data'?: string;
      'err-data'?: string;
    };

    if (!status.exited) {
      await Bun.sleep(POLL_INTERVAL_MS);
      continue;
    }

    const stdout = status['out-data'] !== undefined ? decodeBase64(status['out-data']) : '';
    const stderr = status['err-data'] !== undefined ? decodeBase64(status['err-data']) : '';

    if (stdout.length > 0) {
      process.stdout.write(stdout);
    }
    if (stderr.length > 0) {
      process.stderr.write(stderr);
    }

    if (status.exitcode !== undefined && status.exitcode !== 0) {
      process.exitCode = status.exitcode;
    }

    return;
  }
}
