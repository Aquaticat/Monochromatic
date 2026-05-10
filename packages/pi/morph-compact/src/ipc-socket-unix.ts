/**
 * Unix domain socket IPC for morph-compact.
 *
 * Creates a one-shot server that writes compressed context to the
 * first client connection, then closes. Used as a fallback when
 * the temp-file tier fails (e.g. `/tmp` is read-only).
 *
 * @module
 */

import { randomUUID, } from 'node:crypto';
import {
  createConnection,
  createServer,
  type Server,
  type Socket,
} from 'node:net';
import { join, } from 'node:path';
import { tmpdir, } from 'node:os';
import { unlinkSync, } from 'node:fs';

//region Constants

/** Milliseconds before the server auto-closes if no client connects. */
const SERVER_IDLE_TIMEOUT_MS = 30_000;

/** Milliseconds before a client read attempt times out. */
const CLIENT_READ_TIMEOUT_MS = 10_000;

//endregion

//region Types

/**
 * Result of creating a one-shot socket server.
 */
export type OneShotSocketServerResult = {
  /** Filesystem path of the Unix domain socket. */
  socketPath: string;
  /** Unlinks the socket file and closes the server. */
  cleanup: () => void;
};

//endregion

//region Server

/**
 * Create a one-shot Unix domain socket server.
 *
 * Listens on a unique socket path under the system tmpdir.
 * When a client connects, the entire `text` is written to that
 * single connection, the server closes, and the socket file is unlinked.
 *
 * A 30-second idle timeout auto-cleans if no client connects.
 *
 * @param text - the compressed context string to serve
 *
 * @returns the socket path and a cleanup function
 *
 * @throws when the socket cannot be created or bound
 *
 * @example
 * ```typescript
 * const { socketPath, cleanup } = createOneShotSocketServer(compressedText);
 * // pass socketPath to new pi session via --morph-compact-socket
 * ```
 */
export function createOneShotSocketServer(
  text: string,
): OneShotSocketServerResult {
  const socketPath = join(
    tmpdir(),
    `morph-compact-${randomUUID()}.sock`,
  );

  let server: Server | null = null;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let served = false;

  /** Close the server and unlink the socket file. */
  function close(): void {
    if (idleTimer !== null) {
      clearTimeout(idleTimer,);
      idleTimer = null;
    }
    if (server !== null) {
      server.close();
      server = null;
    }
    try {
      unlinkSync(socketPath,);
    }
    catch {
      // Socket file may already be removed or never created
    }
  }

  server = createServer(
    function handleConnection(
      socket: Socket,
    ): void {
      if (served)
        return;
      served = true;

      if (idleTimer !== null) {
        clearTimeout(idleTimer,);
        idleTimer = null;
      }

      socket.write(
        text,
        'utf8',
      );
      socket.end();

      // Close server after writing (one-shot)
      queueMicrotask(close,);
    },
  );

  server.listen(socketPath,);

  server.on(
    'error',
    function handleError(): void {
      close();
    },
  );

  // Auto-cleanup after idle timeout
  idleTimer = setTimeout(
    close,
    SERVER_IDLE_TIMEOUT_MS,
  );

  return {
    socketPath,
    cleanup: close,
  };
}

//endregion

//region Client

/* oxlint-disable eslint-plugin-promise/avoid-new -- wrapping callback-based net.createConnection requires manual Promise construction */
/**
 * Read compressed context from a Unix domain socket.
 *
 * Connects to the one-shot server, reads all data until the
 * server closes the connection, and returns the text.
 *
 * A 10-second timeout prevents hanging if the server never responds.
 *
 * @param socketPath - filesystem path of the Unix domain socket
 *
 * @returns the compressed context string
 *
 * @throws when the socket cannot be connected to or reading times out
 *
 * @example
 * ```typescript
 * const text = await readFromUnixSocket(socketPath);
 * // text contains the Morph-compressed conversation context
 * ```
 */
export function readFromUnixSocket(
  socketPath: string,
): Promise<string> {
  return new Promise(
    function promiseRead(
      resolve,
      reject,
    ): void {
      const chunks: Buffer[] = [];
      let settled = false;

      /**
       * Settle the promise with either an error or a result.
       *
       * @param error - error to reject with, or null for success
       *
       * @param result - resolved value when error is null
       */
      function finish(
        error: Error | null,
        result?: string,
      ): void {
        if (settled)
          return;
        settled = true;

        if (error !== null)
          reject(error,);
        else
          resolve(result ?? '',);
      }

      const socket = createConnection(
        { path: socketPath, },
        function onConnect(): void {
          socket.on(
            'data',
            function onData(
              chunk: Buffer,
            ): void {
              chunks.push(chunk,);
            },
          );
          socket.on(
            'end',
            function onEnd(): void {
              finish(
                null,
                Buffer.concat(chunks,).toString('utf8',),
              );
            },
          );
          socket.on(
            'error',
            function onError(
              err: Error,
            ): void {
              finish(err,);
            },
          );
        },
      );

      socket.on(
        'error',
        function onError(
          err: Error,
        ): void {
          finish(err,);
        },
      );

      // Read timeout
      setTimeout(
        function onTimeout(): void {
          socket.destroy();
          finish(new Error(
            `readFromUnixSocket: timed out after ${CLIENT_READ_TIMEOUT_MS}ms`,
          ),);
        },
        CLIENT_READ_TIMEOUT_MS,
      );
    },
  );
}
// oxlint-enable eslint-plugin-promise/avoid-new

//endregion
