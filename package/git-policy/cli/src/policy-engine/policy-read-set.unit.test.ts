/**
 Per-policy read recording and read-set replay against new facts.

 @module
 */
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  ABSENT_GIT_VALUE,
  internalTestExports,
} from '../../dist/final/node/index.mjs';
import {
  fakeFacts,
  fakeOid,
  type FakeState,
} from './policy-read-fixture.unit.test.ts';

const {
  memoizeValidationFacts,
  readSetHolds,
  recordPolicyReads,
} = internalTestExports;

/**
 Base state with two candidates and one tracked manifest.
 */
const BASE: FakeState = {
  candidates: [
    { path: 'a.txt', content: 'a', },
    { path: 'gone.txt', content: '', change: 'deleted', },
  ],
  tracked: [{ path: 'pkg/package.json', content: '{}', },],
  head: 'base',
};

await describe({
  name: '',
  children: [
    describe({
      name: recordPolicyReads.name,
      children: [
        it({
          name: 'records nothing for a policy that reads nothing',
          fn: async function testEmpty(): Promise<void> {
            /** Recorder over base facts. */
            const recorder = recordPolicyReads(fakeFacts(BASE,).facts,);
            expect(recorder.finish(),).toEqual({ bytesPaths: [], trackedFiles: [], replayable: true, },);
          },
        },),
        it({
          name: 'records the candidate list with identities, and only the paths whose bytes ran',
          fn: async function testCandidates(): Promise<void> {
            /** Recorder over base facts. */
            const recorder = recordPolicyReads(fakeFacts(BASE,).facts,);
            /** Candidates through the recorder. */
            const candidates = await recorder.facts.candidates();
            await candidates[0]?.bytes();
            expect(recorder.finish(),).toEqual({
              candidates: [
                { path: 'a.txt', mode: 'regular', change: 'modified', revision: fakeOid('a',), },
                { path: 'gone.txt', mode: 'regular', change: 'deleted', revision: 'absent', },
              ],
              bytesPaths: ['a.txt',],
              trackedFiles: [],
              replayable: true,
            },);
          },
        },),
        it({
          name: 'records each trackedFiles request with its entries, and headOid',
          fn: async function testTrackedAndHead(): Promise<void> {
            /** Recorder over base facts. */
            const recorder = recordPolicyReads(fakeFacts(BASE,).facts,);
            await recorder.facts.trackedFiles({ pathspecs: ['pkg/',], },);
            await recorder.facts.headOid();
            expect(recorder.finish(),).toEqual({
              bytesPaths: [],
              trackedFiles: [{
                pathspecs: ['pkg/',],
                entries: [{ path: 'pkg/package.json', mode: 'regular', revision: fakeOid('{}',), headRevision: fakeOid('{}@base',), },],
              },],
              headOid: 'base',
              replayable: true,
            },);
          },
        },),
        it({
          name: 'records landedCommitOid and pushUpdates when read',
          fn: async function testScalars(): Promise<void> {
            /** Recorder over base facts. */
            const recorder = recordPolicyReads(fakeFacts(BASE,).facts,);
            await recorder.facts.landedCommitOid();
            await recorder.facts.pushUpdates();
            expect(recorder.finish(),).toMatchObject({ landedCommitOid: 'absent', pushUpdates: [], },);
          },
        },),
        it({
          name: 'records per policy even when both read through shared memoized facts',
          fn: async function testShared(): Promise<void> {
            /** Shared facts and their counts. */
            const { facts, counts, } = fakeFacts(BASE,);
            /** Memoized shared view. */
            const shared = memoizeValidationFacts(facts,);
            /** First policy's recorder. */
            const first = recordPolicyReads(shared,);
            /** Second policy's recorder. */
            const second = recordPolicyReads(shared,);
            await first.facts.candidates();
            await second.facts.candidates();
            await second.facts.headOid();
            expect(counts.candidates,).toBe(1,);
            expect(first.finish().candidates,).toHaveLength(2,);
            expect(first.finish().headOid,).toBeUndefined();
            expect(second.finish(),).toMatchObject({ headOid: 'base', },);
            expect(second.finish().candidates,).toHaveLength(2,);
          },
        },),
        it({
          name: 'stops recording at completion, so a later read is not part of the set',
          fn: async function testStops(): Promise<void> {
            /** Recorder over base facts. */
            const recorder = recordPolicyReads(fakeFacts(BASE,).facts,);
            /** Candidates read while running. */
            const candidates = await recorder.facts.candidates();
            /** Set at completion. */
            const readSet = recorder.finish();
            await candidates[0]?.bytes();
            await recorder.facts.headOid();
            await recorder.facts.trackedFiles({ pathspecs: ['pkg/',], },);
            expect(readSet.bytesPaths,).toEqual([],);
            expect(recorder.finish(),).toEqual(readSet,);
          },
        },),
        it({
          name: 'marks the set unreplayable when a read fails or a candidate has no content identity',
          fn: async function testUnreplayable(): Promise<void> {
            /** Base facts. */
            const { facts, } = fakeFacts(BASE,);
            /** Recorder over failing headOid. */
            const failing = recordPolicyReads({
              ...facts,
              headOid: async function headOid(): Promise<string> {
                throw new Error('no head',);
              },
            },);
            try {
              await failing.facts.headOid();
            }
            catch (error: unknown) {
              expect(String(error,),).toContain('no head',);
            }
            expect(failing.finish().replayable,).toBe(false,);
            /** Recorder over a mutable candidate without an object ID. */
            const mutable = recordPolicyReads({
              ...facts,
              candidates: async function candidates() {
                return (await facts.candidates()).map(function unpinned(candidate,) {
                  return { ...candidate, revision: ABSENT_GIT_VALUE, };
                },);
              },
            },);
            await mutable.facts.candidates();
            expect(mutable.finish().replayable,).toBe(false,);
          },
        },),
      ],
    },),
    describe({
      name: readSetHolds.name,
      children: [
        it({
          name: 'holds against identical facts and for an empty set',
          fn: async function testHolds(): Promise<void> {
            /** Recorder over base facts. */
            const recorder = recordPolicyReads(fakeFacts(BASE,).facts,);
            await recorder.facts.candidates();
            await recorder.facts.trackedFiles({ pathspecs: ['pkg/',], },);
            await recorder.facts.headOid();
            expect(await readSetHolds({ readSet: recorder.finish(), facts: fakeFacts(BASE,).facts, },),).toBe(true,);
            expect(await readSetHolds({ readSet: recordPolicyReads(fakeFacts(BASE,).facts,).finish(), facts: fakeFacts({ candidates: [], },).facts, },),).toBe(true,);
          },
        },),
        ...([
          ['candidate content', { ...BASE, candidates: [{ path: 'a.txt', content: 'changed', }, { path: 'gone.txt', content: '', change: 'deleted', },], },],
          ['candidate list', { ...BASE, candidates: [{ path: 'a.txt', content: 'a', },], },],
          ['candidate change kind', { ...BASE, candidates: [{ path: 'a.txt', content: 'a', change: 'added', }, { path: 'gone.txt', content: '', change: 'deleted', },], },],
          ['tracked entry', { ...BASE, tracked: [{ path: 'pkg/package.json', content: '{"v":2}', },], },],
          ['tracked entry at the parent', { ...BASE, head: 'moved', },],
        ] as const).map(function changedCase([label, state,]) {
          return it({
            name: `fails when the ${label} changed`,
            fn: async function testChanged(): Promise<void> {
              /** Recorder over base facts. */
              const recorder = recordPolicyReads(fakeFacts(BASE,).facts,);
              await recorder.facts.candidates();
              await recorder.facts.trackedFiles({ pathspecs: ['pkg/',], },);
              expect(await readSetHolds({ readSet: recorder.finish(), facts: fakeFacts(state,).facts, },),).toBe(false,);
            },
          },);
        },),
        it({
          name: 'fails when the parent moved and the policy read headOid, and holds when it did not read it',
          fn: async function testHead(): Promise<void> {
            /** Recorder reading the parent. */
            const reader = recordPolicyReads(fakeFacts(BASE,).facts,);
            await reader.facts.headOid();
            expect(await readSetHolds({ readSet: reader.finish(), facts: fakeFacts({ ...BASE, head: 'moved', },).facts, },),).toBe(false,);
            /** Recorder reading only candidates. */
            const other = recordPolicyReads(fakeFacts(BASE,).facts,);
            await other.facts.candidates();
            expect(await readSetHolds({ readSet: other.finish(), facts: fakeFacts({ ...BASE, head: 'moved', },).facts, },),).toBe(true,);
          },
        },),
        it({
          name: 'never holds for an unreplayable set',
          fn: async function testUnreplayableNeverHolds(): Promise<void> {
            expect(await readSetHolds({ readSet: { bytesPaths: [], trackedFiles: [], replayable: false, }, facts: fakeFacts(BASE,).facts, },),).toBe(false,);
          },
        },),
        it({
          name: 'memoized validation facts read each fact once per pass',
          fn: async function testMemo(): Promise<void> {
            /** Recorder over base facts. */
            const recorder = recordPolicyReads(fakeFacts(BASE,).facts,);
            await recorder.facts.candidates();
            await recorder.facts.trackedFiles({ pathspecs: ['pkg/',], },);
            await recorder.facts.headOid();
            /** Set at completion. */
            const readSet = recorder.finish();
            /** Counted facts of the new state. */
            const { facts, counts, } = fakeFacts(BASE,);
            /** Memoized view. */
            const memoized = memoizeValidationFacts(facts,);
            await readSetHolds({ readSet, facts: memoized, },);
            await readSetHolds({ readSet, facts: memoized, },);
            expect(counts,).toEqual({ candidates: 1, trackedFiles: 1, headOid: 1, bytes: 0, },);
          },
        },),
      ],
    },),
  ],
},);
