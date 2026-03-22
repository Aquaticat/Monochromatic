/**
 * WebSocket client for communicating with editord.
 *
 * Provides typed request/response messaging with automatic correlation
 * via client-generated request IDs. Rejects pending requests on close.
 */

// oxlint-disable max-lines -- WebSocket client with handshake, request correlation, push dispatch, and close cleanup in a single class

import type { ClientNotification, ClientRequest, Diagnostic, FsChangeType, ServerMessage, } from '../protocol.ts';
import { l as rootLogger, tagged, } from './log.ts';

/** Tagged logger for the WebSocket client subsystem. */
const l = tagged({ tag: 'ws', l: rootLogger, },);

//region Pending request tracking

/** Pending request awaiting a server response. */
type PendingRequest = {
  resolve: (message: ServerMessage,) => void;
  reject: (error: Error,) => void;
};

//endregion Pending request tracking

/**
 * Typed WebSocket client for editord communication.
 *
 * Connects to the editord WebSocket endpoint with token authentication,
 * provides `request()` for correlated request/response pairs, and
 * invokes `onFileChanged` for server push notifications.
 * Pending requests are automatically rejected when the connection closes.
 */
export class EditorWsClient {
  /** Underlying WebSocket connection. */
  #ws: WebSocket;

  /** Map of pending requests keyed by request ID. */
  #pending = new Map<string, PendingRequest>();

  /** Counter for generating unique request IDs. */
  #nextId = 0;

  /** Root directory path reported by the server on connection. */
  rootDir = '';

  /** Stable filesystem identifier reported by the server on connection. */
  fsId = '';

  /** Callback invoked when the server pushes a file change notification. */
  onFileChanged: ((path: string, changeType: FsChangeType, isDirectory: boolean,) => void) | null = null;

  /** Callback invoked when the server pushes diagnostics for a file. */
  onDiagnostics: ((path: string, diagnostics: Diagnostic[],) => void) | null = null;

  /** Resolves when the WebSocket connection is established and authenticated. */
  readonly ready: Promise<void>;

  /**
   * Creates a new WebSocket client and connects to editord.
   *
   * @param port - server port number
   *
   * @param token - authentication token
   */
  constructor({ port, token, }: { port: string; token: string }) {
    const wsUrl = `ws://localhost:${port}/_ws?token=${token}`;
    this.#ws = new WebSocket(wsUrl,);

    this.ready = this.#performHandshake();
    this.#ws.addEventListener('message', this.#handleMessage.bind(this,),);
    this.#ws.addEventListener('close', this.#handleClose.bind(this,),);
  }

  /**
   * Waits for the server handshake message that confirms authentication
   * and provides the root directory path.
   */
  #performHandshake(): Promise<void> {
    const client = this;
    const ws = this.#ws;

    // oxlint-disable-next-line eslint-plugin-promise/avoid-new -- wrapping callback-based WebSocket events into a promise requires new Promise
    return new Promise<void>(function awaitConnection(resolve, reject,) {
      /**
       * Handles the first WebSocket message, expecting a handshake confirmation.
       *
       * @param event - WebSocket message event containing the server handshake
       */
      function handleFirstMessage(event: MessageEvent,): void {
        try {
          // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- JSON.parse returns unknown; runtime type is validated by discriminant checks below
          const data = JSON.parse(String(event.data,),) as ServerMessage;
          if (data.type === 'connected') {
            client.rootDir = data.rootDir;
            client.fsId = data.fsId;
            resolve();
          }
          else if (data.type === 'error') {
            reject(new Error(data.message,),);
          }
        }
        catch (error) {
          l.error(`invalid server handshake: ${String(error,)}`,);
          reject(new Error('invalid server handshake',),);
        }
      }

      ws.addEventListener('message', handleFirstMessage, { once: true, },);
      ws.addEventListener('error', function handleError(_event,) {
        l.error('WebSocket connection failed',);
        reject(new Error('WebSocket connection failed',),);
      }, { once: true, },);
    },);
  }

  /**
   * Sends a typed request and waits for the correlated response.
   *
   * @param message - client message (without `id` — it is auto-generated)
   *
   * @returns server response message
   *
   * @throws when the server responds with an error or the connection closes
   */
  async request(message: ClientRequest,): Promise<ServerMessage> {
    await this.ready;

    const id = String(this.#nextId++,);
    const fullMessage = { ...message, id, };
    const pending = this.#pending;

    // oxlint-disable-next-line eslint-plugin-promise/avoid-new -- pending request tracking requires storing resolve/reject callbacks in a map
    const responsePromise = new Promise<ServerMessage>(
      function awaitResponse(resolve, reject,) {
        pending.set(id, { resolve, reject, },);
      },
    );

    this.#ws.send(JSON.stringify(fullMessage,),);
    return responsePromise;
  }

  /**
   * Sends a notification to the server (fire-and-forget, no response expected).
   * Does not include an `id` field and does not await a response.
   *
   * @param message - notification payload (without `id`)
   */
  async notify(message: ClientNotification,): Promise<void> {
    await this.ready;
    this.#ws.send(JSON.stringify(message,),);
  }

  /**
   * Handles all incoming WebSocket messages after the initial handshake.
   * Routes responses to pending requests by ID, and dispatches push notifications.
   *
   * @param event - WebSocket message event
   */
  #handleMessage(event: MessageEvent,): void {
    // oxlint-disable-next-line eslint/init-declarations -- try/catch initialization with early return requires split declaration
    let data: ServerMessage;
    try {
      // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- JSON.parse returns unknown; runtime type is validated by discriminant checks below
      data = JSON.parse(String(event.data,),) as ServerMessage;
    }
    catch (error) {
      l.error(`received invalid JSON from server: ${String(error,)}`,);
      return;
    }

    // Skip the initial 'connected' message (handled by handshake)
    if (data.type === 'connected')
      return;

    // Push notifications — no request ID
    if (data.type === 'fileChanged') {
      this.onFileChanged?.(data.path, data.changeType, data.isDirectory,);
      return;
    }
    if (data.type === 'diagnostics') {
      this.onDiagnostics?.(data.path, data.diagnostics,);
      return;
    }

    // Correlated response
    if ('id' in data) {
      const pending = this.#pending.get(data.id,);
      if (pending !== undefined) {
        this.#pending.delete(data.id,);
        if (data.type === 'error') {
          pending.reject(new Error(data.message,),);
        }
        else {
          pending.resolve(data,);
        }
      }
    }
  }

  /**
   * Rejects all pending requests when the WebSocket connection closes.
   * Prevents promise leaks from requests that will never receive a response.
   */
  #handleClose(): void {
    const closeError = new Error('WebSocket connection closed',);
    for (const [, pending,] of this.#pending) {
      pending.reject(closeError,);
    }
    this.#pending.clear();
  }
}
