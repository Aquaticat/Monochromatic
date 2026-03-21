/**
 * Manages a single LSP server child process.
 *
 * Spawns the server, handles the JSON-RPC initialize handshake,
 * routes incoming responses and notifications, and provides
 * typed `request` and `notify` methods for outgoing messages.
 */

// oxlint-disable max-lines -- LSP client with spawn, init handshake, request/response correlation, notification routing, and shutdown in a single class

import { spawn, type ChildProcess, } from 'node:child_process';

import { tagged, type Logger, } from '../log.ts';
import {
  createLspParser,
  encodeLspMessage,
  type JsonRpcMessage,
} from './json-rpc.ts';
import type { LspServerCapabilities, } from './types.ts';

/** Pending request awaiting an LSP server response. */
type PendingLspRequest = {
  resolve: (value: unknown,) => void;
  reject: (error: Error,) => void;
};

/**
 * Client for a single LSP server process.
 *
 * Spawns the process, manages the JSON-RPC framing over stdio,
 * and provides request/notification methods. Incoming server
 * notifications (e.g. `textDocument/publishDiagnostics`) are
 * forwarded to the `onNotification` callback.
 */
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
  #onNotification: (method: string, params: unknown,) => void;

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
  constructor({ command, args, name, cwd, env, l, onNotification, }: {
    command: string;
    args: readonly string[];
    name: string;
    cwd: string;
    env: Record<string, string | undefined>;
    l: Logger;
    onNotification: (method: string, params: unknown,) => void;
  }) {
    this.#name = name;
    this.#l = tagged({ tag: name, l, },);
    this.#onNotification = onNotification;

    this.#proc = spawn(command, [...args,], {
      cwd,
      env,
      stdio: ['pipe', 'pipe', 'pipe',],
    },);

    const parser = createLspParser({
      onMessage: this.#handleMessage.bind(this,),
    },);

    this.#proc.stdout?.on('data', function handleStdout(chunk: Buffer,) {
      parser.feed(chunk,);
    },);

    const clientLog = this.#l;
    this.#proc.stderr?.on('data', function handleStderr(chunk: Buffer,) {
      clientLog.error(`stderr: ${chunk.toString('utf8',).trimEnd()}`,);
    },);

    this.#proc.on('exit', function handleExit(code,) {
      clientLog.info(`exited with code ${String(code,)}`,);
    },);
  }

  /**
   * Performs the LSP initialize handshake.
   * Sends `initialize` request, stores capabilities, then sends `initialized` notification.
   *
   * @param rootUri - workspace root URI (e.g. `file:///home/user/project`)
   *
   * @returns server capabilities
   */
  async initialize({ rootUri, }: { rootUri: string }): Promise<LspServerCapabilities> {
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- LSP initialize always returns { capabilities }
    const result = await this.request({
      method: 'initialize',
      params: {
        processId: process.pid,
        clientInfo: { name: 'editord', version: '0.1.0', },
        rootUri,
        workspaceFolders: [{ uri: rootUri, name: 'root', },],
        capabilities: {
          textDocument: {
            synchronization: { didSave: true, },
            hover: { contentFormat: ['markdown', 'plaintext',], },
            completion: { completionItem: { snippetSupport: false, }, },
            publishDiagnostics: {},
          },
        },
      },
    },) as { capabilities: LspServerCapabilities };

    this.capabilities = result.capabilities;
    this.notify({ method: 'initialized', params: {}, },);
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
   * @returns resolved response result, or rejects on error
   *
   * @throws when the server responds with a JSON-RPC error
   */
  request({ method, params, }: { method: string; params: unknown }): Promise<unknown> {
    const id = this.#nextId++;
    const message = { jsonrpc: '2.0' as const, id, method, params, };
    const pending = this.#pending;

    // oxlint-disable-next-line eslint-plugin-promise/avoid-new -- request correlation requires storing resolve/reject in a map
    const responsePromise = new Promise<unknown>(function awaitLspResponse(resolve, reject,) {
      pending.set(id, { resolve, reject, },);
    },);

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
  notify({ method, params, }: { method: string; params: unknown }): void {
    this.#send({ jsonrpc: '2.0', method, params, },);
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
      await this.request({ method: 'shutdown', params: null, },);
      this.notify({ method: 'exit', params: null, },);
    }
    catch {
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
   * Responses are matched to pending requests by ID.
   * Notifications are forwarded to the `onNotification` callback.
   * Server-initiated requests receive a no-op acknowledgment.
   *
   * @param message - parsed JSON-RPC message
   */
  #handleMessage(message: JsonRpcMessage,): void {
    // Response to a pending request
    if ('id' in message && !('method' in message)) {
      // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- discriminant check above narrows to response shape
      const response = message as { id: number; result?: unknown; error?: { code: number; message: string } };
      const pending = this.#pending.get(response.id,);
      if (pending !== undefined) {
        this.#pending.delete(response.id,);
        if (response.error !== undefined) {
          pending.reject(new Error(`${this.#name}: ${response.error.message}`,),);
        }
        else {
          pending.resolve(response.result,);
        }
      }
    }
    // Server notification (e.g. textDocument/publishDiagnostics)
    else if ('method' in message && !('id' in message)) {
      // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- discriminant check above narrows to notification shape
      const notification = message as { method: string; params?: unknown };
      this.#onNotification(notification.method, notification.params,);
    }
    // Server-initiated request (e.g. window/workDoneProgress/create)
    else if ('method' in message && 'id' in message) {
      // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- discriminant check above narrows to request shape
      const request = message as { id: number };
      this.#send({ jsonrpc: '2.0', id: request.id, result: null, },);
    }
  }
}
