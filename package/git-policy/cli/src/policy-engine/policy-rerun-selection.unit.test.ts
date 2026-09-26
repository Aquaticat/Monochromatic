/**
 Skip-or-rerun decisions after a replay, and ordered engine passes that mix reused and re-run policies.

 @module
 */
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import * as v from 'valibot';
import {
  internalTestExports,
  type PolicyFinding,
  type PolicyInput,
} from '../../dist/final/node/index.mjs';
import {
  countingPolicy,
  fakeFacts,
  type FakeState,
} from './policy-read-fixture.unit.test.ts';

const {
  createPolicyRunLog,
  decideRerun,
  declaredPreForwardInputs,
  effectivePolicyInputs,
  policyInputKey,
  runPolicyEngine,
  validateConfig,
  withPolicyReadTracking,
} = internalTestExports;

/**
 Fingerprints of one phase.
 */
type Fingerprints = Parameters<typeof decideRerun>[0]['fingerprints'];

/**
 One fingerprint.
 */
type Fingerprint = Fingerprints extends ReadonlyMap<string, infer TValue> ? TValue : never;

/**
 A recorded run.
 */
type Run = Parameters<typeof decideRerun>[0]['runs'][number];

/**
 Unavailable fingerprint.
 */
const UNAVAILABLE: Fingerprint = internalTestExports.FINGERPRINT_UNAVAILABLE;

/**
 One input of each kind.
 */
const EVERY_KIND: readonly PolicyInput[] = [
  { kind: 'worktree', pathspecs: ['rules.txt',], },
  { kind: 'executable', path: 'scanner', },
  { kind: 'revision', rev: 'refs/remotes/origin/main', },
  { kind: 'env', name: 'RULES', },
];

/**
 Fingerprints of every kind, all `before`.
 */
const BEFORE: Fingerprints = new Map<string, Fingerprint>(EVERY_KIND.map(function before(input,) {
  return [policyInputKey(input,), 'before',] as const;
},),);

/**
 Recorded clean run of a policy.

 @param findings - recorded findings

 @param fingerprints - recorded fingerprints

 @returns run
 */
function recordedRun({
  findings = [],
  fingerprints = BEFORE,
}: Readonly<{
  findings?: readonly PolicyFinding[];
  fingerprints?: Fingerprints;
}> = {},): Run {
  return {
    policyId: 'probe/check',
    readSet: { bytesPaths: [], trackedFiles: [], replayable: true, },
    fingerprints,
    findings,
  };
}

/**
 Reads always hold.

 @returns true
 */
async function readsHold(): Promise<boolean> {
  return true;
}

/**
 Reads never hold.

 @returns false
 */
async function readsChanged(): Promise<boolean> {
  return false;
}

/**
 Policy reading every candidate's bytes, finding each one without a final `!`, and optionally proposing a fix.

 @param name - policy name

 @param inputs - declared inputs

 @param fix - whether to propose a patch

 @param severity - default severity

 @returns counting policy
 */
function bangPolicy({
  name,
  inputs,
  fix = false,
  severity = 'warn',
}: Readonly<{
  name: string;
  severity?: 'warn' | 'error';
  inputs?: 'unrestricted' | Readonly<{ external: readonly PolicyInput[]; }>;
  fix?: boolean;
}>,) {
  return countingPolicy({
    name,
    severity,
    ...(inputs === undefined ? {} : { inputs, }),
    check: async function check({ context, },) {
      /** Findings for candidates without a bang. */
      const findings: PolicyFinding[] = [];
      for (const candidate of await context.git.candidates()) {
        // oxlint-disable-next-line no-await-in-loop -- Sequential reads keep the fixture simple.
        const text = new TextDecoder().decode(await candidate.bytes(),);
        if (!text.endsWith('!',))
          findings.push({
            code: 'no-bang',
            message: `${candidate.path} lacks a bang`,
            path: candidate.path,
            ...(fix ? { patch: { kind: 'git-unified', targetId: candidate.targetId, path: candidate.path, bytes: new Uint8Array([1,],), }, } : {}),
          },);
      }
      return findings;
    },
  },);
}

/**
 Runs one engine pass over a state.

 @param policies - plugin policies in order

 @param state - candidate state

 @param tracking - read tracking

 @returns engine result
 */
async function pass({
  policies,
  state,
  tracking,
}: Readonly<{
  policies: readonly ReturnType<typeof bangPolicy>['policy'][];
  state: FakeState;
  tracking: Parameters<typeof runPolicyEngine>[0]['readTracking'];
}>,) {
  return await runPolicyEngine({
    args: ['status',],
    trigger: 'pre-forward',
    registeredPolicies: policies.map(function named(policy,) {
      return { ...policy, name: `probe/${policy.name}`, };
    },),
    gitFacts: fakeFacts(state,).facts,
    canApplyPatches: true,
    ...(tracking === undefined ? {} : { readTracking: tracking, }),
  },);
}

/**
 State with one file of the given content.

 @param content - content of `a.txt`

 @returns state
 */
function stateOf(content: string,): FakeState {
  return { candidates: [{ path: 'a.txt', content, },], };
}

await describe({
  name: '',
  children: [
    describe({
      name: decideRerun.name,
      children: [
        it({
          name: 'always runs an unrestricted policy, even with a recorded run that holds',
          fn: async function testUnrestricted(): Promise<void> {
            expect(await decideRerun({ inputs: 'unrestricted', runs: [recordedRun(),], fingerprints: BEFORE, readsHold, },),)
              .toEqual({ kind: 'run', reason: 'unrestricted', },);
          },
        },),
        it({
          name: 'runs a declared policy without a recorded run',
          fn: async function testNotRecorded(): Promise<void> {
            expect(await decideRerun({ inputs: { external: [], }, runs: [], fingerprints: BEFORE, readsHold, },),)
              .toEqual({ kind: 'run', reason: 'not-recorded', },);
          },
        },),
        it({
          name: 'reuses a context-only run whose reads hold, and re-runs one whose reads changed',
          fn: async function testContextOnly(): Promise<void> {
            /** Recorded run. */
            const run = recordedRun();
            expect(await decideRerun({ inputs: { external: [], }, runs: [run,], fingerprints: new Map(), readsHold, },),)
              .toEqual({ kind: 'reuse', run, },);
            expect(await decideRerun({ inputs: { external: [], }, runs: [run,], fingerprints: new Map(), readsHold: readsChanged, },),)
              .toEqual({ kind: 'run', reason: 'read-changed', },);
          },
        },),
        it({
          name: 'never reuses a run that proposed a patch',
          fn: async function testPatch(): Promise<void> {
            expect(await decideRerun({
              inputs: { external: [], },
              runs: [recordedRun({ findings: [{ code: 'x', message: 'x', path: 'a', patch: { kind: 'git-unified', targetId: 't', path: 'a', bytes: new Uint8Array(), }, },], },),],
              fingerprints: new Map(),
              readsHold,
            },),).toEqual({ kind: 'run', reason: 'patch-proposed', },);
          },
        },),
        ...EVERY_KIND.map(function changedKind(input,) {
          return it({
            name: `re-runs when a declared ${input.kind} input changed, and reuses while it is unchanged`,
            fn: async function testKind(): Promise<void> {
              /** Current fingerprints with this input changed. */
              const changed = new Map<string, Fingerprint>([...BEFORE, [policyInputKey(input,), 'after',],],);
              expect(await decideRerun({ inputs: { external: EVERY_KIND, }, runs: [recordedRun(),], fingerprints: changed, readsHold, },),)
                .toEqual({ kind: 'run', reason: 'input-changed', },);
              expect((await decideRerun({ inputs: { external: EVERY_KIND, }, runs: [recordedRun(),], fingerprints: BEFORE, readsHold, },)).kind,)
                .toBe('reuse',);
            },
          },);
        },),
        it({
          name: 'treats an unavailable fingerprint then or now as changed',
          fn: async function testUnavailable(): Promise<void> {
            /** Fingerprints with the executable unavailable. */
            const unavailable = new Map<string, Fingerprint>([...BEFORE, [policyInputKey({ kind: 'executable', path: 'scanner', },), UNAVAILABLE,],],);
            expect((await decideRerun({ inputs: { external: EVERY_KIND, }, runs: [recordedRun({ fingerprints: unavailable, },),], fingerprints: unavailable, readsHold, },)).kind,)
              .toBe('run',);
            expect((await decideRerun({ inputs: { external: EVERY_KIND, }, runs: [recordedRun(),], fingerprints: unavailable, readsHold, },)).kind,)
              .toBe('run',);
          },
        },),
        it({
          name: 'reuses the newest run that still holds',
          fn: async function testNewest(): Promise<void> {
            /** Newer run. */
            const newer = recordedRun({ findings: [{ code: 'newer', message: 'n', },], },);
            /** Older run. */
            const older = recordedRun({ findings: [{ code: 'older', message: 'o', },], },);
            expect(await decideRerun({ inputs: { external: [], }, runs: [newer, older,], fingerprints: new Map(), readsHold, },),)
              .toEqual({ kind: 'reuse', run: newer, },);
            expect(await decideRerun({
              inputs: { external: [], },
              runs: [newer, older,],
              fingerprints: new Map(),
              readsHold: async function onlyOlder(readSet,): Promise<boolean> {
                return readSet !== newer.readSet;
              },
            },),).toEqual({ kind: 'reuse', run: older, },);
          },
        },),
      ],
    },),
    describe({
      name: 'ordered engine passes',
      children: [
        it({
          name: 'preparation records without reusing; a replay skips context-only policies and re-runs unrestricted ones',
          fn: async function testSkip(): Promise<void> {
            /** Context-only policy. */
            const contextOnly = bangPolicy({ name: 'context', inputs: { external: [], }, },);
            /** Unrestricted policy. */
            const unrestricted = bangPolicy({ name: 'unrestricted', },);
            /** Run log. */
            const log = createPolicyRunLog();
            /** Policies in order. */
            const policies = [contextOnly.policy, unrestricted.policy,];
            /** Preparation pass. */
            const prepared = await pass({ policies, state: stateOf('a',), tracking: { reuse: false, fingerprints: new Map(), log, }, },);
            await pass({ policies, state: stateOf('a',), tracking: { reuse: false, fingerprints: new Map(), log, }, },);
            expect([contextOnly.runs(), unrestricted.runs(),],).toEqual([2, 2,],);
            /** Revalidation pass over the same candidate state. */
            const replayed = await pass({ policies, state: stateOf('a',), tracking: { reuse: true, fingerprints: new Map(), log, }, },);
            expect([contextOnly.runs(), unrestricted.runs(),],).toEqual([2, 3,],);
            expect(replayed.events,).toEqual(prepared.events,);
            expect(replayed.shouldForward,).toBe(true,);
            /** Revalidation over changed content re-runs both. */
            await pass({ policies, state: stateOf('b',), tracking: { reuse: true, fingerprints: new Map(), log, }, },);
            expect([contextOnly.runs(), unrestricted.runs(),],).toEqual([3, 4,],);
          },
        },),
        it({
          name: 'a re-run policy that patches stops the pass, and the next pass re-evaluates every later policy against the patched state',
          fn: async function testSequence(): Promise<void> {
            /** First, context-only. */
            const first = bangPolicy({ name: 'first', inputs: { external: [], }, },);
            /** Fixer, context-only. */
            const fixer = bangPolicy({ name: 'fixer', inputs: { external: [], }, fix: true, },);
            /** Last, context-only. */
            const last = bangPolicy({ name: 'last', inputs: { external: [], }, },);
            /** Policies in order. */
            const policies = [first.policy, fixer.policy, last.policy,];
            /** Run log. */
            const log = createPolicyRunLog();
            // Preparation saw already fixed content, so nobody proposed anything.
            await pass({ policies, state: stateOf('a!',), tracking: { reuse: false, fingerprints: new Map(), log, }, },);
            expect([first.runs(), fixer.runs(), last.runs(),],).toEqual([1, 1, 1,],);
            // The replay merged in content without the bang: the first two re-run, the fixer patches, and the pass stops.
            /** Provisional pass. */
            const provisional = await pass({ policies, state: stateOf('a',), tracking: { reuse: true, fingerprints: new Map(), log, }, },);
            expect(provisional.patches,).toHaveLength(1,);
            expect(provisional.shouldForward,).toBe(false,);
            expect([first.runs(), fixer.runs(), last.runs(),],).toEqual([2, 2, 1,],);
            // After the patch the state equals preparation's again, so every policy's recorded run holds.
            /** Settled pass. */
            const settled = await pass({ policies, state: stateOf('a!',), tracking: { reuse: true, fingerprints: new Map(), log, }, },);
            expect(settled.shouldForward,).toBe(true,);
            expect([first.runs(), fixer.runs(), last.runs(),],).toEqual([2, 2, 1,],);
            // A later patched state that no recorded run saw re-runs every policy from the start.
            await pass({ policies, state: stateOf('b!',), tracking: { reuse: true, fingerprints: new Map(), log, }, },);
            expect([first.runs(), fixer.runs(), last.runs(),],).toEqual([3, 3, 2,],);
          },
        },),
        it({
          name: 'a reused blocking finding still blocks',
          fn: async function testReusedBlock(): Promise<void> {
            /** Context-only policy with an error finding. */
            const blocking = bangPolicy({ name: 'blocking', inputs: { external: [], }, severity: 'error', },);
            /** Run log. */
            const log = createPolicyRunLog();
            await pass({ policies: [blocking.policy,], state: stateOf('a',), tracking: { reuse: false, fingerprints: new Map(), log, }, },);
            /** Replayed pass. */
            const replayed = await pass({ policies: [blocking.policy,], state: stateOf('a',), tracking: { reuse: true, fingerprints: new Map(), log, }, },);
            expect(blocking.runs(),).toBe(1,);
            expect(replayed.shouldForward,).toBe(false,);
            expect(replayed.events[0],).toMatchObject({ type: 'finding', policyId: 'probe/blocking', severity: 'error', code: 'probe/blocking/no-bang', },);
          },
        },),
        it({
          name: 'without tracking the engine records nothing and never reuses',
          fn: async function testUntracked(): Promise<void> {
            /** Context-only policy. */
            const contextOnly = bangPolicy({ name: 'context', inputs: { external: [], }, },);
            await pass({ policies: [contextOnly.policy,], state: stateOf('a',), tracking: undefined, },);
            await pass({ policies: [contextOnly.policy,], state: stateOf('a',), tracking: undefined, },);
            expect(contextOnly.runs(),).toBe(2,);
          },
        },),
      ],
    },),
    describe({
      name: 'phase tracking',
      children: [
        it({
          name: 'function-form inputs resolve from options, and each phase fingerprints the enabled pre-forward declarations',
          fn: async function testPhases(): Promise<void> {
            /** Validated config with a function declaration reading its option. */
            const validated = validateConfig({
              plugins: {
                probe: {
                  name: 'probe',
                  policies: [
                    {
                      name: 'env-reader',
                      defaultSeverity: 'error',
                      warnSafe: true,
                      triggers: ['pre-forward',],
                      options: v.optional(v.object({ variable: v.optional(v.string(), 'DEFAULT_VARIABLE',), },), {},),
                      inputs: function inputs(options: Readonly<{ variable: string; }>,) {
                        return { external: [{ kind: 'env', name: options.variable, },], };
                      },
                      check: async function check(): Promise<readonly never[]> {
                        return [];
                      },
                    },
                    {
                      name: 'disabled',
                      defaultSeverity: 'off',
                      warnSafe: true,
                      triggers: ['pre-forward',],
                      inputs: { external: [{ kind: 'env', name: 'NEVER', },], },
                      check: async function check(): Promise<readonly never[]> {
                        return [];
                      },
                    },
                  ],
                },
              },
              policies: { 'probe/env-reader': ['error', { variable: 'CONFIGURED', },], },
            },);
            /** Policy options as bin builds them. */
            const policyOptions = {
              config: { policies: validated.policySeverities, },
              registeredPolicies: validated.registeredPolicies,
              policyOptions: validated.policyOptions,
            };
            expect(declaredPreForwardInputs(policyOptions,),).toEqual([{ kind: 'env', name: 'CONFIGURED', },],);
            /** Disabled policy, whose inputs config loading leaves unresolved. */
            const disabled = validated.registeredPolicies.find(function isDisabled(policy,) {
              return policy.name === 'probe/disabled';
            },);
            if (disabled === undefined)
              throw new Error('The disabled policy is missing.',);
            expect(effectivePolicyInputs(disabled,),).toEqual({ external: [{ kind: 'env', name: 'NEVER', },], },);
            /** Location with an environment instead of real Git; env inputs spawn nothing. */
            const location = { gitPath: '/nonexistent/git', repositoryRoot: '/nonexistent', shadowPath: '/nonexistent', environment: { CONFIGURED: 'one', }, };
            /** Preparation phase. */
            const preparation = await withPolicyReadTracking({ policyOptions, location, },);
            expect(preparation.readTracking?.reuse,).toBe(false,);
            expect([...preparation.readTracking?.fingerprints.values() ?? [],],).toEqual(['["one"]',],);
            /** Revalidation phase after the variable changed. */
            const revalidation = await withPolicyReadTracking({ policyOptions: preparation, location: { ...location, environment: { CONFIGURED: 'two', }, }, },);
            expect(revalidation.readTracking?.reuse,).toBe(true,);
            expect(revalidation.readTracking?.log,).toBe(preparation.readTracking?.log,);
            expect([...revalidation.readTracking?.fingerprints.values() ?? [],],).toEqual(['["two"]',],);
          },
        },),
      ],
    },),
  ],
},);
