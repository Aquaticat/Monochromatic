import { refusalText, } from '../refusal-text.ts';
import {
  readProducerInputCommand,
  runProducerInputCommand,
} from './producer-input-command.ts';
import { verifyProducerInputCompletion, } from './producer-input-completion.ts';
import { ProducerInputRunError, } from './producer-input-error.ts';
import { verifyProducerInputFile, } from './producer-input-file.ts';
import type { ProducerInputHost, } from './producer-input-host-init.ts';
import { revalidateProducerInputHostLayout, } from './producer-input-host-layout.ts';
import { verifyCreatedProducerInputContainer, } from './producer-input-inspect.ts';
import { stopAndObserveInput, } from './producer-input-host-stop.ts';
import type { ProducerInputCompletion, } from './producer-input-model.ts';
import { writeProducerInputControl, } from './producer-input-run.ts';
import { assertProducerInputNotInterrupted, } from './producer-input-signals.ts';

/**
 Checks the actual created contract, revalidates host bindings, then starts the child and checks its output.
 
 @param host - initialized input-run owner
 
 @param id - this run's confirmed native creation identity
 
 @param signal - host interruption
 
 @returns Unqualified completion after host-side private-file consistency checks
 
 @throws ProducerInputRunError when startup or output evidence differs
 
 @example
 ```ts
 const completion = await executeCreatedInput({ host, id, signal });
 ```
 */
async function executeCreatedInput({
  host,
  id,
  signal,
}: {
  readonly host: ProducerInputHost;
  readonly id: string;
  readonly signal: AbortSignal
},): Promise<ProducerInputCompletion> {
  await runProducerInputCommand({
    host,
    stage: 'inspect-created',
    arguments_: [
      'inspect',
      id
    ],
    signal
  });
  verifyCreatedProducerInputContainer({
    host,
    id,
    text: await readProducerInputCommand({
      host,
      stage: 'inspect-created'
    })
  });
  await revalidateProducerInputHostLayout(host.layout);
  await verifyProducerInputFile({
    path: host.bootstrapPath,
    expected: host.launch
      .bootstrap,
    operation: 'verify-runtime'
  });
  await verifyProducerInputFile({
    path: host.launch
      .podman
      .path,
    expected: host.launch
      .podman,
    operation: 'verify-runtime'
  });
  await verifyProducerInputFile({
    path: host.nodePath,
    expected: host.nodeIdentity,
    operation: 'verify-runtime'
  });
  await verifyProducerInputFile({
    path: host.launch
      .atomicLibrary
      .path,
    expected: host.launch
      .atomicLibrary,
    operation: 'verify-runtime'
  });
  await runProducerInputCommand({
    host,
    stage: 'start',
    arguments_: [
      'start',
      '--attach',
      '--sig-proxy=true',
      id
    ],
    signal
  });
  /**
   A native zero exit does not establish valid artifact or completion files.
   */
  const completion = await verifyProducerInputCompletion(host);
  assertProducerInputNotInterrupted(signal);
  await writeProducerInputControl({
    dir: host.run
      .dir,
    file: 'verified-completion.json',
    bytes: new TextEncoder().encode(JSON.stringify(completion))
  });
  return completion;
}

/**
 Runs and settles only a confirmed owned container, retaining operation and cleanup evidence separately.
 Input files and incomplete producer output are never removed or automatically resumed.
 
 @param host - one input-run owner
 
 @param id - confirmed native creation identity
 
 @param signal - operation cancellation
 
 @returns Complete unqualified metadata only after native removal succeeds
 
 @throws ProducerInputRunError when operation, terminal evidence or cleanup fails
 
 @example
 ```ts
 const completion = await useProducerInputContainer({ host, id, signal });
 ```
 */
export async function useProducerInputContainer({
  host,
  id,
  signal,
}: {
  readonly host: ProducerInputHost;
  readonly id: string;
  readonly signal: AbortSignal
},): Promise<ProducerInputCompletion> {
  /**
   Both native cleanup and original operation outcome must be retained, even when one fails.
   */
  const [operation] = await Promise.allSettled([executeCreatedInput({
    host,
    id,
    signal
  })]);
  /**
   Cleanup observes current native state instead of assuming an attached client owned process lifetime.
   */
  const [settlement] = await Promise.allSettled([stopAndObserveInput({
    host,
    id
  })]);
  if ((operation === undefined) || (settlement === undefined))
    throw new ProducerInputRunError({
      operation: 'launch-container',
      locator: 'native lifecycle outcome',
    });
  /**
   Rejected native promise reasons remain unknown and pass only through the names-only renderer.
   */
  const operationEvidence = operation.status === 'fulfilled'
    ? {
      state: 'complete-unqualified-inputs',
      completion: operation.value
    }
    : {
      state: 'operation-refused',
      refusal: refusalText({ error: operation.reason as unknown })
    };
  /**
   Failure to inspect a container withholds automated removal, not the retained application files.
   */
  const containerEvidence = settlement.status === 'fulfilled'
    ? {
      state: 'observed',
      observation: settlement.value
        .container
    }
    : {
      state: 'unconfirmed',
      refusal: refusalText({ error: settlement.reason as unknown })
    };
  await writeProducerInputControl({
    dir: host.run
      .dir,
    file: 'container-terminal.json',
    bytes: new TextEncoder().encode(JSON.stringify({
    version: 1,
    kind: 'producer-preparation-input-terminal',
    phase: 'owned-container',
    runId: host.run
      .runId,
    containerId: id,
    operation: operationEvidence,
    container: containerEvidence,
    removal: 'not-yet-performed',
    interrupted: signal.aborted,
  }))
  });
  if (settlement.status === 'rejected')
    throw settlement.reason;
  /**
   Removal occurs only after synchronized terminal evidence identifies a nonrunning owned container.
   */
  const cleanup = new AbortController();
  await runProducerInputCommand({
    host,
    stage: 'remove',
    arguments_: [
      'rm',
      id
    ],
    signal: cleanup.signal
  });
  await runProducerInputCommand({
    host,
    stage: 'verify-removed',
    arguments_: [
      'container',
      'exists',
      id
    ],
    signal: cleanup.signal
  });
  await writeProducerInputControl({
    dir: host.run
      .dir,
    file: 'cleanup-complete.json',
    bytes: new TextEncoder().encode(JSON.stringify({
      version: 1,
      kind: 'producer-preparation-input-cleanup-complete',
      runId: host.run
        .runId,
      containerId: id,
      removed: true,
      absenceChecked: true,
      interrupted: signal.aborted,
    }))
  });
  assertProducerInputNotInterrupted(signal);
  if (operation.status === 'rejected')
    throw operation.reason;
  if ((settlement.value
    .stop
    !== 'not-required') && (settlement.value
      .stop
      .status
      === 'rejected'))
    throw settlement.value
      .stop
      .reason;
  if ((settlement.value
    .container
    .state
    !== 'exited')
    || (settlement.value
      .container
      .exitCode
      !== 0)
    || settlement.value
    .container
    .oomKilled)
    throw new ProducerInputRunError({
      operation: 'launch-container',
      locator: 'completed container terminal state',
    });
  return operation.value;
}
