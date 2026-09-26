/**
 Starvation reservation:
 a commit that keeps losing landing races reserves the next slot and lands within the bound,
 before a commit started while it held the reservation.

 The victim holds in its editor until the first winner lands,
 then pauses after each lost race through the test-only `race-lost` phase marker,
 so the second winner lands while it replays;
 after its second lost race it holds the reservation
 (`landing.reserveAfterLostRaces` defaults to 2).

 @module
 */

import {
  mkdir,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

import {
  BARRIER_TIMEOUT_MS,
  reached,
  releaseAt,
  settleWithin,
} from './barrier-fixture.ts';
import { synthesizeText, } from './content-fixture.ts';
import { isAncestor, } from './git-read-fixture.ts';
import type { AttemptRecord, } from './ledger-fixture.ts';
import { waitForMarker, } from './process-fixture.ts';
import { realGit, } from './repository-fixture.ts';
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
  startAttempt,
  writeWorktree,
} from './worker-fixture.ts';

//region Constants

/**
 Default lost races before a commit reserves the next landing slot.
 */
const RESERVE_AFTER_LOST_RACES = 2;

/**
 Window in which a commit started while the reservation is held must not land.
 */
const BLOCKED_WINDOW_MS = 1_500;

/**
 Paths the victim, the two winners, and the blocked commit write.
 */
const PATHS = [
  'victim.txt',
  'w1.txt',
  'w2.txt',
  'w3.txt',
] as const;

//endregion Constants

//region Helpers

/**
 Commits one winner to completion.

 @param context - scenario context

 @param label - winner label, also its path stem

 @returns finished attempt

 @example
 ```ts
 await commitWinner({ context, label: 'w1' });
 ```
 */
async function commitWinner({
  context,
  label,
}: Readonly<{
  context: ScenarioContext;
  label: string;
}>,): Promise<AttemptRecord> {
  return await (await startAttempt({
    ...context,
    label,
    paths: [`${label}.txt`,],
    mode: 'explicit',
  },)).finished;
}

/**
 Commit carrying an attempt's token on the local branches.

 @param context - scenario context

 @param attempt - finished attempt

 @returns commit ID, empty when none landed
 */
async function landedCommit({
  context,
  attempt,
}: Readonly<{
  context: ScenarioContext;
  attempt: AttemptRecord;
}>,): Promise<string> {
  return (await realGit({
    repository: context.repository,
    args: [
      'log',
      '--branches',
      '--format=%H',
      '--fixed-strings',
      `--grep=[${attempt.token}]`,
    ],
  },)).trim();
}

/**
 Counts one JSONL event type in an attempt's standard error.

 @param attempt - finished attempt

 @param type - event type

 @returns occurrences
 */
function eventCount({
  attempt,
  type,
}: Readonly<{
  attempt: AttemptRecord;
  type: string;
}>,): number {
  return attempt.outcome
    .stderr
    .split(`"type":"${type}"`,)
    .length
    - 1;
}

//endregion Helpers

//region Scenario

/**
 Commit that loses two races, reserves, and lands before a later commit.
 */
const reservationAfterLostRaces: ScenarioDefinition = {
  name: 'reservation-after-lost-races',
  group: 'concurrency',
  summary: 'a commit loses two landing races, reserves the next slot, and lands before a commit started while it held the reservation',
  repository(random,) {
    return repositoryOptions({ seedFiles: seedTexts({
      random,
      paths: PATHS,
    },), },);
  },
  async run(context,) {
    await Promise.all(PATHS.map(async function rewrite(path,) {
      await writeWorktree({
        ...context,
        path,
        bytes: synthesizeText({
          random: context.random
            .fork(path,),
          size: 400,
        },),
      },);
    },),);
    /**
     Directory of the victim's phase files.
     */
    const phases = join(
      context.repository
        .markerDir,
      'victim-phases',
    );
    await mkdir(
      phases,
      { recursive: true, },
    );
    /**
     Victim held in its editor, pausing after each lost race.
     */
    const victim = await startAttempt({
      ...context,
      label: 'victim',
      paths: ['victim.txt',],
      mode: 'explicit',
      extraArgs: ['-e',],
      env: {
        GIT_EDITOR: context.repository
          .editorProgram,
        CLI_GIT_TEST_ONLY_PHASE_SIGNAL: `race-lost:pause:${phases}`,
      },
    },);
    /**
     Whether the victim reached its editor.
     */
    const inEditor = await reached({
      repository: context.repository,
      token: victim.token,
      running: victim.running,
      event: 'editor',
    },);
    /**
     First winner.
     */
    const first = await commitWinner({
      context,
      label: 'w1',
    },);
    await releaseAt({
      repository: context.repository,
      token: victim.token,
      event: 'editor',
    },);
    /**
     Whether the victim lost its first race.
     */
    const lostFirst = await waitForMarker({
      path: join(
        phases,
        'race-lost-1.reached',
      ),
      timeoutMs: BARRIER_TIMEOUT_MS,
      isSettled: victim.running
        .isSettled,
    },);
    /**
     Second winner, landing while the victim replays onto the first.
     */
    const second = await commitWinner({
      context,
      label: 'w2',
    },);
    await writeFile(
      join(
        phases,
        'race-lost-1.release',
      ),
      '',
    );
    /**
     Whether the victim lost its second race and holds the reservation.
     */
    const lostSecond = await waitForMarker({
      path: join(
        phases,
        'race-lost-2.reached',
      ),
      timeoutMs: BARRIER_TIMEOUT_MS,
      isSettled: victim.running
        .isSettled,
    },);
    /**
     Branch while the victim holds the reservation.
     */
    const headHeld = await realGit({
      repository: context.repository,
      args: [
        'rev-parse',
        'HEAD',
      ],
    },);
    /**
     Commit started while the reservation is held.
     */
    const blocked = await startAttempt({
      ...context,
      label: 'w3',
      paths: ['w3.txt',],
      mode: 'explicit',
    },);
    /**
     Whether it settled while the reservation was held.
     */
    const settledEarly = await settleWithin({
      running: blocked.running,
      windowMs: BLOCKED_WINDOW_MS,
    },);
    /**
     Branch after the window.
     */
    const headAfterWindow = await realGit({
      repository: context.repository,
      args: [
        'rev-parse',
        'HEAD',
      ],
    },);
    await writeFile(
      join(
        phases,
        'race-lost-2.release',
      ),
      '',
    );
    /**
     Settled victim and blocked commit.
     */
    const [victimRecord, blockedRecord,] = await Promise.all([
      victim.finished,
      blocked.finished,
    ],);
    /**
     Landed victim and blocked commits.
     */
    const [victimCommit, blockedCommit,] = await Promise.all([
      landedCommit({
        context,
        attempt: victimRecord,
      },),
      landedCommit({
        context,
        attempt: blockedRecord,
      },),
    ],);
    /**
     Lost races the victim reported.
     */
    const lostRaces = eventCount({
      attempt: victimRecord,
      type: 'landing-race-lost',
    },);
    return [
      allSucceeded({
        name: 'all-commits-succeed',
        attempts: [
          first,
          second,
          victimRecord,
          blockedRecord,
        ],
      },),
      {
        name: 'victim-lost-races',
        holds: (inEditor === 'marker') && (lostFirst === 'marker')
          && (lostSecond === 'marker'),
        detail: `editor ${inEditor}, first lost race ${lostFirst}, second lost race ${lostSecond}`,
      },
      {
        name: 'reserved-within-bound',
        holds: (eventCount({
          attempt: victimRecord,
          type: 'landing-reserved',
        },) === 1)
          && (lostRaces <= (RESERVE_AFTER_LOST_RACES
            + 1)),
        detail: `victim reported ${String(lostRaces,)} lost races and ${String(eventCount({
          attempt: victimRecord,
          type: 'landing-reserved',
        },),)} reservations`,
      },
      {
        name: 'reservation-blocks-landing',
        holds: (!settledEarly) && (headAfterWindow === headHeld),
        detail: settledEarly ? 'the commit started during the reservation settled before the holder landed' : `HEAD moved from ${headHeld} to ${headAfterWindow} while the reservation was held`,
      },
      {
        name: 'reserved-lands-first',
        holds: (victimCommit !== '') && (blockedCommit !== '')
          && (await isAncestor({
          repository: context.repository,
          oid: victimCommit,
          ref: blockedCommit,
        },)),
        detail: `victim ${victimCommit} is not an ancestor of the later commit ${blockedCommit}`,
      },
    ];
  },
};

/**
 Reservation scenarios in report order.
 */
export const RESERVATION_SCENARIOS: readonly ScenarioDefinition[] = [reservationAfterLostRaces,];

//endregion Scenario
