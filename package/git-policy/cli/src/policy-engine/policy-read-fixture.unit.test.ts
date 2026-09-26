/**
 In-memory lazy Git facts for read-set, reuse, and engine tests.

 @module
 */
import type {
  CandidateFile,
  LazyPolicyGitFacts,
  PolicyDefinition,
  TrackedFile,
} from '../../dist/final/node/index.mjs';
import { ABSENT_GIT_VALUE, } from '../../dist/final/node/index.mjs';

/**
 UTF-8 encoder.
 */
const ENCODER = new TextEncoder();

/**
 One file of a fake candidate state.
 */
export type FakeFile = Readonly<{
  /**
   Repository path.
   */
  path: string;
  /**
   Content, which also names the fake object ID.
   */
  content: string;
  /**
   Change kind.
   */
  change?: CandidateFile['change'];
}>;

/**
 A fake candidate state.
 */
export type FakeState = Readonly<{
  /**
   Candidates.
   */
  candidates: readonly FakeFile[];
  /**
   Tracked files, which every pathspec request returns when their path starts with the pathspec.
   */
  tracked?: readonly FakeFile[];
  /**
   Parent commit.
   */
  head?: string;
}>;

/**
 Counts of delegated reads.
 */
export type ReadCounts = {
  /**
   `candidates()` calls.
   */
  candidates: number;
  /**
   `trackedFiles()` calls.
   */
  trackedFiles: number;
  /**
   `headOid()` calls.
   */
  headOid: number;
  /**
   `bytes()` calls.
   */
  bytes: number;
};

/**
 Fake object ID of content.

 @param content - content

 @returns object ID

 @example
 ```ts
 fakeOid('a'); // 'oid:a'
 ```
 */
export function fakeOid(content: string,): string {
  return `oid:${content}`;
}

/**
 Fake facts over one state, counting delegated reads.

 @param state - candidate state

 @returns facts and their read counts

 @example
 ```ts
 const { facts, counts } = fakeFacts({ candidates: [{ path: 'a', content: 'a' }] });
 ```
 */
export function fakeFacts(state: FakeState,): Readonly<{
  facts: LazyPolicyGitFacts;
  counts: ReadCounts;
}> {
  /**
   Read counts.
   */
  const counts: ReadCounts = {
    candidates: 0,
    trackedFiles: 0,
    headOid: 0,
    bytes: 0,
  };
  return {
    counts,
    facts: {
      candidates: async function candidates(): Promise<readonly CandidateFile[]> {
        counts.candidates += 1;
        return state.candidates
          .map(function toCandidate(file,): CandidateFile {
            return {
              targetId: `target:${file.path}`,
              path: file.path,
              revision: file.change === 'deleted' ? ABSENT_GIT_VALUE : fakeOid(file.content,),
              mode: 'regular',
              change: file.change ?? 'modified',
              bytes: async function bytes(): Promise<Uint8Array> {
                counts.bytes += 1;
                return ENCODER.encode(file.content,);
              },
            };
          },);
      },
      trackedFiles: async function trackedFiles({ pathspecs, },): Promise<readonly TrackedFile[]> {
        counts.trackedFiles += 1;
        return (state.tracked ?? [])
          .filter(function matches(file,): boolean {
            return pathspecs.some(function prefix(pathspec,): boolean {
              return file.path.startsWith(pathspec,);
            },);
          },)
          .map(function toTracked(file,): TrackedFile {
            return {
              targetId: `tracked:${file.path}`,
              path: file.path,
              revision: fakeOid(file.content,),
              mode: 'regular',
              headRevision: fakeOid(`${file.content}@${state.head ?? 'base'}`,),
              bytes: async function bytes(): Promise<Uint8Array> {
                return ENCODER.encode(file.content,);
              },
              headBytes: async function headBytes(): Promise<Uint8Array> {
                return ENCODER.encode(file.content,);
              },
            };
          },);
      },
      headOid: async function headOid(): Promise<string> {
        counts.headOid += 1;
        return state.head ?? 'base';
      },
      landedCommitOid: async function landedCommitOid(): Promise<typeof ABSENT_GIT_VALUE> {
        return ABSENT_GIT_VALUE;
      },
      pushUpdates: async function pushUpdates(): Promise<readonly never[]> {
        return [];
      },
    },
  };
}

/**
 A pre-forward test policy that counts its runs.

 @param name - policy name

 @param inputs - declared inputs, absent for unrestricted

 @param check - check body

 @param severity - default severity

 @returns policy and its run counter

 @example
 ```ts
 const { policy, runs } = countingPolicy({ name: 'p', check: async () => [] });
 ```
 */
export function countingPolicy({
  name,
  inputs,
  check,
  severity = 'warn',
}: Readonly<{
  name: string;
  severity?: PolicyDefinition['defaultSeverity'];
  inputs?: PolicyDefinition['inputs'];
  check: PolicyDefinition['check'];
}>,): Readonly<{
  policy: PolicyDefinition;
  runs: () => number;
}> {
  /**
   Runs so far.
   */
  const counter = { runs: 0, };
  return {
    runs: function runs(): number {
      return counter.runs;
    },
    policy: {
      name,
      defaultSeverity: severity,
      warnSafe: true,
      triggers: ['pre-forward',],
      ...(inputs === undefined ? {} : { inputs, }),
      check: async function countedCheck(input,) {
        counter.runs += 1;
        return await check(input,);
      },
    },
  };
}
