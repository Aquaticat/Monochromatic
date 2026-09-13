import { refusalText, } from '../refusal-text.ts';
import { readProducerInputCommand, runProducerInputCommand, } from './producer-input-command.ts';
import { ProducerInputRunError, } from './producer-input-error.ts';
import type { ProducerInputHost, } from './producer-input-host-init.ts';
import { readProducerInputContainerTerminal, type ProducerInputContainerState, } from './producer-input-inspect.ts';
import { writeProducerInputControl, } from './producer-input-run.ts';

/**
 * Forced cleanup is bounded independently from the input operation's container deadline.
 */
const STOP_GRACE_SECONDS = 5;
/**
 * A nonrunning observation is the only container state eligible for removal.
 */
type StoppedInputContainer = Exclude<ProducerInputContainerState, { readonly state: 'running'; }>;
/**
 * Stop-command failure and independently observed removal eligibility remain separate.
 */
type InputSettlement = {
  /**
   * Only a fresh validated nonrunning observation permits removal.
   */
  readonly container: StoppedInputContainer;
  /**
   * An unnecessary stop is not represented as an executed successful command.
   */
  readonly stop: 'not-required' | PromiseSettledResult<void>;
};

/**
 * Inspects the exact owned identity after a stop attempt, regardless of that attempt's command outcome.
 *
 * @param host - owning run and native invocation context
 *
 * @param id - confirmed native creation identity
 *
 * @param signal - cleanup-owned cancellation, independent from operation interruption
 *
 * @returns Fresh nonrunning observation, never inferred from stop output
 *
 * @throws ProducerInputRunError when inspection fails or still reports running
 *
 * @example
 * ```ts
 * const stopped = await inspectStoppedInput({ host, id, signal });
 * ```
 */
async function inspectStoppedInput({
  host,
  id,
  signal,
}: {
  readonly host: ProducerInputHost;
  readonly id: string;
  readonly signal: AbortSignal;
},): Promise<StoppedInputContainer> {
  await runProducerInputCommand({
    host,
    stage: 'inspect-stopped',
    arguments_: [
      'inspect',
      id
    ],
    signal
  });
  /**
   * Stop-command status and diagnostics establish neither current state nor removal eligibility.
   */
  const stopped = readProducerInputContainerTerminal({
    host,
    id,
    text: await readProducerInputCommand({
      host,
      stage: 'inspect-stopped'
    })
  });
  if (stopped.state === 'running')
    throw new ProducerInputRunError({
      operation: 'launch-container',
      locator: 'container after stop',
    });
  return stopped;
}

/**
 * Observes the owned container after execution and stops it when an interrupted client left it running.
 *
 * @param host - owning run and native invocation context
 *
 * @param id - already confirmed native creation identity
 *
 * @returns Fresh nonrunning state before any removal
 *
 * @throws ProducerInputRunError when terminal state cannot be established
 *
 * @example
 * ```ts
 * const terminal = await stopAndObserveInput({ host, id });
 * ```
 */
export async function stopAndObserveInput({
  host,
  id,
}: {
  readonly host: ProducerInputHost;
  readonly id: string
},): Promise<InputSettlement> {
  /**
   * Cleanup is not abandoned merely because the operation's signal was aborted.
   */
  const cleanup = new AbortController();
  await runProducerInputCommand({
    host,
    stage: 'inspect-terminal',
    arguments_: [
      'inspect',
      id
    ],
    signal: cleanup.signal
  });
  /**
   * Created-but-unstarted containers remain distinct from exited child processes.
   */
  const observed = readProducerInputContainerTerminal({
    host,
    id,
    text: await readProducerInputCommand({
      host,
      stage: 'inspect-terminal'
    })
  });
  if (observed.state !== 'running')
    return {
      container: observed,
      stop: 'not-required'
    };
  /**
   * Native diagnostics remain a refused command, but cannot prevent independent state observation.
   */
  const [stop] = await Promise.allSettled([runProducerInputCommand({
    host,
    stage: 'stop',
    arguments_: [
      'stop',
      '--time',
      String(STOP_GRACE_SECONDS),
      id
    ],
    signal: cleanup.signal
  })]);
  /**
   * Inspection starts only after the stop attempt settles, not concurrently with it.
   */
  const [inspection] = await Promise.allSettled([inspectStoppedInput({
    host,
    id,
    signal: cleanup.signal
  })]);
  if ((stop === undefined) || (inspection === undefined))
    throw new ProducerInputRunError({
      operation: 'launch-container',
      locator: 'stop observation outcomes',
    });
  await writeProducerInputControl({
    dir: host.run
      .dir,
    file: 'stop-observation.json',
    bytes: new TextEncoder().encode(JSON.stringify({
      version: 1,
      kind: 'producer-preparation-input-stop-observation',
      runId: host.run
        .runId,
      containerId: id,
      stop: stop.status === 'fulfilled' ? { state: 'complete' } : {
        state: 'refused',
        refusal: refusalText({ error: stop.reason as unknown })
      },
      inspection: inspection.status === 'fulfilled' ? {
        state: 'observed',
        observation: inspection.value
      } : {
        state: 'unconfirmed',
        refusal: refusalText({ error: inspection.reason as unknown })
      },
    }))
  });
  if (inspection.status === 'rejected')
    throw inspection.reason;
  return {
    container: inspection.value,
    stop
  }; 
}
