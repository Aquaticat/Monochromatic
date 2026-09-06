import {
  addAbortListener,
  on,
} from 'node:events';
import {
  Socket,
  type Server,
} from 'node:net';

import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { HelperProtocolError, } from './helper-protocol.ts';

//region Constants

/**
 Milliseconds allowed for detached helper to authenticate after terminal launch.
 */
const HELPER_CONNECT_TIMEOUT_MS = 30_000;

/**
 Bytes in one kibibyte.
 */
const BYTES_PER_KIBIBYTE = 1_024;

/**
 Protocol kibibytes allowed for authentication and completion metadata.
 */
const MAX_PROTOCOL_KIBIBYTES = 16;

/**
 Byte cap for authentication and completion metadata.
 */
export const MAX_PROTOCOL_BYTES = MAX_PROTOCOL_KIBIBYTES * BYTES_PER_KIBIBYTE;

/**
 Domain sentinel for candidate connection with wrong token.
 */
const AUTHENTICATION_REJECTED: unique symbol = Symbol('ask-user-question/helper-authentication-rejected',);

//endregion Constants

//region Logger

/**
 Tagged logger for helper authentication.
 */
const l = tagged({ tag: 'ask-user-question:answer-channel-auth', },);

//endregion Logger

//region Types

/**
 Authenticated socket plus already-read completion bytes.
 */
export type AuthenticatedSocket = {
  /**
   Connected helper socket.
   */
  readonly socket: Socket;
  /**
   Iterator continuing after authentication frame.
   */
  readonly iterator: AsyncIterator<string>;
  /**
   Completion bytes received in same chunk as token line.
   */
  readonly remainder: string;
};

//endregion Types

//region Authentication

/**
 Accepts connections until one presents expected token before startup deadline.
 
 @param server - loopback listener
 
 @param token - expected per-request authentication token
 
 @param signal - optional tool cancellation signal
 
 @returns authenticated socket positioned after token line
 
 @throws when startup deadline or tool cancellation aborts waiting
 
 @example
 ```ts
 await acceptAuthenticatedSocket({ server, token: 'private-token' });
 ```
 */
export async function acceptAuthenticatedSocket(
  {
    server,
    token,
    signal,
  }: {
    readonly server: Server;
    readonly token: string;
    readonly signal?: AbortSignal;
  },
): Promise<AuthenticatedSocket> {
  /**
   Startup-only deadline;
   authenticated editing has no timeout.
   */
  const deadlineSignal = AbortSignal.timeout(HELPER_CONNECT_TIMEOUT_MS,);
  /**
   Combined startup cancellation source.
   */
  const startupSignal = signal === undefined
    ? deadlineSignal
    : AbortSignal.any([
      signal,
      deadlineSignal,
    ],);
  for await (const connection of on(
    server,
    'connection',
    { signal: startupSignal, },
  )) {
    /**
     Runtime value narrowed to Node socket.
     */
    const socketValue: unknown = connection[0];
    if (!(socketValue instanceof Socket))
      throw new HelperProtocolError('Answer channel emitted a non-socket connection.',);
    /**
     Authentication outcome for candidate socket.
     */
    const authenticated = await authenticateSocket({
      socket: socketValue,
      token,
      signal: startupSignal,
    },);
    if ((typeof authenticated) !== 'symbol')
      return authenticated;
    if (authenticated !== AUTHENTICATION_REJECTED)
      throw new HelperProtocolError('Answer channel received an unknown authentication state.',);
    socketValue.destroy();
    l.warn('rejected unauthenticated answer helper connection',);
  }
  throw new HelperProtocolError('Answer channel stopped before helper authenticated.',);
}

/**
 Reads first newline-delimited token from candidate socket.
 
 @param socket - candidate local socket
 
 @param token - expected authentication token
 
 @param signal - startup cancellation signal
 
 @returns authenticated socket state or rejection sentinel
 */
async function authenticateSocket(
  {
    socket,
    token,
    signal,
  }: {
    readonly socket: Socket;
    readonly token: string;
    readonly signal: AbortSignal;
  },
): Promise<AuthenticatedSocket | typeof AUTHENTICATION_REJECTED> {
  socket.setEncoding('utf8',);
  /**
   Stream iterator retained for completion frame after authentication.
   */
  const iterator = socket[Symbol.asyncIterator]() as AsyncIterator<string>;
  /**
   Token-line accumulation state and loop gate.
   */
  const state = {
    text: '',
    reading: true,
  };
  /**
   Subscription closing candidate socket when startup aborts.
   */
  using abortSubscription = addAbortListener(
    signal,
    function abortAuthentication(): void {
      socket.destroy();
    },
  );
  while (state.reading) {
    /**
     Next decoded socket chunk.
     */
    // oxlint-disable-next-line eslint/no-await-in-loop -- Stream chunks are ordered and authentication line cannot be parallelized.
    const next = await iterator.next();
    signal.throwIfAborted();
    if (next.done === true) {
      state.reading = false;
      continue;
    }
    state.text += next.value;
    if (Buffer.byteLength(
      state.text,
      'utf8',
    ) > MAX_PROTOCOL_BYTES)
      throw new HelperProtocolError('Answer helper authentication exceeded protocol byte limit.',);
    /**
     Authentication-line delimiter position,
     or negative while line remains incomplete.
     */
    const newlineIndex = state.text
      .indexOf('\n',);
    if (newlineIndex === (-1))
      continue;
    /**
     Candidate token before delimiter.
     */
    const candidate = state.text
      .slice(
        0,
        newlineIndex,
      );
    if (candidate !== token)
      return AUTHENTICATION_REJECTED;
    return {
      socket,
      iterator,
      remainder: state.text
        .slice(newlineIndex + 1,),
    };
  }
  return AUTHENTICATION_REJECTED;
}

//endregion Authentication
