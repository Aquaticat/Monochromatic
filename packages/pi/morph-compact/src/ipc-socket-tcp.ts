/**
 * TCP localhost IPC for morph-compact.
 *
 * Creates a one-shot TCP server on 127.0.0.1 that writes compressed
 * context to the first client connection, then closes. Used as the
 * final fallback when both argv and file tiers fail (e.g. read-only
 * `/tmp`).
 *
 * @module
 */

import {
  createConnection as createTcpConnection,
  createServer as createTcpServer,
  type Server,
  type Socket,
} from 'node:net';

//region Constants

/** Milliseconds before the server auto-closes if no client connects. */
const SERVER_IDLE_TIMEOUT_MS = 30_000;

/** Milliseconds before a client read attempt times out. */
const CLIENT_READ_TIMEOUT_MS = 10_000;

/** Loopback address — no remote access. */
const LOCALHOST = '127.0.0.1';

//endregion

//region Types

/**
 * Result of creating a one-shot TCP server.
 */
export type OneShotTcpServerResult = {
  /** Host:port string (e.g. "127.0.0.1:43210"). */
  address: string;
  /** Closes the server. */
  cleanup: () => void;
};

//endregion

//region Server

/**
 * Create a one-shot TCP server on localhost.
 *
 * Binds to `127.0.0.1:0` (OS picks a free port), waits for the
 * server to start listening, then returns the address. When a
 * client connects, the entire `text` is written to that single
 * connection, and the server closes.
 *
 * A 30-second idle timeout auto-cleans if no client connects.
 *
 * @param text - the compressed context string to serve
 *
 * @returns the host:port address and a cleanup function
 *
 * @throws when the TCP server cannot be created or bound
 *
 * @example
 * ```typescript
 * const { address, cleanup } = await createOneShotTcpServer(compressedText);
 * // pass address to new pi session via --morph-compact-tcp
 * ```
 */
export async function createOneShotTcpServer(
  text: string,
): Promise<OneShotTcpServerResult> {
  let server: Server | null = null;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let served = false;

  /** Close the server and clear idle timer. */
  function close(): void {
    if (idleTimer !== null) {
      clearTimeout(idleTimer,);
      idleTimer = null;
    }
    if (server !== null) {
      server.close();
      server = null;
    }
  }

  // Wait for the server to start listening before returning
  // oxlint-disable-next-line eslint-plugin-promise/avoid-new -- wrapping callback-based server.listen requires manual Promise construction
  const address = await new Promise<string>(
    function awaitListening(
      resolve,
      reject,
    ): void {
      server = createTcpServer(
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

          // Close server after writing — one-shot
          queueMicrotask(close,);
        },
      );

      server.on(
        'error',
        function handleError(
          err: Error,
        ): void {
          close();
          reject(err,);
        },
      );

      // Bind to localhost with OS-assigned port
      server.listen(
        0,
        LOCALHOST,
        function onListening(): void {
          const addrInfo = server?.address();
          if (
            addrInfo !== undefined
            && addrInfo !== null
            && typeof addrInfo !== 'string'
            && 'port' in addrInfo
          ) {
            resolve(`${addrInfo.address}:${addrInfo.port}`);
          }
        },
      );

      // Auto-cleanup after idle timeout
      idleTimer = setTimeout(
        close,
        SERVER_IDLE_TIMEOUT_MS,
      );
    },
  );

  return {
    address,
    cleanup: close,
  };
}

//endregion

//region Client

/* oxlint-disable eslint-plugin-promise/avoid-new -- wrapping callback-based net.createConnection requires manual Promise construction */
/**
 * Read compressed context from a TCP localhost server.
 *
 * Connects to the one-shot server, reads all data until the
 * server closes the connection, and returns the text.
 *
 * A 10-second timeout prevents hanging if the server never responds.
 *
 * @param address - host:port string (e.g. "127.0.0.1:43210")
 *
 * @returns the compressed context string
 *
 * @throws when the TCP connection fails or reading times out
 *
 * @example
 * ```typescript
 * const text = await readFromTcpSocket('127.0.0.1:43210');
 * // text contains the Morph-compressed conversation context
 * ```
 */
export function readFromTcpSocket(
  address: string,
): Promise<string> {
  return new Promise(
    function promiseRead(
      resolve,
      reject,
    ): void {
      const [host, portStr,] = address.split(':',);
      const port = Number(portStr,);
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

      const socket = createTcpConnection(
        {
          host,
          port,
        },
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
            `readFromTcpSocket: timed out after ${CLIENT_READ_TIMEOUT_MS}ms`,
          ),);
        },
        CLIENT_READ_TIMEOUT_MS,
      );
    },
  );
}
// oxlint-enable eslint-plugin-promise/avoid-new

//endregion
