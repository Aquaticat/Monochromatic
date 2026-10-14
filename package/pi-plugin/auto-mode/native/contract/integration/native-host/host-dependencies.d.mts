/**
 Consumer signatures describe the original native factory without replacing its ownership checks.

 @module
 */
import type { SessionManager } from '@earendil-works/pi-coding-agent';
import type { NativeForwardedFunction } from '../native-batch/runtime-types.ts';
import type { NativeHostRegistration, NativeHostSessionFactory } from './host-types.ts';
import type { readSessionDisposalState } from './session-disposal.mjs';

export { SessionManager } from '@earendil-works/pi-coding-agent';

/**
 The original factory retains manager ownership, construction, and lifecycle publication.

 @param input - fixed constructor, original readers, and host registration callback

 @returns original session factory with its constructor and cleanup owners intact

 @throws Error when original native construction capabilities cannot be bound
 */
export function createRootSessionFactory(input: {
  readonly createAgentSession: NativeForwardedFunction;
  readonly SessionManager: typeof SessionManager;
  readonly readRootOccurrence: NativeForwardedFunction;
  readonly readActiveSessionManager: NativeForwardedFunction;
  readonly readSessionDisposalState: typeof readSessionDisposalState;
  readonly onSessionRegistered: (input: NativeHostRegistration) => void;
}): NativeHostSessionFactory;

/** Original generated SDK construction retains its private owner-scope input. */
export declare const createAgentSession: NativeForwardedFunction;
/** Original manager reader returns only its native occurrence. */
export declare const readRootOccurrence: NativeForwardedFunction;
/** Original session reader retains native private-field authentication. */
export declare const readActiveSessionManager: NativeForwardedFunction;
