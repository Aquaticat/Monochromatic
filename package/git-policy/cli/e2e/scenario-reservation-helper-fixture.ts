/**
 Constants and helpers of the starvation reservation scenario:
 the default reservation threshold,
 the winner and blocked-commit labels,
 and reads of landed commits and reported events.

 @module
 */

import type { AttemptRecord, } from './ledger-fixture.ts';
import { realGit, } from './repository-fixture.ts';
import type { ScenarioContext, } from './scenario-model-fixture.ts';
import { startAttempt, } from './worker-fixture.ts';

//region Constants

/**
 Default lost races before a commit reserves the next landing slot.
 */
export const RESERVE_AFTER_LOST_RACES = 1;

/**
 Label and path stem of the winner that lands while the victim is in its editor.
 */
export const FIRST_WINNER = 'w1';

/**
 Labels and path stems of the winners that land while the victim replays after each earlier lost race.
 */
export const LATER_WINNERS: readonly string[] = Array.from(
  { length: RESERVE_AFTER_LOST_RACES - 1, },
  function winnerLabel(
    _unused,
    index,
  ) {
    return `w${String(index + 2,)}`;
  },
);

/**
 Winner labels, also their path stems:
 one winning commit per lost race.
 */
export const WINNERS: readonly string[] = [
  FIRST_WINNER,
  ...LATER_WINNERS,
];

/**
 Label and path stem of the commit started while the reservation is held.
 */
export const BLOCKED = 'blocked';

/**
 Window in which a commit started while the reservation is held must not land.
 */
export const BLOCKED_WINDOW_MS = 1_500;

/**
 Paths the victim, the winners, and the blocked commit write.
 */
export const PATHS: readonly string[] = [
  'victim.txt',
  ...WINNERS.map(function winnerPath(label,) {
    return `${label}.txt`;
  },),
  `${BLOCKED}.txt`,
];

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
export async function commitWinner({
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

 @example
 ```ts
 const oid = await landedCommit({ context, attempt: victimRecord });
 ```
 */
export async function landedCommit({
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

 @example
 ```ts
 eventCount({ attempt: victimRecord, type: 'landing-reserved' }); // 1
 ```
 */
export function eventCount({
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
