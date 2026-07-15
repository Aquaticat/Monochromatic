/**
 * WebSocket client for communicating with editord.
 *
 * Provides typed request/response messaging with automatic correlation
 * via client-generated request IDs. Rejects pending requests on close
 * and reconnects automatically with exponential backoff.
 */

import type {
  ClientNotification,
  ClientRequest,
  RequestResponseMap,
  ServerMessage,
} from '../../../protocol.ts';
import type {
  ClientDiagnosticsHandler,
  FileChangedHandler,
} from '../app/types.ts';
import {
  l as rootLogger,
  tagged,
} from '../log.ts';
import { performHandshake, } from './handshake.ts';

/**
 * Tagged logger for the WebSocket client subsystem.
 */
const l = tagged({
  tag: 'ws',
  l: rootLogger,
},);

//region Pending request tracking

/**
 * Pending request awaiting a server response.
 */
type PendingRequest = {
  readonly resolve: (message: ServerMessage,) => void;
  readonly reject: (error: Error,) => void;
  /**
   * Timeout handle that rejects the request after {@link REQUEST_TIMEOUT_MS}.
   */
  readonly timeoutId: number;
};

/**
 * Maximum time to wait for a server response before rejecting (milliseconds).
 */
const REQUEST_TIMEOUT_MS = 30_000;

//endregion Pending request tracking

//region Reconnect constants

/**
 * Initial delay before the first reconnection attempt (milliseconds).
 */
const RECONNECT_BASE_MS = 1_000;

/**
 * Maximum delay between reconnection attempts (milliseconds).
 */
const RECONNECT_MAX_MS = 16_000;

/**
 * Multiplier applied to the reconnect delay after each failed attempt.
 */
const RECONNECT_BACKOFF_FACTOR = 2;

//endregion Reconnect constants

/**
 * Options for {@link createEditorWsClient}.
 */
export type EditorWsClientOptions = {
  /**
   * Server port number.
   */
  readonly port: string;
  /**
   * Authentication token.
   */
  readonly token: string;
};

/**
 * Mutable WebSocket client state captured by the factory closure.
 */
type EditorWsClientState = {
  /**
   * Underlying WebSocket connection.
   */
  ws: WebSocket;
  /**
   * Counter for generating unique request IDs.
   */
  nextId: number;
  /**
   * Root directory path reported by the server on connection.
   */
  rootDir: string;
  /**
   * Stable filesystem identifier reported by the server on connection.
   */
  fsId: string;
  /**
   * Callback invoked when the server pushes a file change notification.
   */
  onFileChanged: FileChangedHandler | null;
  /**
   * Callback invoked when the server pushes diagnostics for a file.
   */
  onDiagnostics: ClientDiagnosticsHandler | null;
  /**
   * Resolves when the WebSocket connection is established and authenticated.
   */
  ready: Promise<void>;
  /**
   * Current reconnect delay in milliseconds; reset on successful connection.
   */
  reconnectDelay: number;
};

/**
 * Typed WebSocket client handle returned by {@link createEditorWsClient}.
 */
export type EditorWsClient = Readonly<{
  /**
   * Root directory path reported by the server on connection.
   */
  readonly rootDir: string;
  /**
   * Stable filesystem identifier reported by the server on connection.
   */
  readonly fsId: string;
  /**
   * Resolves when the WebSocket connection is established and authenticated.
   */
  readonly ready: Promise<void>;
  /**
   * Installs file-change push handler.
   */
  readonly setFileChangedHandler: (handler: FileChangedHandler | null,) => void;
  /**
   * Installs diagnostics push handler.
   */
  readonly setDiagnosticsHandler: (handler: ClientDiagnosticsHandler | null,) => void;
  /**
   * Sends a typed request and waits for the correlated response.
   */
  readonly request: <const TReq extends ClientRequest,>(
    message: TReq,
  ) => Promise<RequestResponseMap[TReq['type']]>;
  /**
   * Sends a notification to the server.
   */
  readonly notify: (message: ClientNotification,) => Promise<void>;
}>;

/**
 * Creates a typed WebSocket client for editord communication.
 *
 * Connects to the editord WebSocket endpoint with token authentication,
 * provides `request()` for correlated request/response pairs, and
 * invokes file change handlers for server push notifications.
 * Pending requests are automatically rejected when the connection closes.
 * Reconnects automatically with exponential backoff when the connection drops.
 *
 * @param port - server port number
 *
 * @param token - authentication token
 *
 * @returns frozen WebSocket client handle
 *
 * @example
 * ```ts
 * const client = createEditorWsClient({ port: '4400', token: 'dev-token', });
 * await client.ready;
 * ```
 */
export function createEditorWsClient({
  port,
  token,
}: EditorWsClientOptions,): EditorWsClient {
  /**
   * WebSocket URL for connection and reconnection.
   */
  const wsUrl = `ws://localhost:${port}/_ws?token=${token}`;
  /**
   * Map of pending requests keyed by request ID.
   */
  const pending = new Map<string, PendingRequest>();
  /**
   * Mutable connection and handler state kept private to this client.
   */
  const state: EditorWsClientState = {
    ws: new WebSocket(wsUrl,),
    nextId: 0,
    rootDir: '',
    fsId: '',
    onFileChanged: null,
    onDiagnostics: null,
    ready: Promise.resolve(),
    reconnectDelay: RECONNECT_BASE_MS,
  };

  /**
   * Installs file-change push handler.
   *
   * @param handler - handler to install, or null to clear
   *
   * @example
   * ```ts
   * client.setFileChangedHandler(function handleChange(event) { console.info(event.path); });
   * ```
   */
  function setFileChangedHandler(handler: FileChangedHandler | null,): void {
    state.onFileChanged = handler;
  }

  /**
   * Installs diagnostics push handler.
   *
   * @param handler - handler to install, or null to clear
   *
   * @example
   * ```ts
   * client.setDiagnosticsHandler(function handleDiagnostics(event) { console.info(event.path); });
   * ```
   */
  function setDiagnosticsHandler(handler: ClientDiagnosticsHandler | null,): void {
    state.onDiagnostics = handler;
  }

  /**
   * Sends a typed request and waits for the correlated response.
   *
   * Return type narrows by request discriminant via {@link RequestResponseMap},
   * so callers receive the matching success-side ServerMessage variant directly
   * without manual narrowing. Error responses reject the promise rather than
   * resolving with an error variant.
   *
   * @param message - client message without `id`; it is auto-generated
   *
   * @returns success-side ServerMessage variant matching request type
   *
   * @throws when the server responds with an error or the connection closes
   *
   * @example
   * ```ts
   * const { content, kind } = await ws.request({ type: 'open', path });
   * ```
   */
  async function request<const TReq extends ClientRequest,>(
    message: TReq,
  ): Promise<RequestResponseMap[TReq['type']]> {
    await state.ready;

    /**
     * Monotonically increasing correlation ID assigned to this request.
     */
    const id = String(state.nextId,);
    state.nextId += 1;
    /**
     * Request payload with the generated `id` attached for server correlation.
     */
    const fullMessage = {
      ...message,
      id,
    };

    /* oxlint-disable eslint-plugin-promise/avoid-new -- pending request tracking requires storing resolve/reject callbacks in a map */
    /**
     * Promise that resolves with the matching response or rejects on timeout/close.
     */
    const responsePromise = new Promise<ServerMessage>(
      function awaitResponse(
        resolve,
        reject,
      ) {
        /* oxlint-disable typescript-eslint/no-unsafe-type-assertion -- globalThis.setTimeout returns NodeJS.Timeout when Node types loaded */
        /**
         * Timer handle stored on the pending entry so the response handler can cancel it.
         */
        const timeoutId = globalThis.setTimeout(
          function rejectStale() {
            if (pending.delete(id,)) {
              reject(
                new Error(`request ${id} timed out after ${REQUEST_TIMEOUT_MS}ms`,),
              );
            }
          },
          REQUEST_TIMEOUT_MS,
        ) as unknown as number;
        /* oxlint-enable typescript-eslint/no-unsafe-type-assertion */
        pending.set(
          id,
          {
            resolve,
            reject,
            timeoutId,
          },
        );
      },
    );
    /* oxlint-enable eslint-plugin-promise/avoid-new */

    state.ws
      .send(JSON.stringify(fullMessage,),);
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- wire correlation by id guarantees resolved value is the success-side variant matching TReq['type']; error variants reject through handleMessage
    return responsePromise as Promise<RequestResponseMap[TReq['type']]>;
  }

  /**
   * Sends a notification to the server (fire-and-forget, no response expected).
   * Does not include an `id` field and does not await a response.
   *
   * @param message - notification payload without `id`
   */
  async function notify(message: ClientNotification,): Promise<void> {
    await state.ready;
    state.ws
      .send(JSON.stringify(message,),);
  }

  /**
   * Handles all incoming WebSocket messages after the initial handshake.
   * Routes responses to pending requests by ID, and dispatches push notifications.
   *
   * @param event - WebSocket message event
   */
  function handleMessage(event: MessageEvent,): void {
    /* oxlint-disable eslint/init-declarations -- try/catch initialization with early return requires split declaration */
    /**
     * Parsed message body; declared outside the try block so the catch can short-circuit before assignment.
     */
    // oxlint-disable-next-line no-restricted-syntax/no-function-root-let -- try-assignment pattern: `data` is assigned inside try, used after the catch's early return
    let data: ServerMessage;
    /* oxlint-enable eslint/init-declarations */
    try {
      // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- JSON.parse returns unknown; runtime type is validated by discriminant checks below
      data = JSON.parse(String(event.data,),) as ServerMessage;
    }
    catch (error) {
      l.error(`received invalid JSON from server: ${String(error,)}`,);
      return;
    }

    // Skip the initial 'connected' message (handled by handshake)
    if (data.type
      === 'connected')
      return;

    // Push notifications: no request ID
    if (data.type
      === 'fileChanged') {
      state.onFileChanged?.({
        path: data.path,
        changeType: data.changeType,
        isDirectory: data.isDirectory,
      },);
      return;
    }
    if (data.type
      === 'diagnostics') {
      state.onDiagnostics?.({
        path: data.path,
        diagnostics: data.diagnostics,
      },);
      return;
    }

    // Correlated response
    if ('id' in data) {
      /**
       * Tracked request matching this response's `id`, or undefined if it already timed out.
       */
      const pendingRequest = pending.get(data.id,);
      if (pendingRequest !== undefined) {
        pending.delete(data.id,);
        clearTimeout(pendingRequest.timeoutId,);
        if (data.type
          === 'error')
          pendingRequest.reject(new Error(data.message,),);
        else
          pendingRequest.resolve(data,);
      }
    }
  }

  /**
   * Performs the server handshake using the extracted handshake module.
   */
  function performHandshakeForConnection(): Promise<void> {
    return performHandshake({
      ws: state.ws,
      onConnected: function setFields({
        rootDir,
        fsId,
      },) {
        state.rootDir = rootDir;
        state.fsId = fsId;
      },
    },);
  }

  /**
   * Wires message, close, and handshake handlers onto the current WebSocket.
   */
  function wireConnection(): Promise<void> {
    /**
     * Handshake promise returned to the caller so `ready` resolves once authenticated.
     */
    const handshakePromise = performHandshakeForConnection();
    state.ws
      .addEventListener(
      'message',
      handleMessage,
    );
    state.ws
      .addEventListener(
      'close',
      handleClose,
    );
    return handshakePromise;
  }

  /**
   * Schedules a reconnection attempt after an exponentially increasing delay.
   * Resets the delay to {@link RECONNECT_BASE_MS} on successful reconnection.
   */
  function scheduleReconnect(): void {
    /**
     * Current backoff delay captured before being doubled for the next attempt.
     */
    const delay = state.reconnectDelay;
    state.reconnectDelay = Math.min(
      delay * RECONNECT_BACKOFF_FACTOR,
      RECONNECT_MAX_MS,
    );
    l.info(`reconnecting in ${delay}ms`,);
    globalThis.setTimeout(
      function attemptReconnect() {
        state.ws = new WebSocket(wsUrl,);
        state.ready = wireConnection();
        void (async function awaitReconnect(): Promise<void> {
          try {
            await state.ready;
            state.reconnectDelay = RECONNECT_BASE_MS;
            l.info('reconnected',);
          }
          catch (error) {
            l.error(`reconnect handshake failed: ${String(error,)}`,);
          }
        })();
      },
      delay,
    );
  }

  /**
   * Rejects all pending requests when the WebSocket connection closes,
   * then schedules a reconnection attempt with exponential backoff.
   */
  function handleClose(): void {
    /**
     * Rejection reason shared by every pending request so each caller sees the same close cause.
     */
    const closeError = new Error('WebSocket connection closed',);
    pending.forEach(function rejectPending(pendingRequest,): void {
      clearTimeout(pendingRequest.timeoutId,);
      pendingRequest.reject(closeError,);
    },);
    pending.clear();
    scheduleReconnect();
  }

  state.ready = wireConnection();

  return Object.freeze({
    /**
     * Root directory path reported by the server on connection.
     *
     * @returns current root directory
     */
    get rootDir(): string {
      return state.rootDir;
    },
    /**
     * Stable filesystem identifier reported by the server on connection.
     *
     * @returns current filesystem identifier
     */
    get fsId(): string {
      return state.fsId;
    },
    /**
     * Resolves when the WebSocket connection is established and authenticated.
     *
     * @returns current ready promise
     */
    get ready(): Promise<void> {
      return state.ready;
    },
    setFileChangedHandler,
    setDiagnosticsHandler,
    request,
    notify,
  },);
}
