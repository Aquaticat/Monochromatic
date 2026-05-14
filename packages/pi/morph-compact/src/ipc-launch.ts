/**
 * Tiered IPC launch logic for morph-compact.
 *
 * When compressed context exceeds the argv length limit, falls back
 * through IPC tiers: temp file → Unix domain socket → TCP localhost.
 * Also handles reading from the active IPC channel during session start.
 *
 * @module
 */

import type { ExtensionAPI, } from '@earendil-works/pi-coding-agent';
import { launchTerminal, } from '@monochromatic-dev/cli-terminal-exec';
import {
  rmSync,
  unlinkSync,
} from 'node:fs';
import { dirname, } from 'node:path';
import {
  readCompactFile,
  writeCompactFile,
} from './ipc-file.ts';
import {
  createOneShotTcpServer,
  readFromTcpSocket,
} from './ipc-socket-tcp.ts';
import {
  createOneShotSocketServer,
  readFromUnixSocket,
} from './ipc-socket-unix.ts';

//region Constants

/**
 * Maximum byte length for passing compressed text as a CLI argument.
 *
 * Conservative threshold below Linux `MAX_ARG_STRLEN` (128KB).
 * Text exceeding this limit is transferred via file or socket IPC
 * instead of argv to avoid `E2BIG` errors.
 */
export const MAX_COMPRESSED_ARG_BYTES = 100_000;

//endregion

//region Launch with large context

/**
 * Launch a new pi session with compressed context that exceeds
 * the argv length limit.
 *
 * Tries IPC tiers in order: temp file → Unix domain socket → TCP.
 * Each tier writes the text to a channel the new session reads
 * during `session_start` via the corresponding extension flag.
 *
 * @param cwd - working directory for the new terminal
 *
 * @param compressedText - the compressed context string
 *
 * @throws when all IPC tiers fail
 *
 * @example
 * ```typescript
 * await launchWithLargeContext({
 *   cwd: '/home/user/project',
 *   compressedText,
 * });
 * ```
 */
export async function launchWithLargeContext({
  cwd,
  compressedText,
}: {
  cwd: string;
  compressedText: string;
},): Promise<void> {
  // Tier 2: temp file
  try {
    /** Path returned by the file tier; surfaced as a CLI flag to the child. */
    const { filePath, } = writeCompactFile(compressedText,);
    await launchTerminal({
      dir: cwd,
      command: [
        'pi',
        '--morph-compact-file',
        filePath,
      ],
    },);
    // File cleanup happens in session_start handler after reading
    return;
  }
  catch {
    // Fall through to socket tier
  }

  // Tier 3: Unix domain socket
  try {
    /** Socket path returned by the unix-socket tier; surfaced as a CLI flag. */
    const { socketPath, } = createOneShotSocketServer(compressedText,);
    await launchTerminal({
      dir: cwd,
      command: [
        'pi',
        '--morph-compact-socket',
        socketPath,
      ],
    },);
    // Socket cleanup happens in session_start handler or via idle timeout
    return;
  }
  catch {
    // Fall through to TCP tier
  }

  // Tier 4: TCP localhost (zero filesystem dependency)
  /** Final-tier listen address forwarded to the child via CLI flag. */
  const { address, } = await createOneShotTcpServer(compressedText,);
  await launchTerminal({
    dir: cwd,
    command: [
      'pi',
      '--morph-compact-tcp',
      address,
    ],
  },);
}

//endregion

//region Session start injection

/**
 * Handle the `session_start` event for IPC context injection.
 *
 * Reads compressed context from whichever IPC channel is active
 * (checked in priority order: file → Unix socket → TCP) and
 * injects it as a user message.
 *
 * @param extensionApi - the pi extension API for flag access and messaging
 *
 * @example
 * ```typescript
 * await handleSessionStartInject(pi);
 * ```
 */
export async function handleSessionStartInject(
  extensionApi: ExtensionAPI,
): Promise<void> {
  await injectCompactContext(extensionApi,);
}

/**
 * Read compressed context from the active IPC channel and inject
 * it as a user message.
 *
 * Checks extension flags in priority order:
 * 1. `--morph-compact-file` → read file, delete it, send message
 * 2. `--morph-compact-socket` → connect to socket, read, unlink, send message
 * 3. `--morph-compact-tcp` → connect to TCP, read, send message
 *
 * Does nothing if no IPC flag is set (normal session start).
 *
 * @param api - the pi extension API
 */
async function injectCompactContext(
  api: ExtensionAPI,
): Promise<void> {
  // Tier 2: temp file
  /** File path passed from launcher; non-string means file tier inactive. */
  const filePath = api.getFlag('morph-compact-file',);
  if ((typeof filePath) === 'string') {
    /** Decoded compact payload read off disk for injection. */
    const text = readCompactFile(filePath,);
    api.sendUserMessage(text,);
    // Clean up the temp directory after reading
    try {
      rmSync(
        dirname(filePath,),
        {
          recursive: true,
          force: true,
        },
      );
    }
    catch {
      // Best-effort cleanup (temp files in /tmp are ephemeral)
    }
    return;
  }

  // Tier 3: Unix domain socket
  /** Socket path passed from launcher; non-string means socket tier inactive. */
  const socketPath = api.getFlag('morph-compact-socket',);
  if ((typeof socketPath) === 'string') {
    /** Payload read from the one-shot socket server before injection. */
    const text = await readFromUnixSocket(socketPath,);
    api.sendUserMessage(text,);
    // Unlink the socket file after reading
    try {
      unlinkSync(socketPath,);
    }
    catch {
      // Socket may already be removed by server cleanup
    }
    return;
  }

  // Tier 4: TCP localhost
  /** TCP address passed from launcher; non-string means TCP tier inactive. */
  const tcpAddress = api.getFlag('morph-compact-tcp',);
  if ((typeof tcpAddress) === 'string') {
    /** Payload read from the one-shot TCP server before injection. */
    const text = await readFromTcpSocket(tcpAddress,);
    api.sendUserMessage(text,);
  }
}

//endregion
