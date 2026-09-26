/**
 `SIGKILL` at each landing phase cli-git exposes through its test-only phase marker,
 while another agent commits,
 followed by recovery through an ordinary wrapper invocation and a follow-up commit.

 The victim runs with `CLI_GIT_TEST_ONLY_PHASE_SIGNAL=<phase>:pause:<marker directory>`,
 so it writes `<phase>.reached` and waits there;
 the harness then starts the bystander and kills the victim's whole process group.
 At `landing-locked` the victim holds the landing lock and the real `index.lock`,
 so the bystander must recover them from a dead owner.

 @module
 */

import { join, } from 'node:path';
import { setTimeout as sleep, } from 'node:timers/promises';

import { BARRIER_TIMEOUT_MS, } from './barrier-fixture.ts';
import { synthesizeText, } from './content-fixture.ts';
import { waitForMarker, } from './process-fixture.ts';
import {
  repositoryOptions,
  seedTexts,
} from './scenario-helper-fixture.ts';
import {
  allSucceeded,
  type ScenarioContext,
  type ScenarioDefinition,
} from './scenario-model-fixture.ts';
import {
  runWrapper,
  startAttempt,
  writeWorktree,
} from './worker-fixture.ts';

//region Constants

/**
 Landing phases the wrapper marks, in transaction order.
 */
const PHASES = [
  'preparation-done',
  'landing-locked',
  'objects-migrated',
  'ref-updated',
  'index-installed',
] as const;

/**
 Window that lets the bystander reach its landing wait before the victim dies.
 */
const BYSTANDER_START_MS = 500;

//endregion Constants

//region Workload

/**
 Pauses the victim at a phase,
 starts a bystander,
 kills the victim,
 recovers,
 and commits again.

 @param context - scenario context

 @param phase - landing phase

 @returns expectations

 @example
 ```ts
 await killAtPhase({ context, phase: 'ref-updated' });
 ```
 */
async function killAtPhase({
  context,
  phase,
}: Readonly<{
  context: ScenarioContext;
  phase: typeof PHASES[number];
}>,): Promise<Awaited<ReturnType<ScenarioDefinition['run']>>> {
  await Promise.all([
    'victim.txt',
    'bystander.txt',
  ].map(async function rewrite(path,) {
    await writeWorktree({
      ...context,
      path,
      bytes: synthesizeText({
        random: context.random
          .fork(path,),
        size: 800,
      },),
    },);
  },),);
  /**
   Victim paused at the phase.
   */
  const victim = await startAttempt({
    ...context,
    label: 'victim',
    paths: ['victim.txt',],
    mode: 'explicit',
    env: { CLI_GIT_TEST_ONLY_PHASE_SIGNAL: `${phase}:pause:${context.repository
      .markerDir}`, },
  },);
  /**
   Whether the victim reached the phase before settling.
   */
  const reached = await waitForMarker({
    path: join(
      context.repository
        .markerDir,
      `${phase}.reached`,
    ),
    timeoutMs: BARRIER_TIMEOUT_MS,
    isSettled: victim.running
      .isSettled,
  },);
  /**
   Bystander started while the victim is paused.
   */
  const bystander = await startAttempt({
    ...context,
    label: 'bystander',
    paths: ['bystander.txt',],
    mode: 'explicit',
  },);
  await sleep(BYSTANDER_START_MS,);
  victim.kill();
  /**
   Settled bystander.
   */
  const [, bystanderRecord,] = await Promise.all([
    victim.finished,
    bystander.finished,
  ],);
  await runWrapper({
    ...context,
    label: 'recovery status',
    args: [
      'status',
      '--short',
    ],
    mustSucceed: true,
  },);
  await writeWorktree({
    ...context,
    path: 'follow-up.txt',
    bytes: synthesizeText({
      random: context.random
        .fork('follow-up',),
      size: 400,
    },),
  },);
  /**
   Follow-up after recovery.
   */
  const followUp = await (await startAttempt({
    ...context,
    label: 'follow-up',
    paths: ['follow-up.txt',],
    mode: 'explicit',
  },)).finished;
  return [
    {
      name: 'victim-reached-phase',
      holds: reached === 'marker',
      detail: reached === 'marker' ? '' : `victim ${reached} before reaching ${phase}`,
    },
    allSucceeded({
      name: 'bystander-succeeds',
      attempts: [bystanderRecord,],
    },),
    allSucceeded({
      name: 'follow-up-commit-succeeds',
      attempts: [followUp,],
    },),
  ];
}

/**
 Builds the kill scenario for one phase.

 @param phase - landing phase

 @returns scenario definition

 @example
 ```ts
 phaseKillScenario('landing-locked');
 ```
 */
function phaseKillScenario(phase: typeof PHASES[number],): ScenarioDefinition {
  return {
    name: `sigkill-phase-${phase}`,
    group: 'concurrency',
    summary: `SIGKILL one committing agent paused at the ${phase} phase marker while another commits, then recover`,
    repository(random,) {
      return repositoryOptions({
        seedFiles: seedTexts({
          random,
          paths: [
            'victim.txt',
            'bystander.txt',
            'follow-up.txt',
          ],
        },),
      },);
    },
    async run(context,) {
      return await killAtPhase({
        context,
        phase,
      },);
    },
  };
}

//endregion Workload

/**
 Phase-marker kill scenarios in transaction order.
 */
export const PHASE_KILL_SCENARIOS: readonly ScenarioDefinition[] = PHASES.map(phaseKillScenario,);
