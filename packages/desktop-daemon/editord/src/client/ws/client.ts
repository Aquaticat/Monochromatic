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
  Diagnostic,
  FsChangeType,
  RequestResponseMap,
  ServerMessage,
} from '../../../protocol.ts';
import {
  l as rootLogger,
  tagged,
} from '../log.ts';
import { performHandshake, } from './handshake.ts';

/** Tagged logger for the WebSocket client subsystem. */
const l = tagged({
  tag: 'ws',
  l: rootLogger,
},);

//region Pending request tracking

/** Pending request awaiting a server response. */
type PendingRequest = {
  resolve: (message: ServerMessage,) => void;
  reject: (error: Error,) => void;
  /** Timeout handle that rejects the request after {@link REQUEST_TIMEOUT_MS}. */
  timeoutId: number;
};

/** Maximum time to wait for a server response before rejecting (milliseconds). */
const REQUEST_TIMEOUT_MS = 30_000;

//endregion Pending request tracking

//region Reconnect constants

/** Initial delay before the first reconnection attempt (milliseconds). */
const RECONNECT_BASE_MS = 1_000;

/** Maximum delay between reconnection attempts (milliseconds). */
const RECONNECT_MAX_MS = 16_000;

/** Multiplier applied to the reconnect delay after each failed attempt. */
const RECONNECT_BACKOFF_FACTOR = 2;

//endregion Reconnect constants

/**
 * Typed WebSocket client for editord communication.
 *
 * Connects to the editord WebSocket endpoint with token authentication,
 * provides `request()` for correlated request/response pairs, and
 * invokes `onFileChanged` for server push notifications.
 * Pending requests are automatically rejected when the connection closes.
 * Reconnects automatically with exponential backoff when the connection drops.
 */
export class EditorWsClient {
  /** Underlying WebSocket connection. */
  #ws: WebSocket;

  /** Map of pending requests keyed by request ID. */
  readonly #pending = new Map<string, PendingRequest>();

  /** Counter for generating unique request IDs. */
  #nextId = 0;

  /** Root directory path reported by the server on connection. */
  rootDir = '';

  /** Stable filesystem identifier reported by the server on connection. */
  fsId = '';

  /** Callback invoked when the server pushes a file change notification. */
  onFileChanged:
    | ((
      event: {
        path: string;
        changeType: FsChangeType;
        isDirectory: boolean;
      },
    ) => void)
    | null = null;

  /** Callback invoked when the server pushes diagnostics for a file. */
  onDiagnostics: ((event: {
    path: string;
    diagnostics: Diagnostic[];
  },) => void) | null = null;

  /** Resolves when the WebSocket connection is established and authenticated. */
  ready: Promise<void>;

  /** WebSocket URL for reconnection. */
  readonly #wsUrl: string;

  /** Current reconnect delay in milliseconds; reset on successful connection. */
  #reconnectDelay = RECONNECT_BASE_MS;

  /**
   * Creates a new WebSocket client and connects to editord.
   *
   * @param port - server port number
   *
   * @param token - authentication token
   */
  constructor({
    port,
    token,
  }: {
    port: string;
    token: string;
  },) {
    this.#wsUrl = `ws://localhost:${port}/_ws?token=${token}`;
    this.#ws = new WebSocket(this.#wsUrl,);
    this.ready = this.#wireConnection();
  }

  /** Wires message, close, and handshake handlers onto the current WebSocket. */
  #wireConnection(): Promise<void> {
    /** Handshake promise returned to the caller so `ready` resolves once authenticated. */
    const handshakePromise = this.#performHandshake();
    this.#ws.addEventListener(
      'message',
      this.#handleMessage.bind(this,),
    );
    this.#ws.addEventListener(
      'close',
      this.#handleClose.bind(this,),
    );
    return handshakePromise;
  }

  /** Performs the server handshake using the extracted handshake module. */
  #performHandshake(): Promise<void> {
    /** Captured `this` so the handshake callback can mutate instance fields without `this` rebinding. */
    const client = this;
    return performHandshake({
      ws: this.#ws,
      onConnected: function setFields({
        rootDir,
        fsId,
      },) {
        client.rootDir = rootDir;
        client.fsId = fsId;
      },
    },);
  }

  /**
   * Sends a typed request and waits for the correlated response.
   *
   * Return type narrows by request discriminant via {@link RequestResponseMap},
   * so callers receive the matching success-side ServerMessage variant directly
   * without manual narrowing. Error responses reject the promise rather than
   * resolving with an error variant.
   *
   * @param message - client message (without `id`; it is auto-generated)
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
  async request<TReq extends ClientRequest,>(
    message: TReq,
  ): Promise<RequestResponseMap[TReq['type']]> {
    await this.ready;

    /** Monotonically increasing correlation ID assigned to this request. */
    const id = String(this.#nextId++,);
    /** Request payload with the generated `id` attached for server correlation. */
    const fullMessage = {
      ...message,
      id,
    };
    /** Local alias for the pending-request map so the inner Promise executor closes over it without `this`. */
    const pending = this.#pending;

    /* oxlint-disable eslint-plugin-promise/avoid-new -- pending request tracking requires storing resolve/reject callbacks in a map */
    /** Promise that resolves with the matching response or rejects on timeout/close. */
    const responsePromise = new Promise<ServerMessage>(
      function awaitResponse(
        resolve,
        reject,
      ) {
        /* oxlint-disable typescript-eslint/no-unsafe-type-assertion -- globalThis.setTimeout returns NodeJS.Timeout when Node types loaded */
        /** Timer handle stored on the pending entry so the response handler can cancel it. */
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

    this.#ws.send(JSON.stringify(fullMessage,),);
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- wire correlation by id guarantees resolved value is the success-side variant matching TReq['type']; error variants reject through #handleMessage
    return responsePromise as Promise<RequestResponseMap[TReq['type']]>;
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
    if (data.type === 'connected')
      return;

    // Push notifications: no request ID
    if (data.type === 'fileChanged') {
      this.onFileChanged?.({
        path: data.path,
        changeType: data.changeType,
        isDirectory: data.isDirectory,
      },);
      return;
    }
    if (data.type === 'diagnostics') {
      this.onDiagnostics?.({
        path: data.path,
        diagnostics: data.diagnostics,
      },);
      return;
    }

    // Correlated response
    if ('id' in data) {
      /** Tracked request matching this response's `id`, or undefined if it already timed out. */
      const pending = this.#pending.get(data.id,);
      if (pending !== undefined) {
        this.#pending.delete(data.id,);
        clearTimeout(pending.timeoutId,);
        if (data.type === 'error')
          pending.reject(new Error(data.message,),);
        else
          pending.resolve(data,);
      }
    }
  }

  /**
   * Rejects all pending requests when the WebSocket connection closes,
   * then schedules a reconnection attempt with exponential backoff.
   */
  #handleClose(): void {
    /** Rejection reason shared by every pending request so each caller sees the same close cause. */
    const closeError = new Error('WebSocket connection closed',);
    for (const [, pending,] of this.#pending) {
      clearTimeout(pending.timeoutId,);
      pending.reject(closeError,);
    }
    this.#pending.clear();
    this.#scheduleReconnect();
  }

  /**
   * Schedules a reconnection attempt after an exponentially increasing delay.
   * Resets the delay to {@link RECONNECT_BASE_MS} on successful reconnection.
   */
  #scheduleReconnect(): void {
    /** Current backoff delay captured before being doubled for the next attempt. */
    const delay = this.#reconnectDelay;
    this.#reconnectDelay = Math.min(
      delay * RECONNECT_BACKOFF_FACTOR,
      RECONNECT_MAX_MS,
    );
    l.info(`reconnecting in ${delay}ms`,);
    /** Captured `this` so the timer callback can replace WebSocket/ready fields without `this` rebinding. */
    const client = this;
    globalThis.setTimeout(
      function attemptReconnect() {
        client.#ws = new WebSocket(client.#wsUrl,);
        client.ready = client.#wireConnection();
        void (async function awaitReconnect(): Promise<void> {
          try {
            await client.ready;
            client.#reconnectDelay = RECONNECT_BASE_MS;
            l.info('reconnected',);
          }
          catch {
            l.error('reconnect handshake failed',);
          }
        })();
      },
      delay,
    );
  }
}
