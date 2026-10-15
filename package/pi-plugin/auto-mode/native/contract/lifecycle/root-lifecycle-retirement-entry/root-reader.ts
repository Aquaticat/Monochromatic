/**
 Preserve the original private-state readers and exact session-manager pairing.

 @module
 */
import type {
  AgentSession,
  SessionManager
} from '@earendil-works/pi-coding-agent';
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { RootLeaseOwnershipError } from './lifecycle.mjs';

/**
 Reading a root retains the original native objects without copying their capabilities.
 */
export type SessionRootReader = (input: {
  readonly session: AgentSession;
  readonly manager: SessionManager;
}) => object;

/**
 Bootstrap supplies native private-state readers rather than caller-authored identity labels.
 */
export type SessionRootReaderDefinition = {
  readonly readActiveSessionManager: (session: AgentSession) => SessionManager;
  readonly readManagerOccurrence: (manager: SessionManager) => object;
};

/**
 Diagnostics identify the ownership boundary without serializing native capabilities.
 */
const l = tagged({ tag: 'auto-mode-session-root-reader' });

//region Exact native identity precedes original occurrence access

/**
 Bind native SDK readers supplied by the trusted construction owner.

 @param readActiveSessionManager - original private-state reader authenticating the session

 @param readManagerOccurrence - original occurrence reader invoked only for the matched manager

 @returns reader retaining the original callbacks and their exact returned occurrence

 @throws RootLeaseOwnershipError when callbacks are missing or the manager differs

 @example
 ```ts
 const readRoot = createSessionRootReader(nativeReaders);
 const occurrence = readRoot({ session, manager });
 ```
 */
export function createSessionRootReader({
  readActiveSessionManager,
  readManagerOccurrence
}: SessionRootReaderDefinition): SessionRootReader {
  /**
   Construction and later reads share the original reader's diagnostic context.
   */
  const fl = tagged({
    tag: createSessionRootReader.name,
    l
  });
  fl.debug('capturing original native session and manager readers');
  if (((typeof readActiveSessionManager) !== 'function') || ((typeof readManagerOccurrence) !== 'function'))
    throw new RootLeaseOwnershipError('Native session and manager readers are required');
  /**
   Check the current native pairing before exposing its root occurrence.

   @param session - original session authenticated by native private state

   @param manager - exact manager expected by the construction owner

   @returns unchanged native root occurrence

   @throws RootLeaseOwnershipError when the original session reports another manager
   */
  return function readRootOccurrence({
    session,
    manager
  }): object {
    /**
     Each live identity read has its own diagnostic boundary.
     */
    const rl = tagged({
      tag: readRootOccurrence.name,
      l: fl
    });
    rl.debug('checking original native session-manager identity');
    if (readActiveSessionManager(session) !== manager)
      throw new RootLeaseOwnershipError('SDK session is not bound to this exact manager');
    rl.debug('reading matched native manager occurrence');
    return readManagerOccurrence(manager);
  };
}

//endregion Exact native identity precedes original occurrence access
