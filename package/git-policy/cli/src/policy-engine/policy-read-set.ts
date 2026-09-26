/**
 Per-policy recording of lazy context reads.

 Each policy run gets its own `git` facts that delegate to the shared lifecycle facts,
 so memoization is unchanged,
 and remember what the policy read:
 the candidate list with each candidate's identity,
 the paths whose `bytes()` ran,
 each `trackedFiles` request with its result entries,
 and the scalar Git facts.
 Object IDs are the fingerprints,
 so no content is hashed.
 Recording stops when the policy completes;
 a read that settles later is not part of the set.

 @module
 */
import {
  ABSENT_GIT_VALUE,
  type AbsentGitValue,
  type LazyPolicyGitFacts,
  type PushUpdate,
} from '../api/context-types.ts';
import type {
  CandidateChange,
  CandidateFile,
  CandidateFileMode,
  GitObjectId,
  TrackedFile,
} from '../api/policy-types.ts';

/**
 Serializable stand-in for {@link ABSENT_GIT_VALUE}.
 */
export const ABSENT_IDENTITY = 'absent';

/**
 Object ID, or {@link ABSENT_IDENTITY}.
 */
export type ObjectIdentity = GitObjectId | typeof ABSENT_IDENTITY;

/**
 Identity of one candidate as a policy saw it.
 */
export type CandidateIdentity = Readonly<{
  /**
   Repository path.
   */
  path: string;
  /**
   Git file mode.
   */
  mode: CandidateFileMode;
  /**
   Change kind.
   */
  change: CandidateChange;
  /**
   Content object, absent for a deleted candidate.
   */
  revision: ObjectIdentity;
}>;

/**
 Identity of one tracked file as a policy saw it.
 */
export type TrackedIdentity = Readonly<{
  /**
   Repository path.
   */
  path: string;
  /**
   Git file mode.
   */
  mode: CandidateFileMode;
  /**
   Current content object.
   */
  revision: GitObjectId;
  /**
   Content object at the commit's parent.
   */
  headRevision: ObjectIdentity;
}>;

/**
 One `trackedFiles` request and what it returned.
 */
export type TrackedFilesRead = Readonly<{
  /**
   Requested pathspecs.
   */
  pathspecs: readonly string[];
  /**
   Returned entries in order.
   */
  entries: readonly TrackedIdentity[];
}>;

/**
 Identity of one push update.
 */
export type PushUpdateIdentity = Readonly<{
  /**
   Local object.
   */
  localOid: ObjectIdentity;
  /**
   Remote object.
   */
  remoteOid: ObjectIdentity;
  /**
   Remote name.
   */
  remoteName: string;
  /**
   Remote ref.
   */
  remoteRef: string;
}>;

/**
 Everything one completed policy run read through its context.
 A member is absent when the policy never read that fact.
 */
export type PolicyReadSet = Readonly<{
  /**
   Candidate list.
   */
  candidates?: readonly CandidateIdentity[];
  /**
   Candidate paths whose bytes were read, in first-read order.
   */
  bytesPaths: readonly string[];
  /**
   `trackedFiles` requests in order.
   */
  trackedFiles: readonly TrackedFilesRead[];
  /**
   Parent commit.
   */
  headOid?: ObjectIdentity;
  /**
   Landed commit.
   */
  landedCommitOid?: ObjectIdentity;
  /**
   Push updates.
   */
  pushUpdates?: readonly PushUpdateIdentity[];
  /**
   False when a read failed or returned content without an object identity,
   so the set cannot prove the policy would see the same thing again.
   */
  replayable: boolean;
}>;

/**
 A recording view of lifecycle facts for one policy run.
 */
export type PolicyReadRecorder = Readonly<{
  /**
   Facts handed to the policy.
   */
  facts: LazyPolicyGitFacts;
  /**
   Stops recording and returns what the policy read.
   */
  finish: () => PolicyReadSet;
}>;

/**
 Converts an optional object ID to its serializable identity.

 @param oid - object ID or absence sentinel

 @returns identity

 @example
 ```ts
 objectIdentity(ABSENT_GIT_VALUE); // 'absent'
 ```
 */
export function objectIdentity(oid: GitObjectId | AbsentGitValue,): ObjectIdentity {
  return oid === ABSENT_GIT_VALUE ? ABSENT_IDENTITY : oid;
}

/**
 Identity of one candidate.

 @param candidate - candidate

 @returns identity

 @example
 ```ts
 candidateIdentity(candidate);
 ```
 */
export function candidateIdentity(candidate: CandidateFile,): CandidateIdentity {
  return {
    path: candidate.path,
    mode: candidate.mode,
    change: candidate.change,
    revision: objectIdentity(candidate.revision,),
  };
}

/**
 Identity of one tracked file.

 @param file - tracked file

 @returns identity

 @example
 ```ts
 trackedIdentity(file);
 ```
 */
export function trackedIdentity(file: TrackedFile,): TrackedIdentity {
  return {
    path: file.path,
    mode: file.mode,
    revision: file.revision,
    headRevision: objectIdentity(file.headRevision,),
  };
}

/**
 Identity of one push update.

 @param update - push update

 @returns identity

 @example
 ```ts
 pushUpdateIdentity(update);
 ```
 */
export function pushUpdateIdentity(update: PushUpdate,): PushUpdateIdentity {
  return {
    localOid: objectIdentity(update.localOid,),
    remoteOid: objectIdentity(update.remoteOid,),
    remoteName: update.remoteName,
    remoteRef: update.remoteRef,
  };
}

/**
 Whether a candidate's content has an object identity:
 a deleted candidate has no content,
 and every other one needs its object ID.

 @param identity - candidate identity

 @returns whether the identity pins the content

 @example
 ```ts
 pinsContent({ path: 'a', mode: 'regular', change: 'modified', revision: 'abc' }); // true
 ```
 */
function pinsContent(identity: CandidateIdentity,): boolean {
  return (identity.change === 'deleted') || (identity.revision !== ABSENT_IDENTITY);
}

/**
 Mutable recording state of one policy run.
 */
type RecordingState = {
  /**
   Whether the policy is still running.
   */
  open: boolean;
  /**
   Whether every read so far can be replayed.
   */
  replayable: boolean;
  /**
   Candidate list, once read.
   */
  candidates?: readonly CandidateIdentity[];
  /**
   Paths whose bytes were read.
   */
  readonly bytesPaths: Set<string>;
  /**
   `trackedFiles` requests.
   */
  readonly trackedFiles: TrackedFilesRead[];
  /**
   Parent commit, once read.
   */
  headOid?: ObjectIdentity;
  /**
   Landed commit, once read.
   */
  landedCommitOid?: ObjectIdentity;
  /**
   Push updates, once read.
   */
  pushUpdates?: readonly PushUpdateIdentity[];
};

/**
 Awaits one delegated read, recording it while the policy runs and marking the set unreplayable when it fails.

 @param state - recording state

 @param read - delegated read

 @param remember - records the settled value

 @returns settled value

 @throws whatever the delegated read rejects with

 @example
 ```ts
 await recorded({ state, read: facts.headOid(), remember: (oid) => { state.headOid = objectIdentity(oid); } });
 ```
 */
async function recorded<const Value>({
  state,
  read,
  remember,
}: Readonly<{
  state: RecordingState;
  read: Promise<Value>;
  remember: (value: Value) => void;
}>,): Promise<Value> {
  try {
    /**
     Settled value.
     */
    const value = await read;
    if (state.open)
      remember(value,);
    return value;
  }
  catch (error: unknown) {
    if (state.open)
      state.replayable = false;
    throw error;
  }
}

/**
 Wraps a candidate so reading its bytes records the path.

 @param state - recording state

 @param candidate - delegated candidate

 @returns recording candidate

 @example
 ```ts
 recordingCandidate({ state, candidate });
 ```
 */
function recordingCandidate({
  state,
  candidate,
}: Readonly<{
  state: RecordingState;
  candidate: CandidateFile;
}>,): CandidateFile {
  return {
    ...candidate,
    bytes: async function bytes(): Promise<Uint8Array> {
      return await recorded({
        state,
        read: candidate.bytes(),
        remember: function rememberBytes(): void {
          state.bytesPaths
            .add(candidate.path,);
        },
      },);
    },
  };
}

/**
 Wraps lifecycle facts for one policy run.

 @param facts - shared lifecycle facts

 @returns recording facts and the call that ends recording

 @example
 ```ts
 const recorder = recordPolicyReads(facts);
 await policy.check({ context: { ...context, git: recorder.facts }, options });
 const readSet = recorder.finish();
 ```
 */
export function recordPolicyReads(facts: LazyPolicyGitFacts,): PolicyReadRecorder {
  /**
   Recording state of this run.
   */
  const state: RecordingState = {
    open: true,
    replayable: true,
    bytesPaths: new Set(),
    trackedFiles: [],
  };
  return {
    facts: {
      candidates: async function candidates(): Promise<readonly CandidateFile[]> {
        /**
         Delegated candidates.
         */
        const files = await recorded({
          state,
          read: facts.candidates(),
          remember: function rememberCandidates(value: readonly CandidateFile[],): void {
            /**
             Identities in list order.
             */
            const identities = value.map(candidateIdentity,);
            state.candidates = identities;
            if (!identities.every(pinsContent,))
              state.replayable = false;
          },
        },);
        return files.map(function wrap(candidate,): CandidateFile {
          return recordingCandidate({
            state,
            candidate,
          },);
        },);
      },
      trackedFiles: async function trackedFiles(request,): Promise<readonly TrackedFile[]> {
        /**
         Pathspecs copied before delegation, so a later caller mutation cannot change the record.
         */
        const pathspecs = [...request.pathspecs,];
        return await recorded({
          state,
          read: facts.trackedFiles({ pathspecs, },),
          remember: function rememberTracked(value: readonly TrackedFile[],): void {
            state.trackedFiles
              .push({
                pathspecs,
                entries: value.map(trackedIdentity,),
              },);
          },
        },);
      },
      headOid: async function headOid(): Promise<GitObjectId | AbsentGitValue> {
        return await recorded({
          state,
          read: facts.headOid(),
          remember: function rememberHead(value: GitObjectId | AbsentGitValue,): void {
            state.headOid = objectIdentity(value,);
          },
        },);
      },
      landedCommitOid: async function landedCommitOid(): Promise<GitObjectId | AbsentGitValue> {
        return await recorded({
          state,
          read: facts.landedCommitOid(),
          remember: function rememberLanded(value: GitObjectId | AbsentGitValue,): void {
            state.landedCommitOid = objectIdentity(value,);
          },
        },);
      },
      pushUpdates: async function pushUpdates(): Promise<readonly PushUpdate[]> {
        return await recorded({
          state,
          read: facts.pushUpdates(),
          remember: function rememberPush(value: readonly PushUpdate[],): void {
            state.pushUpdates = value.map(pushUpdateIdentity,);
          },
        },);
      },
    },
    finish: function finish(): PolicyReadSet {
      state.open = false;
      return {
        ...(state.candidates === undefined ? {} : { candidates: state.candidates, }),
        bytesPaths: [...state.bytesPaths,],
        trackedFiles: [...state.trackedFiles,],
        ...(state.headOid === undefined ? {} : { headOid: state.headOid, }),
        ...(state.landedCommitOid === undefined ? {} : { landedCommitOid: state.landedCommitOid, }),
        ...(state.pushUpdates === undefined ? {} : { pushUpdates: state.pushUpdates, }),
        replayable: state.replayable,
      };
    },
  };
}
