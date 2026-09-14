import { isNativeError, } from 'node:util/types';
import {
  tagged,
  type Logger,
} from '@monochromatic-dev/module-logger/ts';
import { buildPreparationRootInputs, } from '../build-preparation-root-inputs.ts';
import { readFrozenPreparationSelection, } from '../read-frozen-preparation-selection.ts';
import { ProducerInputRunError, } from './producer-input-error.ts';
import { readProducerInputFile, } from './producer-input-file.ts';
import type {
  ProducerInputCompletion,
  ProducerInputLaunch,
} from './producer-input-model.ts';
import { writeProducerInputOutput, } from './producer-input-output.ts';
import { PRODUCER_INPUT_PATHS, } from './producer-input-paths.ts';
import { readProducerSupportingFiles, } from './producer-input-support.ts';

//region Inert provider-free application entry loaded only after the runner gate

/**
 Owns launch fields before data loading or logger callbacks can yield to a caller.
 
 @param launch - validated launch supplied by the fixed bootstrap
 
 @param l - owning application logger
 
 @returns Serializable owned launch data
 
 @throws ProducerInputRunError when the launch cannot be copied
 
 @example
 ```ts
 const fixed = ownProducerInputLaunch({ launch, l });
 ```
 */
function ownProducerInputLaunch({
  launch,
  l,
}: {
  readonly launch: ProducerInputLaunch;
  readonly l: Logger;
},): ProducerInputLaunch {
  /**
   Snapshot failures do not retain descriptor or clone diagnostics.
   */
  const pl = tagged({
    tag: ownProducerInputLaunch.name,
    l,
  },);
  try {
    return structuredClone(launch);
  }
  catch (error) {
    pl.warn(`input launch snapshot failed with ${Error.isError(error,) ? error.name : typeof error}; details were not retained`);
    throw new ProducerInputRunError({ operation: 'read-launch', });
  }
}

/**
 Decodes exact selection bytes without making malformed input a printable native parser error.
 
 @param bytes - freshly identity-checked raw selection bytes
 
 @param l - owning application logger
 
 @returns Selection text for the existing independent-digest reader
 
 @throws ProducerInputRunError when UTF-8 decoding fails
 
 @example
 ```ts
 const text = producerSelectionText({ bytes, l });
 ```
 */
function producerSelectionText({
  bytes,
  l,
}: {
  readonly bytes: Uint8Array;
  readonly l: Logger;
},): string {
  /**
   No decoder message or source excerpt is needed for this refusal.
   */
  const pl = tagged({
    tag: producerSelectionText.name,
    l,
  },);
  try {
    return new TextDecoder(
      'utf-8',
      {
        fatal: true,
        ignoreBOM: true,
      }
    ).decode(bytes);
  }
  catch (error) {
    pl.warn(`selection decoding failed with ${Error.isError(error,) ? error.name : typeof error}; details were not retained`);
    throw new ProducerInputRunError({
      operation: 'read-selection',
      locator: PRODUCER_INPUT_PATHS.selection,
    });
  }
}

/**
 Reconstructs and persists only unqualified preparation inputs through the verified native owner.
 This module has no top-level execution, provider construction or alternative CLI entry.
 The fixed bootstrap must establish runtime, mounts, resources and exclusive output ownership first.
 
 @param launch - independently identified launch already validated by the bootstrap
 
 @param runId - exclusive input-run identity, not a preparation-attempt or phase approval
 
 @param launchSha256 - exact launch identity retained beside the output
 
 @returns Completion record after both fixed output files are content-synchronized
 
 @throws ProducerInputRunError when runner input I/O or exclusive output fails
 
 @throws PreparationRootError when the native frozen population or reading relationships differ
 
 @example
 ```ts
 const complete = await prepareProducerInputs({ launch, runId, launchSha256 });
 ```
 */
export async function prepareProducerInputs({
  launch,
  runId,
  launchSha256,
}: {
  readonly launch: ProducerInputLaunch;
  readonly runId: string;
  readonly launchSha256: string;
},): Promise<ProducerInputCompletion> {
  /**
   The verified application owns all data-phase logging.
   */
  const pl = tagged({ tag: prepareProducerInputs.name, });
  /**
   Configuration is copied before the first descriptor-backed file read.
   */
  const fixed = ownProducerInputLaunch({
    launch,
    l: pl,
  });
  pl.info(`starting unqualified preparation input reconstruction for run ${JSON.stringify(runId)}`);
  /**
   The original selection is bound before any reference locator is interpreted.
   */
  const selectionBytes = await readProducerInputFile({
    path: PRODUCER_INPUT_PATHS.selection,
    expected: fixed.selection,
    operation: 'read-selection',
  });
  /**
   Strict decoding preserves the complete raw selection rather than normalizing its text.
   */
  const text = producerSelectionText({
    bytes: selectionBytes,
    l: pl,
  });
  /**
   The existing reader supplies the exact frozen reference inventory and independent parent identities.
   */
  const selection = readFrozenPreparationSelection({
    text,
    expectedDigest: fixed.selection
      .sha256,
    l: pl,
  });
  /**
   Every support extent is checked against explicit launch authority before loading any supporting body.
   */
  const artifacts = await readProducerSupportingFiles({
    selection,
    hostRoot: fixed.supporting
      .dir,
    maximumBytes: fixed.supporting
      .maximumBytes,
    l: pl,
  });
  /**
   The native owner freshly rechecks all bytes and current corpus semantics without resampling or model work.
   */
  const inputs = await buildPreparationRootInputs({
    text,
    expectedDigest: fixed.selection
      .sha256,
    artifacts,
    pin: {
    cloneDir: PRODUCER_INPUT_PATHS.corpus,
    commitSha: fixed.corpus
      .commitSha,
    gitPath: '/usr/bin/git',
  },
    l: pl,
  });
  /**
   Exact output bytes contain corpus-derived evidence and remain only in the private run directory.
   */
  const artifact = await writeProducerInputOutput({
    file: 'unqualified-inputs.json',
    text: JSON.stringify(inputs),
    l: pl,
  });
  /**
   Completion names the existing unqualified scope rather than promoting it to acquisition authority.
   */
  const completion: ProducerInputCompletion = {
    version: 1,
    kind: 'producer-preparation-input-complete',
    runId,
    launchSha256,
    artifact: {
      file: 'unqualified-inputs.json',
      ...artifact,
    },
    parentCount: inputs.parents
      .length,
    registrationCount: inputs.registry
      .length,
  };
  await writeProducerInputOutput({
    file: 'complete.json',
    text: JSON.stringify(completion),
    l: pl,
  });
  pl.info(`completed unqualified input reconstruction for ${String(completion.parentCount)} frozen parents; no phase or writer approval`);
  return completion;
}

//endregion Inert provider-free application entry loaded only after the runner gate
