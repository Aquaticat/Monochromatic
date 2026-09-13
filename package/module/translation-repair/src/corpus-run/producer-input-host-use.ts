import { refusalText, } from '../refusal-text.ts';
import { readProducerInputCommand, runProducerInputCommand, } from './producer-input-command.ts';
import { verifyProducerInputCompletion, } from './producer-input-completion.ts';
import { ProducerInputRunError, } from './producer-input-error.ts';
import { verifyProducerInputFile, } from './producer-input-file.ts';
import type { ProducerInputHost, } from './producer-input-host-init.ts';
import { revalidateProducerInputHostLayout, } from './producer-input-host-layout.ts';
import { readProducerInputContainerTerminal, verifyCreatedProducerInputContainer, type ProducerInputContainerState, } from './producer-input-inspect.ts';
import type { ProducerInputCompletion, } from './producer-input-model.ts';
import { writeProducerInputControl, } from './producer-input-run.ts';
import { assertProducerInputNotInterrupted, } from './producer-input-signals.ts';

/** Forced cleanup is bounded independently from the input operation's container deadline. */
const STOP_GRACE_SECONDS = 5;
/** A nonrunning observation is the only container state eligible for removal. */
type StoppedInputContainer = Exclude<ProducerInputContainerState, { readonly state: 'running'; }>;
/** Stop-command failure and independently observed removal eligibility remain separate. */
type InputSettlement = {
  /** Only a fresh validated nonrunning observation permits removal. */
  readonly container: StoppedInputContainer;
  /** An unnecessary stop is not represented as an executed successful command. */
  readonly stop: 'not-required' | PromiseSettledResult<void>;
};

/**
 * Checks the actual created contract, revalidates host bindings, then starts the child and checks its output.
 *
 * @param host - initialized input-run owner
 *
 * @param id - this run's confirmed native creation identity
 *
 * @param signal - host interruption
 *
 * @returns Unqualified completion after host-side private-file consistency checks
 *
 * @throws ProducerInputRunError when startup or output evidence differs
 *
 * @example
 * ```ts
 * const completion = await executeCreatedInput({ host, id, signal });
 * ```
 */
async function executeCreatedInput({ host, id, signal, }: { readonly host: ProducerInputHost; readonly id: string; readonly signal: AbortSignal; },): Promise<ProducerInputCompletion> {
  await runProducerInputCommand({ host, stage: 'inspect-created', arguments_: ['inspect', id], signal });
  verifyCreatedProducerInputContainer({ host, id, text: await readProducerInputCommand({ host, stage: 'inspect-created' }) });
  await revalidateProducerInputHostLayout(host.layout);
  await verifyProducerInputFile({ path: host.bootstrapPath, expected: host.launch.bootstrap, operation: 'verify-runtime' });
  await verifyProducerInputFile({ path: host.launch.podman.path, expected: host.launch.podman, operation: 'verify-runtime' });
  await verifyProducerInputFile({ path: host.nodePath, expected: host.nodeIdentity, operation: 'verify-runtime' });
  await verifyProducerInputFile({ path: host.launch.atomicLibrary.path, expected: host.launch.atomicLibrary, operation: 'verify-runtime' });
  await runProducerInputCommand({ host, stage: 'start', arguments_: ['start', '--attach', '--sig-proxy=true', id], signal });
  /** A native zero exit does not establish valid artifact or completion files. */
  const completion = await verifyProducerInputCompletion(host);
  assertProducerInputNotInterrupted(signal);
  await writeProducerInputControl({ dir: host.run.dir, file: 'verified-completion.json', bytes: new TextEncoder().encode(JSON.stringify(completion)) });
  return completion;
}

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
async function inspectStoppedInput({ host, id, signal, }: {
  readonly host: ProducerInputHost;
  readonly id: string;
  readonly signal: AbortSignal;
},): Promise<StoppedInputContainer> {
  await runProducerInputCommand({ host, stage: 'inspect-stopped', arguments_: ['inspect', id], signal });
  /** Stop-command status and diagnostics establish neither current state nor removal eligibility. */
  const stopped = readProducerInputContainerTerminal({ host, id, text: await readProducerInputCommand({ host, stage: 'inspect-stopped' }) });
  if (stopped.state === 'running')
    throw new ProducerInputRunError({ operation: 'launch-container', locator: 'container after stop', });
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
async function stopAndObserveInput({ host, id, }: { readonly host: ProducerInputHost; readonly id: string; },): Promise<InputSettlement> {
  /** Cleanup is not abandoned merely because the operation's signal was aborted. */
  const cleanup = new AbortController();
  await runProducerInputCommand({ host, stage: 'inspect-terminal', arguments_: ['inspect', id], signal: cleanup.signal });
  /** Created-but-unstarted containers remain distinct from exited child processes. */
  const observed = readProducerInputContainerTerminal({ host, id, text: await readProducerInputCommand({ host, stage: 'inspect-terminal' }) });
  if (observed.state !== 'running')
    return { container: observed, stop: 'not-required' };
  /** Native diagnostics remain a refused command, but cannot prevent independent state observation. */
  const [stop] = await Promise.allSettled([runProducerInputCommand({ host, stage: 'stop', arguments_: ['stop', '--time', String(STOP_GRACE_SECONDS), id], signal: cleanup.signal })]);
  /** Inspection starts only after the stop attempt settles, not concurrently with it. */
  const [inspection] = await Promise.allSettled([inspectStoppedInput({ host, id, signal: cleanup.signal })]);
  if (stop === undefined || inspection === undefined)
    throw new ProducerInputRunError({ operation: 'launch-container', locator: 'stop observation outcomes', });
  await writeProducerInputControl({ dir: host.run.dir, file: 'stop-observation.json', bytes: new TextEncoder().encode(JSON.stringify({
    version: 1, kind: 'producer-preparation-input-stop-observation', runId: host.run.runId, containerId: id,
    stop: stop.status === 'fulfilled' ? { state: 'complete' } : { state: 'refused', refusal: refusalText({ error: stop.reason as unknown }) },
    inspection: inspection.status === 'fulfilled' ? { state: 'observed', observation: inspection.value } : { state: 'unconfirmed', refusal: refusalText({ error: inspection.reason as unknown }) },
  })) });
  if (inspection.status === 'rejected')
    throw inspection.reason;
  return { container: inspection.value, stop }; 
}

/**
 * Runs and settles only a confirmed owned container, retaining operation and cleanup evidence separately.
 * Input files and incomplete producer output are never removed or automatically resumed.
 *
 * @param host - one input-run owner
 *
 * @param id - confirmed native creation identity
 *
 * @param signal - operation cancellation
 *
 * @returns Complete unqualified metadata only after native removal succeeds
 *
 * @throws ProducerInputRunError when operation, terminal evidence or cleanup fails
 *
 * @example
 * ```ts
 * const completion = await useProducerInputContainer({ host, id, signal });
 * ```
 */
export async function useProducerInputContainer({ host, id, signal, }: { readonly host: ProducerInputHost; readonly id: string; readonly signal: AbortSignal; },): Promise<ProducerInputCompletion> {
  /** Both native cleanup and original operation outcome must be retained, even when one fails. */
  const [operation] = await Promise.allSettled([executeCreatedInput({ host, id, signal })]);
  /** Cleanup observes current native state instead of assuming an attached client owned process lifetime. */
  const [settlement] = await Promise.allSettled([stopAndObserveInput({ host, id })]);
  if (operation === undefined || settlement === undefined)
    throw new ProducerInputRunError({ operation: 'launch-container', locator: 'native lifecycle outcome', });
  /** Rejected native promise reasons remain unknown and pass only through the names-only renderer. */
  const operationEvidence = operation.status === 'fulfilled'
    ? { state: 'complete-unqualified-inputs', completion: operation.value }
    : { state: 'operation-refused', refusal: refusalText({ error: operation.reason as unknown }) };
  /** Failure to inspect a container withholds automated removal, not the retained application files. */
  const containerEvidence = settlement.status === 'fulfilled'
    ? { state: 'observed', observation: settlement.value.container }
    : { state: 'unconfirmed', refusal: refusalText({ error: settlement.reason as unknown }) };
  await writeProducerInputControl({ dir: host.run.dir, file: 'container-terminal.json', bytes: new TextEncoder().encode(JSON.stringify({
    version: 1,
    kind: 'producer-preparation-input-terminal',
    phase: 'owned-container',
    runId: host.run.runId,
    containerId: id,
    operation: operationEvidence,
    container: containerEvidence,
    removal: 'not-yet-performed',
    interrupted: signal.aborted,
  })) });
  if (settlement.status === 'rejected')
    throw settlement.reason;
  /** Removal occurs only after synchronized terminal evidence identifies a nonrunning owned container. */
  const cleanup = new AbortController();
  await runProducerInputCommand({ host, stage: 'remove', arguments_: ['rm', id], signal: cleanup.signal });
  await runProducerInputCommand({ host, stage: 'verify-removed', arguments_: ['container', 'exists', id], signal: cleanup.signal });
  await writeProducerInputControl({ dir: host.run.dir, file: 'cleanup-complete.json', bytes: new TextEncoder().encode(JSON.stringify({
    version: 1, kind: 'producer-preparation-input-cleanup-complete', runId: host.run.runId, containerId: id,
    removed: true, absenceChecked: true, interrupted: signal.aborted,
  })) });
  assertProducerInputNotInterrupted(signal);
  if (operation.status === 'rejected')
    throw operation.reason;
  if (settlement.value.stop !== 'not-required' && settlement.value.stop.status === 'rejected')
    throw settlement.value.stop.reason;
  if (settlement.value.container.state !== 'exited' || settlement.value.container.exitCode !== 0 || settlement.value.container.oomKilled)
    throw new ProducerInputRunError({ operation: 'launch-container', locator: 'completed container terminal state', });
  return operation.value;
}
