/**
 Foreign `index.lock` waits: Git's backoff schedule, the unproven-owner budget and diagnostic,
 and the unbounded wait for a proven-alive owner, with injected clock, jitter, and evidence.

 @module
 */
import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { internalTestExports, } from '../../dist/final/node/index.mjs';

const {
  BACKOFF_MAX_MULTIPLIER,
  INITIAL_BACKOFF,
  IndexLockUnprovenOwnerError,
  jitteredWait,
  nextBackoff,
  PROVEN_BY_DESCRIPTOR_POLL_CAP_MS,
  PROVEN_BY_PID_FILE_POLL_CAP_MS,
} = internalTestExports;

/**
 Evidence shape.
 */
type Evidence = Parameters<typeof internalTestExports.classifyIndexLock>[0];

/**
 Wait effects shape.
 */
type Effects = NonNullable<Parameters<typeof internalTestExports.waitForIndexLock>[0]['effects']>;

/**
 Lock metadata shared by fixtures.
 */
const LOCK = {
  device: 2_049n,
  inode: 77n,
  ctimeMs: 1_700_000_000_000,
} as const;

/**
 Evidence with no PID file and no holder.
 */
const EVIDENCE_FREE: Evidence = {
  lockPath: '/repo/.git/index.lock',
  lock: LOCK,
  pidFile: { kind: 'absent', },
  holders: {
    method: 'proc-fd',
    holders: [],
    partial: ['PID 1: EACCES',],
  },
};

/**
 Evidence whose PID file names an exited process.
 */
const DEAD: Evidence = {
  ...EVIDENCE_FREE,
  pidFile: {
    kind: 'owner',
    pid: 4_242,
    owner: { state: 'missing', },
  },
};

/**
 Evidence whose PID file proves a live owner.
 */
const PROVEN_BY_PID_FILE: Evidence = {
  lockPath: EVIDENCE_FREE.lockPath,
  lock: LOCK,
  pidFile: {
    kind: 'owner',
    pid: 4_243,
    owner: {
      state: 'started-before-lock',
      startedAtMs: LOCK.ctimeMs - 5,
    },
  },
};

/**
 Evidence where only an open descriptor proves a live owner.
 */
const PROVEN_BY_DESCRIPTOR: Evidence = {
  ...EVIDENCE_FREE,
  holders: {
    method: 'proc-fd',
    holders: [{
      pid: 4_244,
      command: 'git',
    },],
    partial: [],
  },
};

/**
 Recording fake effects.
 */
type FakeEffects = Readonly<{
  /**
   Effects handed to the wait.
   */
  effects: Effects;
  /**
   Sleeps requested.
   */
  sleeps: readonly number[];
  /**
   Holder lines written.
   */
  reports: readonly string[];
  /**
   Current fake time.
   */
  now: () => number;
}>;

/**
 Builds fake effects returning evidence in order, repeating the last, with a clock advanced only by sleeps.

 @param evidence - evidence per gather

 @param random - fixed jitter value

 @returns fake effects

 @example
 ```ts
 fakeEffects({ evidence: [EVIDENCE_FREE], random: 0.5 });
 ```
 */
function fakeEffects({
  evidence,
  random,
}: Readonly<{
  evidence: readonly Evidence[];
  random: number;
}>,): FakeEffects {
  /** Mutable fake state. */
  const state = {
    time: 0,
    gathered: 0,
  };
  /** Sleeps. */
  const sleeps: number[] = [];
  /** Reports. */
  const reports: string[] = [];
  return {
    sleeps,
    reports,
    now: function currentTime(): number {
      return state.time;
    },
    effects: {
      gather: async function gather(): Promise<Evidence> {
        /** Evidence for this gather. */
        const next = evidence[Math.min(state.gathered, evidence.length - 1,)] ?? EVIDENCE_FREE;
        state.gathered += 1;
        return await Promise.resolve(next,);
      },
      sleep: async function sleep(ms: number,): Promise<void> {
        sleeps.push(ms,);
        state.time += ms;
        await Promise.resolve();
      },
      random: function fixedRandom(): number {
        return random;
      },
      report: function report(line: string,): void {
        reports.push(line,);
      },
      now: function now(): number {
        return state.time;
      },
    },
  };
}

/**
 Attempt that finds the lock held a number of times, then succeeds.

 @param heldAttempts - attempts that find the lock held

 @returns attempt function
 */
function heldFor(heldAttempts: number,): () => Promise<'acquired' | typeof internalTestExports.LOCK_HELD> {
  /** Attempts made. */
  const counter = { made: 0, };
  return async function attempt(): Promise<'acquired' | typeof internalTestExports.LOCK_HELD> {
    counter.made += 1;
    return await Promise.resolve(counter.made > heldAttempts ? 'acquired' : internalTestExports.LOCK_HELD,);
  };
}

/**
 Runs a wait expected to fail and returns its error.

 @param input - wait input

 @returns thrown error
 */
async function failedWait(input: Parameters<typeof internalTestExports.waitForIndexLock>[0],): Promise<unknown> {
  try {
    await internalTestExports.waitForIndexLock(input,);
  }
  catch (error: unknown) {
    return error;
  }
  throw new Error('The wait unexpectedly succeeded.',);
}

await describe({
  name: 'foreign index.lock wait',
  children: [
    it({
      name: 'follows Git lock_file_timeout: quadratic multipliers capped at 1000 and jitter within 75 to 125 percent',
      fn: async function testSchedule(): Promise<void> {
        await Promise.resolve();
        /** Successive backoff states. */
        const states: (typeof INITIAL_BACKOFF)[] = [INITIAL_BACKOFF,];
        for (let index = 0; index < 40; index += 1)
          states.push(nextBackoff(states.at(-1,) ?? INITIAL_BACKOFF,),);
        /** First multipliers. */
        const multipliers = states.map(function multiplierOf(state,): number {
          return state.multiplier;
        },);
        expect(multipliers.slice(0, 5,),).toEqual([1, 4, 9, 16, 25,],);
        expect(multipliers.at(-1,),).toBe(BACKOFF_MAX_MULTIPLIER,);
        expect(multipliers.every(function capped(value,): boolean {
          return value <= BACKOFF_MAX_MULTIPLIER;
        },),).toBe(true,);
        expect(nextBackoff({ step: 31, multiplier: BACKOFF_MAX_MULTIPLIER, },),).toEqual({ step: 31, multiplier: BACKOFF_MAX_MULTIPLIER, },);
        expect(jitteredWait({ state: { step: 10, multiplier: 100, }, random: 0, },),).toBe(75,);
        expect(jitteredWait({ state: { step: 10, multiplier: 100, }, random: 0.999999, },),).toBe(124,);
        expect(jitteredWait({ state: INITIAL_BACKOFF, random: 0.999999, },),).toBe(1,);
        expect(jitteredWait({ state: INITIAL_BACKOFF, random: 0, },),).toBe(0,);
      },
    },),
    it({
      name: 'fails an evidence-free owner once the unproven time reaches the budget, listing the evidence and forwarding nothing',
      fn: async function testTimeout(): Promise<void> {
        /** Fake effects. */
        const fake = fakeEffects({ evidence: [EVIDENCE_FREE,], random: 0.5, },);
        /** Failure. */
        const error = await failedWait({
          realIndexPath: '/repo/.git/index',
          timeoutMs: 1_000,
          consequence: 'did not run git add',
          attempt: heldFor(Number.POSITIVE_INFINITY,),
          effects: fake.effects,
        },);
        expect(error,).toBeInstanceOf(IndexLockUnprovenOwnerError,);
        /** Total waited. */
        const total = fake.sleeps.reduce(function sum(left, right,): number {
          return left + right;
        }, 0,);
        expect(total >= 1_000,).toBe(true,);
        expect(total < (1_000 + (BACKOFF_MAX_MULTIPLIER * 1.25)),).toBe(true,);
        expect(fake.sleeps.slice(0, 5,),).toEqual([1, 4, 9, 16, 25,],);
        expect(fake.reports,).toEqual([],);
        /** Diagnostic. */
        const message = caughtValueText(error,);
        expect(message,).toContain('/repo/.git/index.lock',);
        expect(message,).toContain('could not prove alive',);
        expect(message,).toContain('no PID file',);
        expect(message,).toContain('proc-fd scan found no process holding it open',);
        expect(message,).toContain('PID 1: EACCES',);
        expect(message,).toContain('did not run git add',);
        expect(message,).toContain('left the lock in place',);
      },
    },),
    it({
      name: 'fails a dead owner with the same budget and names its PID',
      fn: async function testDead(): Promise<void> {
        /** Failure. */
        const error = await failedWait({
          realIndexPath: '/repo/.git/index',
          timeoutMs: 50,
          consequence: 'landed nothing',
          attempt: heldFor(Number.POSITIVE_INFINITY,),
          effects: fakeEffects({ evidence: [DEAD,], random: 0, },).effects,
        },);
        expect(error,).toBeInstanceOf(IndexLockUnprovenOwnerError,);
        expect(caughtValueText(error,),).toContain('owner PID 4242 no longer runs',);
      },
    },),
    it({
      name: 'tries exactly once with a zero budget, as Git does',
      fn: async function testZero(): Promise<void> {
        /** Fake effects. */
        const fake = fakeEffects({ evidence: [EVIDENCE_FREE,], random: 0.5, },);
        expect(await failedWait({
          realIndexPath: '/repo/.git/index',
          timeoutMs: 0,
          consequence: 'landed nothing',
          attempt: heldFor(Number.POSITIVE_INFINITY,),
          effects: fake.effects,
        },),).toBeInstanceOf(IndexLockUnprovenOwnerError,);
        expect(fake.sleeps,).toEqual([],);
      },
    },),
    it({
      name: 'waits without bound for a PID-file-proven owner, reports it once, and polls at most every 100 ms',
      fn: async function testProvenPidFile(): Promise<void> {
        /** Fake effects. */
        const fake = fakeEffects({ evidence: [PROVEN_BY_PID_FILE,], random: 0.5, },);
        expect(await internalTestExports.waitForIndexLock({
          realIndexPath: '/repo/.git/index',
          timeoutMs: 10,
          consequence: 'landed nothing',
          attempt: heldFor(200,),
          effects: fake.effects,
        },),).toBe('acquired',);
        expect(fake.now() > 10_000,).toBe(true,);
        expect(Math.max(...fake.sleeps,),).toBe(PROVEN_BY_PID_FILE_POLL_CAP_MS,);
        expect(fake.reports,).toEqual(['cli-git: waiting for PID 4243, which holds /repo/.git/index.lock (proven by its Git lock PID file); cli-git waits until it releases the lock.\n',],);
      },
    },),
    it({
      name: 'polls a descriptor-proven owner at most every 500 ms and names its command',
      fn: async function testProvenDescriptor(): Promise<void> {
        /** Fake effects. */
        const fake = fakeEffects({ evidence: [PROVEN_BY_DESCRIPTOR,], random: 0.5, },);
        await internalTestExports.waitForIndexLock({
          realIndexPath: '/repo/.git/index',
          timeoutMs: 10,
          consequence: 'landed nothing',
          attempt: heldFor(60,),
          effects: fake.effects,
        },);
        expect(Math.max(...fake.sleeps,),).toBe(PROVEN_BY_DESCRIPTOR_POLL_CAP_MS,);
        expect(fake.reports.length,).toBe(1,);
        expect(fake.reports[0],).toContain('PID 4244 (git)',);
        expect(fake.reports[0],).toContain('an open descriptor',);
      },
    },),
    it({
      name: 'spends the budget only while unproven, so a proven owner that later dies still gets the full budget',
      fn: async function testMixed(): Promise<void> {
        /** Fake effects: proven for a long time, then dead. */
        const fake = fakeEffects({
          evidence: [...Array.from({ length: 50, }, function proven(): Evidence {
            return PROVEN_BY_PID_FILE;
          },), DEAD,],
          random: 0.5,
        },);
        expect(await failedWait({
          realIndexPath: '/repo/.git/index',
          timeoutMs: 300,
          consequence: 'landed nothing',
          attempt: heldFor(Number.POSITIVE_INFINITY,),
          effects: fake.effects,
        },),).toBeInstanceOf(IndexLockUnprovenOwnerError,);
        /** Waits after the owner died. */
        const unproven = fake.sleeps.slice(50,)
          .reduce(function sum(left, right,): number {
            return left + right;
          }, 0,);
        expect(unproven >= 300,).toBe(true,);
        expect(fake.reports.length,).toBe(1,);
      },
    },),
    it({
      name: 'retries at once when the lock vanished between the attempt and the evidence read',
      fn: async function testVanished(): Promise<void> {
        /** Fake effects whose gather sees no lock. */
        const fake = fakeEffects({ evidence: [], random: 0.5, },);
        expect(await internalTestExports.waitForIndexLock({
          realIndexPath: '/repo/.git/index',
          timeoutMs: 0,
          consequence: 'landed nothing',
          attempt: heldFor(3,),
          effects: {
            ...fake.effects,
            gather: async function absent() {
              return await Promise.resolve(internalTestExports.LOCK_ABSENT,);
            },
          },
        },),).toBe('acquired',);
        expect(fake.sleeps,).toEqual([],);
      },
    },),
  ],
},);
