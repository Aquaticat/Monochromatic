/**
 Concurrent-commit JSONL events:
 lost landing races,
 replays,
 headers a signed replay dropped,
 and the replay-conflict core finding.

 They are additive under schema version 1;
 consumers ignore event types they do not know.

 @module
 */
import type { RepositoryPath, } from '../api/policy-types.ts';
import {
  type CoreFindingEvent,
  createCoreFindingEvent,
  type PolicyEvent,
} from './events.ts';

/**
 JSONL schema version.
 */
const SCHEMA_VERSION = 1;

/**
 A landing found the target ref moved.

 @example
 ```ts
 const event: LandingRaceLostEvent = { schemaVersion: 1, sequence: 0, type: 'landing-race-lost', attempt: 1, winningOid: 'abc' };
 ```
 */
export type LandingRaceLostEvent = {
  /**
   Schema version.
   */
  schemaVersion: 1;
  /**
   Invocation-local sequence.
   */
  sequence: number;
  /**
   Event discriminator.
   */
  type: 'landing-race-lost';
  /**
   Policy identifier is absent for transaction events.
   */
  policyId?: never;
  /**
   This transaction's lost races so far, from `1`.
   */
  attempt: number;
  /**
   Target value that won.
   */
  winningOid: string;
};

/**
 A prepared commit was replayed onto the moved target.

 @example
 ```ts
 const event: CommitReplayedEvent = { schemaVersion: 1, sequence: 1, type: 'commit-replayed', preparedOid: 'abc', fromBase: 'def', onto: '123', oid: '456' };
 ```
 */
export type CommitReplayedEvent = {
  /**
   Schema version.
   */
  schemaVersion: 1;
  /**
   Invocation-local sequence.
   */
  sequence: number;
  /**
   Event discriminator.
   */
  type: 'commit-replayed';
  /**
   Policy identifier is absent for transaction events.
   */
  policyId?: never;
  /**
   Prepared commit.
   */
  preparedOid: string;
  /**
   Preparation base, absent when the branch was unborn at preparation.
   */
  fromBase?: string;
  /**
   Target value the replay used as parent.
   */
  onto: string;
  /**
   Replayed commit after revalidation, the commit the next landing attempt lands.
   */
  oid: string;
};

/**
 Custom headers a signed replay dropped.

 @example
 ```ts
 const event: ReplayHeadersDroppedEvent = { schemaVersion: 1, sequence: 2, type: 'replay-headers-dropped', preparedOid: 'abc', oid: '456', headers: ['x-custom'], message: 'Dropped x-custom.' };
 ```
 */
export type ReplayHeadersDroppedEvent = {
  /**
   Schema version.
   */
  schemaVersion: 1;
  /**
   Invocation-local sequence.
   */
  sequence: number;
  /**
   Event discriminator.
   */
  type: 'replay-headers-dropped';
  /**
   Policy identifier is absent for transaction events.
   */
  policyId?: never;
  /**
   Prepared commit carrying the headers.
   */
  preparedOid: string;
  /**
   Re-signed commit lacking them.
   */
  oid: string;
  /**
   Dropped header names in prepared-commit order, each once.
   */
  headers: readonly string[];
  /**
   Human-readable warning.
   */
  message: string;
};

/**
 Creates a lost-race event.

 @param sequence - invocation-local event order

 @param attempt - lost races so far

 @param winningOid - target value that won

 @returns fresh event

 @example
 ```ts
 createLandingRaceLostEvent({ sequence: 0, attempt: 1, winningOid: 'abc' });
 ```
 */
export function createLandingRaceLostEvent({
  sequence,
  attempt,
  winningOid,
}: Readonly<Omit<LandingRaceLostEvent, 'schemaVersion' | 'type'>>,): LandingRaceLostEvent {
  return {
    schemaVersion: SCHEMA_VERSION,
    sequence,
    type: 'landing-race-lost',
    attempt,
    winningOid,
  };
}

/**
 Creates a replay event.

 @param sequence - invocation-local event order

 @param preparedOid - prepared commit

 @param fromBase - preparation base, absent when unborn

 @param onto - new parent

 @param oid - replayed commit

 @returns fresh event

 @example
 ```ts
 createCommitReplayedEvent({ sequence: 1, preparedOid: 'abc', onto: '123', oid: '456' });
 ```
 */
export function createCommitReplayedEvent({
  sequence,
  preparedOid,
  fromBase,
  onto,
  oid,
}: Readonly<Omit<CommitReplayedEvent, 'schemaVersion' | 'type'>>,): CommitReplayedEvent {
  return {
    schemaVersion: SCHEMA_VERSION,
    sequence,
    type: 'commit-replayed',
    preparedOid,
    ...(fromBase === undefined ? {} : { fromBase, }),
    onto,
    oid,
  };
}

/**
 Creates the dropped-headers warning of a signed replay.

 @param sequence - invocation-local event order

 @param preparedOid - prepared commit

 @param oid - re-signed commit

 @param headers - dropped header names

 @returns fresh event

 @example
 ```ts
 createReplayHeadersDroppedEvent({ sequence: 2, preparedOid: 'abc', oid: '456', headers: ['x-custom'] });
 ```
 */
export function createReplayHeadersDroppedEvent({
  sequence,
  preparedOid,
  oid,
  headers,
}: Readonly<Omit<ReplayHeadersDroppedEvent, 'schemaVersion' | 'type' | 'message'>>,): ReplayHeadersDroppedEvent {
  return {
    schemaVersion: SCHEMA_VERSION,
    sequence,
    type: 'replay-headers-dropped',
    preparedOid,
    oid,
    headers,
    message: `Replaying signed commit ${preparedOid} as ${oid} dropped its ${headers.join(', ',)} header${headers.length === 1 ? '' : 's'}, because Git can re-sign only the headers git commit-tree writes.`,
  };
}

/**
 Creates the replay-conflict core finding.

 @param sequence - invocation-local event order

 @param paths - conflicting paths in Git path byte order

 @param winningOid - earliest target commit touching a conflicting path

 @param preparedOid - prepared commit kept for cherry-picking

 @param targetRef - ref the commit targeted

 @returns core finding

 @example
 ```ts
 createReplayConflictEvent({ sequence: 0, paths: ['a.txt'], winningOid: 'abc', preparedOid: 'def', targetRef: 'refs/heads/main' });
 ```
 */
export function createReplayConflictEvent({
  sequence,
  paths,
  winningOid,
  preparedOid,
  targetRef,
}: Readonly<{
  sequence: number;
  paths: readonly RepositoryPath[];
  winningOid: string;
  preparedOid: string;
  targetRef: string;
}>,): CoreFindingEvent {
  return {
    ...createCoreFindingEvent({
      sequence,
      coreId: 'concurrent-commit',
      code: 'replay-conflict',
      message: `${targetRef} moved while this commit was prepared, and replaying it conflicts with ${winningOid} in ${paths.join(', ',)}; nothing landed. The prepared commit ${preparedOid} stays in the object store until gc expires it: resolve with git cherry-pick ${preparedOid}.`,
    },),
    paths,
    winningOid,
    preparedOid,
  };
}

/**
 Appends events after existing ones, renumbering their sequences to follow.

 @param events - existing ordered events

 @param appended - events to append; their sequences are replaced

 @returns combined ordered events

 @example
 ```ts
 appendEvents({ events: pass.events, appended: [event] });
 ```
 */
export function appendEvents({
  events,
  appended,
}: Readonly<{
  events: readonly PolicyEvent[];
  appended: readonly PolicyEvent[];
}>,): readonly PolicyEvent[] {
  return [
    ...events,
    ...appended.map(function renumber(
      event,
      index,
    ): PolicyEvent {
      return {
        ...event,
        sequence: events.length + index,
      };
    },),
  ];
}
