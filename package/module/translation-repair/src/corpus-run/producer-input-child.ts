import { pathToFileURL, } from 'node:url';
import type { prepareProducerInputs, } from './producer-prepare-app.ts';
import { verifyProducerInputChildContext, } from './producer-input-child-context.ts';
import { readProducerInputChildEnvironment, } from './producer-input-environment.ts';
import { ProducerInputRunError, } from './producer-input-error.ts';
import { verifyProducerInputFile, } from './producer-input-file.ts';
import { readProducerInputLaunch, } from './producer-input-launch.ts';
import type { ProducerInputCompletion, } from './producer-input-model.ts';
import { PRODUCER_INPUT_PATHS, } from './producer-input-paths.ts';
import {
  readProducerRuntimeManifest,
  verifyProducerNodeRuntime,
  verifyProducerRuntimeInventory,
} from './producer-input-runtime.ts';

//region One fixed provider-free application import behind child verification

/**
 Compile-time application contract does not import its runtime or logger before the gate.
 */
type ProducerInputApplication = {
  /**
   Fixed application operation; the type-only import executes no application code.
   */
  readonly prepareProducerInputs: typeof prepareProducerInputs;
};

/**
 Checks export availability only after independent runtime-file verification has allowed the fixed import.
 This is not a replacement for runtime identity, context checks or future root-plan review.
 
 @param value - namespace returned by the one permitted dynamic import
 
 @returns Whether the verified application exposes its expected operation
 
 @example
 ```ts
 if (!inputApplication(module)) refuseEntry();
 ```
 */
function inputApplication(value: unknown): value is ProducerInputApplication {
  return ((typeof value) === 'object') && (value !== null)
    && ((typeof Reflect.get(
      value,
      'prepareProducerInputs'
    )) === 'function');
}

/**
 Verifies the fixed child context and byte identities before importing the dedicated inert application.
 No caller can supply an application entry, command, provider client or future live mode.
 Host startup binding remains necessary because this bootstrap and Node are already executing.
 
 @returns Unqualified completion metadata after the application synchronizes its private outputs
 
 @throws ProducerInputRunError when context, identities or the fixed application entry differ
 
 @example
 ```ts
 const completion = await runProducerInputChild();
 ```
 */
export async function runProducerInputChild(): Promise<ProducerInputCompletion> {
  /**
   Exact native environment is owned before any mounted input body can be read.
   */
  const identity = readProducerInputChildEnvironment();
  await verifyProducerInputChildContext(identity);
  /**
   Launch bytes are compared with separately supplied host identity before JSON decoding.
   */
  const expectedLaunch = {
    bytes: identity.launchBytes,
    sha256: identity.launchSha256,
  };
  /**
   Host locators remain metadata; all child file reads use fixed role mounts.
   */
  const launch = await readProducerInputLaunch({
    path: PRODUCER_INPUT_PATHS.launch,
    expected: expectedLaunch
  });
  /**
   Bootstrap identity is a cross-check, not authentication of the program already executing.
   */
  await verifyProducerInputFile({
    path: PRODUCER_INPUT_PATHS.bootstrap,
    expected: launch.bootstrap,
    operation: 'verify-runtime'
  });
  /**
   Independently bound manifest bytes precede all interpretation of application filenames.
   */
  const manifest = await readProducerRuntimeManifest({
    dir: PRODUCER_INPUT_PATHS.runtime,
    expected: launch.runtime
      .manifest
  });
  await verifyProducerNodeRuntime(manifest);
  await verifyProducerInputFile({
    path: PRODUCER_INPUT_PATHS.atomicLibrary,
    expected: launch.atomicLibrary,
    operation: 'verify-runtime'
  });
  await verifyProducerRuntimeInventory({
    dir: PRODUCER_INPUT_PATHS.runtime,
    manifest
  });
  await verifyProducerInputFile({
    path: PRODUCER_INPUT_PATHS.launch,
    expected: expectedLaunch,
    operation: 'read-launch'
  });
  /**
   URL conversion preserves the one fixed entry while preventing build-time application inclusion.
   */
  const entry = pathToFileURL(PRODUCER_INPUT_PATHS.application)
    .href;
  /**
   This is the first application import; no broad package barrel is imported by the child owner.
   */
  const application: unknown = await import(entry);
  if (!inputApplication(application))
    throw new ProducerInputRunError({
      operation: 'invoke-application',
      locator: PRODUCER_INPUT_PATHS.application,
    });
  return await application.prepareProducerInputs({
    launch,
    runId: identity.runId,
    launchSha256: identity.launchSha256
  });
}

//endregion One fixed provider-free application import behind child verification
