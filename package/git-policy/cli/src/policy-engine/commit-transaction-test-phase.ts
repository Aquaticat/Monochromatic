/**
 Test-only transaction phase markers for crash and interleaving suites.

 Only an explicit test-only environment variable arms a marker,
 so no ordinary configuration or environment can trigger one:
 `CLI_GIT_TEST_ONLY_PHASE_SIGNAL=<phase>:kill` makes the wrapper `SIGKILL` itself at the phase,
 `CLI_GIT_TEST_ONLY_PHASE_SIGNAL=<phase>:kill:<directory>` also writes `<directory>/<phase>.reached` first,
 and `CLI_GIT_TEST_ONLY_PHASE_SIGNAL=<phase>:pause:<directory>` writes that marker
 and waits until `<directory>/<phase>.release` exists.
 A phase a transaction can reach more than once,
 `race-lost` after each lost landing race,
 numbers its files by occurrence:
 `<phase>-<n>.reached` and `<phase>-<n>.release`.
 A malformed value fails the invocation instead of being ignored.

 @module
 */
import {
  access,
  writeFile,
} from 'node:fs/promises';
import {
  isAbsolute,
  join,
} from 'node:path';
import { wait, } from '@monochromatic-dev/module-async-time/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Environment variable arming one phase marker.
 */
export const TEST_PHASE_SIGNAL_VARIABLE = 'CLI_GIT_TEST_ONLY_PHASE_SIGNAL';

/**
 Poll interval while paused.
 */
const RELEASE_POLL_MS = 20;

/**
 Phases a marker can name, in transaction order.
 */
export const TRANSACTION_TEST_PHASES = [
  'preparation-done',
  'landing-locked',
  'objects-migrated',
  'ref-updated',
  'index-installed',
  'race-lost',
] as const;

/**
 One transaction phase.
 */
export type TransactionTestPhase = typeof TRANSACTION_TEST_PHASES[number];

/**
 Parsed marker.
 */
type PhaseSignal = Readonly<{
  /**
   Armed phase.
   */
  phase: TransactionTestPhase;
  /**
   What happens at the phase.
   */
  action: 'kill' | 'pause';
  /**
   Marker directory, required for `pause`.
   */
  directory?: string;
}>;

/**
 The environment variable is malformed.
 */
export class TestPhaseSignalError extends Error {
  /**
   Creates the error.

   @param value - rejected value
   */
  public constructor(value: string,) {
    super(`${TEST_PHASE_SIGNAL_VARIABLE}=${JSON.stringify(value,)} is not <phase>:kill[:<absolute directory>] or <phase>:pause:<absolute directory> with a phase among ${TRANSACTION_TEST_PHASES.join(', ',)}.`,);
    this.name = 'TestPhaseSignalError';
  }
}

/**
 Parses the marker variable.

 @param value - variable value

 @returns parsed marker

 @throws {@link TestPhaseSignalError} for a malformed value

 @example
 ```ts
 parsePhaseSignal('ref-updated:pause:/tmp/markers');
 ```
 */
export function parsePhaseSignal(value: string,): PhaseSignal {
  /**
   Phase end.
   */
  const phaseEnd = value.indexOf(':',);
  /**
   Action end, absent without a directory.
   */
  const actionEnd = value.indexOf(
    ':',
    phaseEnd + 1,
  );
  /**
   Phase text.
   */
  const phase = TRANSACTION_TEST_PHASES.find(function named(candidate,): boolean {
    return candidate === value.slice(
      0,
      phaseEnd,
    );
  },);
  /**
   Action text.
   */
  const action = value.slice(
    phaseEnd + 1,
    actionEnd === (-1) ? value.length : actionEnd,
  );
  /**
   Directory text, empty when absent.
   */
  const directory = actionEnd === (-1) ? '' : value.slice(actionEnd + 1,);
  if ((phaseEnd === (-1)) || (phase === undefined)
    || ((action !== 'kill') && (action !== 'pause'))
    || ((action === 'pause') && (directory === ''))
    || ((directory !== '') && (!isAbsolute(directory,))))
    throw new TestPhaseSignalError(value,);
  return {
    phase,
    action,
    ...(directory === '' ? {} : { directory, }),
  };
}

/**
 Waits until a release file exists.

 @param path - release file
 */
async function awaitRelease(path: string,): Promise<void> {
  for (;;) {
    try {
      // oxlint-disable-next-line no-await-in-loop -- Polling observes the release file in order.
      await access(path,);
      return;
    }
    catch (error: unknown) {
      l.debug(`phase release ${path} absent: ${String(error,)}`,);
    }
    // oxlint-disable-next-line no-await-in-loop -- Poll delay between release checks.
    await wait(RELEASE_POLL_MS,);
  }
}

/**
 Marks one reached transaction phase, killing or pausing the process when a test armed it.

 @param phase - reached phase

 @param occurrence - how often a repeatable phase was reached, from `1`; absent for a phase reached once

 @param environment - process environment

 @throws {@link TestPhaseSignalError} when the marker variable is malformed

 @example
 ```ts
 await reachTransactionPhase({ phase: 'ref-updated' });
 ```
 */
export async function reachTransactionPhase({
  phase,
  occurrence,
  environment = process.env,
}: Readonly<{
  phase: TransactionTestPhase;
  occurrence?: number;
  environment?: Readonly<NodeJS.ProcessEnv>;
}>,): Promise<void> {
  /**
   Marker variable.
   */
  const value = environment[TEST_PHASE_SIGNAL_VARIABLE];
  if ((value === undefined) || (value === ''))
    return;
  /**
   Parsed marker.
   */
  const signal = parsePhaseSignal(value,);
  if (signal.phase !== phase)
    return;
  /**
   Marker file stem, numbered for a repeatable phase.
   */
  const stem = occurrence === undefined ? phase : `${phase}-${String(occurrence,)}`;
  l.warn(`${TEST_PHASE_SIGNAL_VARIABLE} reached ${stem}: ${signal.action}`,);
  if (signal.directory !== undefined)
    await writeFile(
      join(
        signal.directory,
        `${stem}.reached`,
      ),
      String(process.pid,),
    );
  if (signal.action === 'kill') {
    process.kill(
      process.pid,
      'SIGKILL',
    );
    return;
  }
  await awaitRelease(join(
    signal.directory ?? '',
    `${stem}.release`,
  ),);
}
