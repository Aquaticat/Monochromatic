/**
 Replays a recorded read set against new lifecycle facts.

 A read set holds when every read it recorded returns the same identities again:
 then a policy that reads only through its context sees exactly what it saw,
 and its recorded findings stand.

 @module
 */
import type {
  LazyPolicyGitFacts,
  PushUpdate,
} from '../api/context-types.ts';
import type {
  CandidateFile,
  TrackedFile,
} from '../api/policy-types.ts';
import {
  candidateIdentity,
  objectIdentity,
  type PolicyReadSet,
  pushUpdateIdentity,
  trackedIdentity,
} from './policy-read-set.ts';

/**
 Single-value reads of one pass, filled on first use.
 */
type ValidationMemo = {
  /**
   Candidate list.
   */
  candidates?: Promise<readonly CandidateFile[]>;
  /**
   Parent commit.
   */
  headOid?: ReturnType<LazyPolicyGitFacts['headOid']>;
  /**
   Landed commit.
   */
  landedCommitOid?: ReturnType<LazyPolicyGitFacts['landedCommitOid']>;
  /**
   Push updates.
   */
  pushUpdates?: Promise<readonly PushUpdate[]>;
};

/**
 Facts memoized for one pass, so validating several read sets reads each fact once.
 Only validation uses them; policies keep their own reads.

 @param facts - pass facts over one exact candidate state

 @returns memoizing view

 @example
 ```ts
 const validationFacts = memoizeValidationFacts(facts);
 ```
 */
export function memoizeValidationFacts(facts: LazyPolicyGitFacts,): LazyPolicyGitFacts {
  /**
   `trackedFiles` results by request.
   */
  const tracked = new Map<string, Promise<readonly TrackedFile[]>>();
  /**
   Memoized single-value reads, filled on first use.
   */
  const once: ValidationMemo = {};
  return {
    candidates: function candidates() {
      once.candidates ??= facts.candidates();
      return once.candidates;
    },
    trackedFiles: function trackedFiles({ pathspecs, },) {
      /**
       Request key.
       */
      const key = JSON.stringify(pathspecs,);
      /**
       Earlier result of the same request.
       */
      const earlier = tracked.get(key,);
      if (earlier !== undefined)
        return earlier;
      /**
       First result of this request.
       */
      const loaded = facts.trackedFiles({ pathspecs, },);
      tracked.set(
        key,
        loaded,
      );
      return loaded;
    },
    headOid: function headOid() {
      once.headOid ??= facts.headOid();
      return once.headOid;
    },
    landedCommitOid: function landedCommitOid() {
      once.landedCommitOid ??= facts.landedCommitOid();
      return once.landedCommitOid;
    },
    pushUpdates: function pushUpdates() {
      once.pushUpdates ??= facts.pushUpdates();
      return once.pushUpdates;
    },
  };
}

/**
 Whether two identity values serialize identically.

 @param recorded - recorded identity

 @param current - identity read now

 @returns whether they match

 @example
 ```ts
 sameIdentity({ recorded: ['a'], current: ['a'] }); // true
 ```
 */
function sameIdentity({
  recorded,
  current,
}: Readonly<{
  recorded: unknown;
  current: unknown;
}>,): boolean {
  return JSON.stringify(recorded,) === JSON.stringify(current,);
}

/**
 Whether every tracked-files request returns the same entries again.

 @param readSet - recorded reads

 @param facts - new facts

 @returns whether every request matches

 @example
 ```ts
 await trackedFilesHold({ readSet, facts });
 ```
 */
async function trackedFilesHold({
  readSet,
  facts,
}: Readonly<{
  readSet: PolicyReadSet;
  facts: LazyPolicyGitFacts;
}>,): Promise<boolean> {
  /**
   Each request's match.
   */
  const matches = await Promise.all(readSet.trackedFiles
    .map(async function requestHolds(request,): Promise<boolean> {
      return sameIdentity({
        recorded: request.entries,
        current: (await facts.trackedFiles({ pathspecs: request.pathspecs, },)).map(trackedIdentity,),
      },);
    },),);
  return matches.every(Boolean,);
}

/**
 Whether a recorded scalar read returns the same identity again.

 @param recorded - recorded identity, absent when the policy never read it

 @param read - reads the current value

 @param identify - converts the current value to its identity

 @returns whether the read was not recorded or matches

 @example
 ```ts
 await readHolds({ recorded: readSet.headOid, read: facts.headOid, identify: objectIdentity });
 ```
 */
async function readHolds<const Value>({
  recorded,
  read,
  identify,
}: Readonly<{
  recorded: unknown;
  read: () => Promise<Value>;
  identify: (value: Value) => unknown;
}>,): Promise<boolean> {
  if (recorded === undefined)
    return true;
  return sameIdentity({
    recorded,
    current: identify(await read(),),
  },);
}

/**
 Whether a recorded read set holds against new facts.

 @param readSet - recorded reads

 @param facts - facts of the new candidate state, ideally {@link memoizeValidationFacts}

 @returns whether every recorded read returns the same identities; false for an unreplayable set

 @example
 ```ts
 await readSetHolds({ readSet, facts: memoizeValidationFacts(facts) });
 ```
 */
export async function readSetHolds({
  readSet,
  facts,
}: Readonly<{
  readSet: PolicyReadSet;
  facts: LazyPolicyGitFacts;
}>,): Promise<boolean> {
  if (!readSet.replayable)
    return false;
  /**
   Each recorded read's match.
   */
  const matches = await Promise.all([
    readHolds({
      recorded: readSet.candidates,
      read: facts.candidates,
      identify: function identifyCandidates(files: readonly CandidateFile[],): unknown {
        return files.map(candidateIdentity,);
      },
    },),
    readHolds({
      recorded: readSet.headOid,
      read: facts.headOid,
      identify: objectIdentity,
    },),
    readHolds({
      recorded: readSet.landedCommitOid,
      read: facts.landedCommitOid,
      identify: objectIdentity,
    },),
    readHolds({
      recorded: readSet.pushUpdates,
      read: facts.pushUpdates,
      identify: function identifyUpdates(updates: readonly PushUpdate[],): unknown {
        return updates.map(pushUpdateIdentity,);
      },
    },),
    trackedFilesHold({
      readSet,
      facts,
    },),
  ],);
  return matches.every(Boolean,);
}
