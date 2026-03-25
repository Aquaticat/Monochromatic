/**
 * Manages a single LSP server child process.
 *
 * Spawns the server, handles the JSON-RPC initialize handshake,
 * routes incoming responses and notifications, and provides
 * typed `request` and `notify` methods for outgoing messages.
 */

import {
  type ChildProcess,
  spawn,
} from 'node:child_process';

import {
  type Logger,
  tagged,
} from '../log.ts';
import {
  createLspParser,
  encodeLspMessage,
  type JsonRpcMessage,
} from './json-rpc.ts';
import { buildInitializeParams, } from './lsp-client-init.ts';
import {
  type PendingLspRequest,
  routeJsonRpcMessage,
} from './lsp-client-routing.ts';
import type { LspServerCapabilities, } from './types.ts';

/**
 * Client for a single LSP server process.
 *
 * Spawns the process, manages the JSON-RPC framing over stdio,
 * and provides request/notification methods. Incoming server
 * notifications (e.g. `textDocument/publishDiagnostics`) are
 * forwarded to the `onNotification` callback.
 */
/**
 * Timeout for LSP feature requests such as hover, completion,
 * inlay hints, and navigation (milliseconds).
 * Shorter than the client-side WebSocket timeout (30 s) so
 * the server can reply with an empty result before the client
 * gives up. Long enough for legitimate slow responses on large files.
 */
export const LSP_FEATURE_TIMEOUT_MS = 10_000;

export class LspClient {
  /** Child process handle. */
  #proc: ChildProcess;

  /** Map of pending requests keyed by JSON-RPC ID. */
  #pending = new Map<number, PendingLspRequest>();

  /** Counter for generating unique JSON-RPC request IDs. */
  #nextId = 0;

  /** Display name for logging (e.g. "oxlint", "tsgo", "dprint"). */
  #name: string;

  /** Tagged logger for this LSP client. */
  #l: Logger;

  /** Callback for server-initiated notifications. */
  #onNotification: (event: {
    method: string;
    params: unknown
  },) => void;

  /** Whether the LSP initialize handshake has completed. */
  #initialized = false;

  /** Server capabilities reported during initialization. */
  capabilities: LspServerCapabilities = {};

  /**
   * Spawns the LSP server process and sets up message parsing.
   *
   * @param command - executable path or name
   *
   * @param args - command-line arguments
   *
   * @param name - display name for logging
   *
   * @param cwd - working directory for the child process
   *
   * @param env - environment variables for the child process
   *
   * @param l - parent logger to compose tags from
   *
   * @param onNotification - callback for server-initiated notifications
   */
  constructor({
    command,
    args,
    name,
    cwd,
    env,
    l,
    onNotification,
  }: {
    command: string;
    args: readonly string[];
    name: string;
    cwd: string;
    env: Record<string, string | undefined>;
    l: Logger;
    onNotification: (event: {
      method: string;
      params: unknown
    },) => void;
  },) {
    this.#name = name;
    this.#l = tagged({
      tag: name,
      l,
    },);
    this.#onNotification = onNotification;

    this.#proc = spawn(
      command,
      [...args,],
      {
      cwd,
      env,
      stdio: ['pipe', 'pipe', 'pipe',],
    },
    );

    const clientLog = this.#l;
    const parser = createLspParser({
      onMessage: this.#handleMessage.bind(this,),
      onError: function handleParseError(error,) {
        clientLog.error(`malformed JSON-RPC message: ${String(error,)}`,);
      },
    },);
    this.#proc.stdout?.on(
      'data',
      function handleStdout(chunk: Buffer,) {
      parser.feed(chunk,);
    },
    );
    this.#proc.stderr?.on(
      'data',
      function handleStderr(chunk: Buffer,) {
      clientLog.error(`stderr: ${chunk.toString('utf8',).trimEnd()}`,);
    },
    );
    this.#proc.on(
      'exit',
      function handleExit(code,) {
      clientLog.info(`exited with code ${String(code,)}`,);
    },
    );
  }

  /**
   * Performs the LSP initialize handshake.
   * Sends `initialize` request, stores capabilities, then sends `initialized` notification.
   *
   * @param rootUri - workspace root URI (e.g. `file:///home/user/project`)
   *
   * @returns server capabilities
   */
  async initialize({
    rootUri,
    initializationOptions,
  }: {
    rootUri: string;
    initializationOptions?: Record<string, unknown>;
  },): Promise<LspServerCapabilities> {
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- LSP initialize always returns { capabilities }
    const result = await this.request({
      method: 'initialize',
      params: buildInitializeParams({
        rootUri,
        initializationOptions,
      },),
    },) as { capabilities: LspServerCapabilities; };

    this.capabilities = result.capabilities;
    this.notify({
      method: 'initialized',
      params: {},
    },);
    this.#initialized = true;
    this.#l.info('initialized',);
    return this.capabilities;
  }

  /**
   * Sends a JSON-RPC request and waits for the correlated response.
   *
   * @param method - LSP method name (e.g. "textDocument/hover")
   *
   * @param params - method parameters
   *
   * @param timeoutMs - optional per-request timeout; when set, the pending
   *   entry is cleaned up and the promise rejected if no response arrives
   *   within this duration. Omit for unbounded waits (e.g. `initialize`).
   *
   * @returns resolved response result, or rejects on error / timeout
   *
   * @throws when the server responds with a JSON-RPC error or the request times out
   */
  request({
    method,
    params,
    timeoutMs,
  }: {
    method: string;
    params: unknown;
    timeoutMs?: number;
  },): Promise<unknown> {
    const id = this.#nextId++;
    const message = {
      jsonrpc: '2.0' as const,
      id,
      method,
      params,
    };
    const pending = this.#pending;
    const clientLog = this.#l;

    // oxlint-disable-next-line eslint-plugin-promise/avoid-new -- request correlation requires storing resolve/reject in a map
    const responsePromise = new Promise<unknown>(
      function awaitLspResponse(
        resolve,
        reject,
      ) {
        pending.set(
          id,
          { resolve, reject, },
        );
        if (timeoutMs !== undefined) {
          setTimeout(
            function rejectOnTimeout() {
            if (pending.delete(id,)) {
              clientLog.error(
                `${method} (id ${id}) timed out after ${timeoutMs}ms`,
              );
              reject(
                new Error(`${method} (id ${id}) timed out after ${timeoutMs}ms`,),
              );
            }
          },
            timeoutMs,
          );
        }
      },
    );

    this.#send(message,);
    return responsePromise;
  }

  /**
   * Sends a JSON-RPC notification (fire-and-forget, no response expected).
   *
   * @param method - LSP method name (e.g. "textDocument/didOpen")
   *
   * @param params - notification parameters
   */
  notify({
    method,
    params,
  }: {
    method: string;
    params: unknown
  },): void {
    this.#send({
      jsonrpc: '2.0',
      method,
      params,
    },);
  }

  /**
   * Whether the LSP initialize handshake has completed.
   *
   * @returns true if initialized
   */
  get initialized(): boolean {
    return this.#initialized;
  }

  /**
   * Gracefully shuts down the LSP server.
   * Sends `shutdown` request followed by `exit` notification.
   * Falls back to killing the process if shutdown fails.
   */
  async shutdown(): Promise<void> {
    try {
      await this.request({
        method: 'shutdown',
        params: null,
      },);
      this.notify({
        method: 'exit',
        params: null,
      },);
    }
    catch (error) {
      this.#l.error(`shutdown failed, killing process: ${String(error,)}`,);
      this.#proc.kill();
    }
  }

  /**
   * Writes a JSON-RPC message to the child process stdin.
   *
   * @param message - message object to encode and send
   */
  #send(message: unknown,): void {
    const encoded = encodeLspMessage({ message, },);
    this.#proc.stdin?.write(encoded,);
  }

  /**
   * Routes an incoming JSON-RPC message to the appropriate handler.
   * Delegates to {@link routeJsonRpcMessage} for response correlation,
   * notification forwarding, and server-initiated request acknowledgment.
   *
   * @param message - parsed JSON-RPC message
   */
  #handleMessage(message: JsonRpcMessage,): void {
    routeJsonRpcMessage({
      message,
      pending: this.#pending,
      name: this.#name,
      send: this.#send.bind(this,),
      onNotification: this.#onNotification,
    },);
  }
}
