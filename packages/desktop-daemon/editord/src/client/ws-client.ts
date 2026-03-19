/**
 * WebSocket client for communicating with editord.
 *
 * Provides typed request/response messaging with automatic correlation
 * via client-generated request IDs.
 */

export {};

//region Message types

/** Messages sent from client to server. */
type ClientMessage =
  | { type: 'open'; id: string; path: string }
  | { type: 'save'; id: string; path: string; content: string }
  | { type: 'listDir'; id: string; path: string };

/** Messages received from server. */
type ServerMessage =
  | { type: 'connected'; rootDir: string }
  | { type: 'fileContent'; id: string; path: string; content: string }
  | { type: 'saved'; id: string; path: string }
  | { type: 'dirListing'; id: string; path: string; entries: { name: string; isDirectory: boolean }[] }
  | { type: 'fileChanged'; path: string }
  | { type: 'error'; id?: string; message: string };

//endregion Message types

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

  /** Callback invoked when the server pushes a file change notification. */
  onFileChanged: ((path: string,) => void) | null = null;

  /** Resolves when the WebSocket connection is established and authenticated. */
  readonly ready: Promise<void>;

  /**
   * Creates a new WebSocket client and connects to editord.
   *
   * @param port - server port number
   *
   * @param token - authentication token
   */
  constructor(port: string, token: string,) {
    const wsUrl = `ws://localhost:${port}/_ws?token=${token}`;
    this.#ws = new WebSocket(wsUrl,);

    this.ready = new Promise<void>(function awaitConnection(resolve, reject,) {
      /** Captured for closure access in the message handler. */
      const client = this;

      /** Assigned in constructor; available by the time the event fires. */
      // oxlint-disable-next-line typescript/no-use-before-define -- self-reference needed for cleanup
      const onMessage = function handleFirstMessage(event: MessageEvent,): void {
        try {
          const data = JSON.parse(String(event.data,),) as ServerMessage;
          if (data.type === 'connected') {
            client.rootDir = data.rootDir;
            resolve();
          }
          else if (data.type === 'error') {
            reject(new Error(data.message,),);
          }
        }
        catch {
          reject(new Error('invalid server handshake',),);
        }
      };
      // Temporary listener just for the handshake
      this.#ws.addEventListener('message', onMessage, { once: true, },);
      this.#ws.addEventListener('error', function handleError() {
        reject(new Error('WebSocket connection failed',),);
      }, { once: true, },);
    }.bind(this,),);

    this.#ws.addEventListener('message', this.#handleMessage.bind(this,),);
  }

  /**
   * Sends a typed request and waits for the correlated response.
   *
   * @param message - client message (without `id` — it is auto-generated)
   *
   * @returns server response message
   *
   * @throws {Error} when the server responds with an error
   */
  async request(message: Omit<ClientMessage, 'id'>,): Promise<ServerMessage> {
    await this.ready;

    const id = String(this.#nextId++,);
    const fullMessage = { ...message, id, };

    const responsePromise = new Promise<ServerMessage>(
      function awaitResponse(resolve, reject,) {
        this.#pending.set(id, { resolve, reject, },);
      }.bind(this,),
    );

    this.#ws.send(JSON.stringify(fullMessage,),);
    return responsePromise;
  }

  /**
   * Handles all incoming WebSocket messages after the initial handshake.
   * Routes responses to pending requests by ID, and dispatches push notifications.
   *
   * @param event - WebSocket message event
   */
  #handleMessage(event: MessageEvent,): void {
    let data: ServerMessage;
    try {
      data = JSON.parse(String(event.data,),) as ServerMessage;
    }
    catch {
      console.error('[ws] received invalid JSON',);
      return;
    }

    // Skip the initial 'connected' message (handled by ready promise)
    if (data.type === 'connected')
      return;

    // Push notification — no request ID
    if (data.type === 'fileChanged') {
      this.onFileChanged?.(data.path,);
      return;
    }

    // Correlated response
    if ('id' in data && data.id !== undefined) {
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
}
