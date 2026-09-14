import {
  type Logger,
  observeLoggerCallbacks,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import { observeProducerInputComparisonChildren, } from './producer-input-comparison-child.ts';
import { ownProducerInputComparisonRequest, } from './producer-input-comparison-contract.ts';
import { ProducerInputComparisonError, } from './producer-input-comparison-error.ts';
import { deriveProducerInputComparisonLaunch, } from './producer-input-comparison-launch.ts';
import type {
  ProducerInputComparisonRequest,
  ProducerInputComparisonResult,
} from './producer-input-comparison-model.ts';
import { readProducerInputComparisonOutput, } from './producer-input-comparison-output.ts';
import { invokeProducerInputBootstrap, } from './producer-input-comparison-process.ts';
import {
  createProducerInputComparisonRun,
  writeProducerInputComparisonRecord,
} from './producer-input-comparison-storage.ts';
import {
  inspectProducerInputHostLayout,
  type ProducerInputHostLayout,
  revalidateProducerInputHostLayout,
} from './producer-input-host-layout.ts';
import { readProducerInputLaunch, } from './producer-input-launch.ts';
import type { ProducerInputLaunch, } from './producer-input-model.ts';

//region One owning input-reconstruction comparison before any root or phase plan

/**
 Matches the independent base launch and rejects unsupported topology before comparison namespace creation.
 Only the matched launch and directory metadata are read; no referenced input bodies or application imports occur.
 
 @param request - primitive-owned independent base-launch authority
 
 @param l - invoking comparison owner's logger
 
 @returns Native owned base fields and metadata-only topology observation
 
 @throws ProducerInputComparisonError when launch matching or topology preflight fails
 
 @example
 ```ts
 const preflight = await preflightInputComparison({ request, l });
 ```
 */
async function preflightInputComparison({
  request,
  l,
}: {
  readonly request: ProducerInputComparisonRequest;
  readonly l: Logger;
},): Promise<{
  readonly base: ProducerInputLaunch;
  readonly layout: ProducerInputHostLayout
}> {
  /**
   A preflight refusal cannot be logged as completed input reconstruction.
   */
  const pl = tagged({
    tag: preflightInputComparison.name,
    l
  });
  try {
    /**
     The base is decoded by the existing independently bound closed-schema reader.
     */
    const base = await readProducerInputLaunch({
      path: request.baseLaunchPath,
      expected: request.baseLaunchIdentity
    });
    /**
     Existing metadata-only topology policy remains unchanged.
     */
    const layout = await inspectProducerInputHostLayout(base);
    pl.debug('matched base input launch and metadata-only host topology');
    return {
      base,
      layout
    };
  }
  catch (error) {
    pl.warn(`comparison preflight failed with ${Error.isError(error) ? 'an Error object' : 'a non-Error value'}`);
    throw new ProducerInputComparisonError({ kind: 'contract' });
  }
}

/**
 Reconstructs input through the authenticated fixed CLI, retains it, then compares actual persisted bytes.
 The invocation authorizes only a private descendant output-parent derivation under the matched base launch.
 Base and derived identities remain distinct; neither checksum grants root, phase or writer review authority.
 All failures retain created namespaces and output; no retry, root plan, acquisition attempt or client is created.
 
 @param input - independently bound base launch, authenticated bootstrap, reference identity, cancellation and logger
 
 @returns Matched retained unqualified files, not parsed nodes or an approval certificate
 
 @throws ProducerInputComparisonError when preflight, execution, observation, persistence or comparison fails
 
 @example
 ```ts
 const files = await runProducerInputComparison({ baseLaunchPath, baseLaunchIdentity, bootstrapPath, reference, signal, l });
 ```
 */
export async function runProducerInputComparison(input: ProducerInputComparisonRequest): Promise<ProducerInputComparisonResult> {
  /**
   Data authority is owned before logger callbacks or asynchronous work.
   */
  const owned = ownProducerInputComparisonRequest(input);
  /**
   Callback exceptions become fixed-name telemetry before any borrowed logger callback is requested.
   */
  const observedLogger = observeLoggerCallbacks(owned.l);
  /**
   Helpers receive only the observed facade, never the original caller logger.
   */
  const request: ProducerInputComparisonRequest = {
    ...owned,
    l: observedLogger.logger,
  };
  /**
   Every helper receives the full invoking operation's tag chain.
   */
  const pl = tagged({
    tag: runProducerInputComparison.name,
    l: request.l
  });
  try {
    /**
     Preserve the ownership-completion message and tag after primitive capture, now inside callback containment.
     */
    const ownershipLogger = tagged({
      tag: ownProducerInputComparisonRequest.name,
      l: request.l,
    });
    ownershipLogger.debug('owned fixed input-bootstrap launch and independent artifact reference');
  if (request.signal
    .aborted)
    throw new ProducerInputComparisonError({ kind: 'interruption' });
  /**
   No comparison namespace exists while launch or topology is still unverified.
   */
  const preflight = await preflightInputComparison({
    request,
    l: pl
  });
  if (request.signal
    .aborted)
    throw new ProducerInputComparisonError({ kind: 'interruption' });
  /**
   This is a comparison namespace, not a preparation acquisition attempt.
   */
  const run = await createProducerInputComparisonRun({
    parent: preflight.base
      .outputParent,
    baseLaunchIdentity: request.baseLaunchIdentity,
    reference: request.reference,
    l: pl,
  });
  try {
    await revalidateProducerInputHostLayout(preflight.layout);
    if (request.signal
      .aborted)
      throw new ProducerInputComparisonError({
        kind: 'interruption',
        directory: run.directory
      });
    /**
     Only the owned producer-runs descendant differs from the original matched launch.
     */
    const invocation = await deriveProducerInputComparisonLaunch({
      request,
      run,
      l: pl
    });
    await revalidateProducerInputHostLayout(preflight.layout);
    /**
     Native close is observed even on failure; no automatic retry can create a second input run.
     */
    const [execution] = await Promise.allSettled([invokeProducerInputBootstrap({
      run,
      invocation,
      l: pl
    })]);
    /**
     Failure-time association uses the exclusive descendant, never an arbitrary stdout directory.
     */
    const [observed] = await Promise.allSettled([observeProducerInputComparisonChildren({
      run,
      l: pl
    })]);
    if ((execution === undefined) || (observed === undefined))
      throw new ProducerInputComparisonError({
        kind: 'output',
        directory: run.directory
      });
    await writeProducerInputComparisonRecord({
      run,
      file: 'bootstrap-observation.json',
      value: {
        version: 1,
        kind: 'producer-preparation-input-bootstrap-observation',
        execution: execution.status === 'fulfilled' ? { status: 'fulfilled' }
          : {
            status: 'rejected',
            failure: Error.isError(execution.reason) && (execution.reason instanceof ProducerInputComparisonError) ? execution.reason
              .kind : 'unexpected'
          },
        observation: observed.status === 'fulfilled' ? {
          status: 'fulfilled',
          state: observed.value
            .state
        }
          : {
            status: 'rejected',
            failure: Error.isError(observed.reason) && (observed.reason instanceof ProducerInputComparisonError) ? observed.reason
              .kind : 'unexpected'
          },
      },
      l: pl,
    });
    if (execution.status === 'rejected')
      throw execution.reason;
    if (observed.status === 'rejected')
      throw observed.reason;
    if (request.signal
      .aborted)
      throw new ProducerInputComparisonError({
        kind: 'interruption',
        directory: run.directory
      });
    /**
     Successful process status and metadata cannot replace independent file hashing.
     */
    const files = await readProducerInputComparisonOutput({
      run,
      invocation,
      observation: observed.value,
      ...execution.value,
      l: pl
    });
    /**
     Comparison uses raw observed file identity, never reserialized input DTOs.
     */
    const matches = (files.identity
      .bytes
      === request.reference
      .bytes) && (files.identity
        .sha256
        === request.reference
        .sha256);
    await writeProducerInputComparisonRecord({
      run,
      file: 'comparison.json',
      value: {
        version: 1,
        kind: 'producer-preparation-input-comparison',
        scope: 'unqualified-byte-comparison-only',
        baseLaunchIdentity: request.baseLaunchIdentity,
        derivedLaunchIdentity: invocation.derivedLaunchIdentity,
        reference: request.reference,
        observed: files.identity,
        inputRunId: files.inputRunId,
        inputRunDirectory: files.inputRunDirectory,
        matches
      },
      l: pl,
    });
    if (request.signal
      .aborted)
      throw new ProducerInputComparisonError({
        kind: 'interruption',
        directory: run.directory
      });
    if (!matches)
      throw new ProducerInputComparisonError({
        kind: 'mismatch',
        directory: run.directory
      });
    pl.info('matched retained unqualified input bytes; no root or phase review authority granted');
    if (request.signal
      .aborted)
      throw new ProducerInputComparisonError({
        kind: 'interruption',
        directory: run.directory
      });
    return {
      scope: 'matched-unqualified-input-files',
      loggerCallbackFailures: observedLogger.snapshot(),
      directory: run.directory,
      inputRunDirectory: files.inputRunDirectory,
      inputRunId: files.inputRunId,
      baseLaunchIdentity: request.baseLaunchIdentity,
      derivedLaunchIdentity: invocation.derivedLaunchIdentity,
      artifact: {
        path: files.artifactPath,
        ...files.identity
      },
    };
  }
  catch (error) {
    /**
     Only fixed failure kinds, never caught native bodies, enter persisted failure metadata.
     */
    const failure = Error.isError(error) && (error instanceof ProducerInputComparisonError) ? error
      : new ProducerInputComparisonError({
        kind: 'output',
        directory: run.directory
      });
    pl.warn(`input comparison refused at ${failure.kind}; created evidence remains retained`);
    /**
     A failed failure-record write is independently refused rather than claiming an unrecorded mismatch.
     */
    const [record] = await Promise.allSettled([writeProducerInputComparisonRecord({
      run,
      file: 'failure.json',
      value: {
        version: 1,
        kind: 'producer-preparation-input-comparison-failure',
        failure: failure.kind,
        callerAborted: request.signal
          .aborted
      },
      l: pl,
    })]);
    if ((record === undefined) || (record.status === 'rejected'))
      throw new ProducerInputComparisonError({
        kind: 'storage',
        directory: run.directory
      });
    throw failure;
  }
  }
  catch (error) {
    /**
     Terminal decoration runs after all success, warning and failure-record callbacks without changing failure precedence.
     */
    const failure = Error.isError(error) && (error instanceof ProducerInputComparisonError)
      ? error : new ProducerInputComparisonError({ kind: 'output' });
    throw new ProducerInputComparisonError({
      kind: failure.kind,
      ...(failure.directory === undefined ? {} : { directory: failure.directory }),
      loggerCallbackFailures: observedLogger.snapshot(),
    });
  }
}

//endregion One owning input-reconstruction comparison before any root or phase plan
