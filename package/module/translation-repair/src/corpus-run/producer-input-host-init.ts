import { realpath, } from 'node:fs/promises';
import { refusalText, } from '../refusal-text.ts';
import { ProducerInputRunError, } from './producer-input-error.ts';
import {
  readProducerInputFile,
  verifyProducerInputFile,
  type ProducerInputFileIdentity,
} from './producer-input-file.ts';
import {
  inspectProducerInputHostLayout,
  revalidateProducerInputHostLayout,
  type ProducerInputHostLayout,
} from './producer-input-host-layout.ts';
import { readProducerInputLaunch, } from './producer-input-launch.ts';
import type { ProducerInputLaunch, } from './producer-input-model.ts';
import {
  createProducerInputPodmanContext,
  type ProducerInputPodmanContext,
} from './producer-input-podman.ts';
import {
  createProducerInputRun,
  writeProducerInputControl,
  type ProducerInputRun,
} from './producer-input-run.ts';
import {
  readProducerRuntimeManifest,
  verifyProducerNodeRuntime,
  verifyProducerRuntimeInventory,
} from './producer-input-runtime.ts';

//region One host-owned initialization path, never caller-fabricated mount metadata

/**
 Host bindings are created together after the launch and exclusive namespace are established.
 */
export type ProducerInputHost = {
  /**
   Independently identified owned launch, not an approval verdict.
   */
  readonly launch: ProducerInputLaunch;
  /**
   Independently supplied launch identity retained for child and output comparisons.
   */
  readonly launchIdentity: ProducerInputFileIdentity;
  /**
   Exclusive run and fixed writable child directory.
   */
  readonly run: ProducerInputRun;
  /**
   Metadata-only layout to revalidate immediately before container startup.
   */
  readonly layout: ProducerInputHostLayout;
  /**
   Exact executing Node location, not selected through PATH or launch JSON.
   */
  readonly nodePath: string;
  /**
   Independently manifest-bound Node bytes are rechecked immediately before child startup.
   */
  readonly nodeIdentity: ProducerInputFileIdentity;
  /**
   Exact separately packaged bootstrap location supplied by its own entry.
   */
  readonly bootstrapPath: string;
  /**
   Generated host configuration and fixed local Podman invocation prefix.
   */
  readonly podman: ProducerInputPodmanContext;
};

/**
 Rejects noncanonical input filenames before native file or executable use.
 
 @param path - independently authorized absolute file locator
 
 @param operation - owning file role's fixed diagnostic vocabulary
 
 @throws ProducerInputRunError when canonical identity differs
 
 @example
 ```ts
 await canonicalHostFile({ path, operation: 'verify-runtime' });
 ```
 */
async function canonicalHostFile({
  path,
  operation,
}: {
  readonly path: string;
  readonly operation: 'verify-runtime' | 'read-selection'
},): Promise<void> {
  try {
    if (await realpath(path) !== path)
      throw new ProducerInputRunError({
        operation,
        locator: path,
      });
  }
  catch (error) {
    if (error instanceof ProducerInputRunError)
      throw error;
    throw new ProducerInputRunError({
      operation,
      locator: path,
    });
  }
}

/**
 Writes a names-only terminal record when no container has been created yet.
 
 @param run - exclusive initialized namespace, retained even when this write fails
 
 @param error - caught host failure whose body is never forwarded without its audited marker
 
 @throws ProducerInputRunError when terminal evidence cannot be synchronized
 
 @example
 ```ts
 await recordInitializationFailure({ run, error });
 ```
 */
async function recordInitializationFailure({
  run,
  error,
}: {
  readonly run: ProducerInputRun;
  readonly error: unknown
},): Promise<void> {
  await writeProducerInputControl({
    dir: run.dir,
    file: 'container-terminal.json',
    bytes: new TextEncoder().encode(JSON.stringify({
    version: 1,
    kind: 'producer-preparation-input-terminal',
    phase: 'host-initialization',
    state: 'refused-before-container',
    runId: run.runId,
    refusal: refusalText({ error }),
  }))
  });
}

/**
 Matches independently recorded launch bytes, rejects directory topology, creates exclusive output, then binds execution files.
 The trusted caller authenticates this already executing bootstrap and host platform before invocation.
 No corpus or support-file bodies, Git operations or application imports occur here.
 
 @param launchPath - exact caller-selected launch file
 
 @param expected - independently supplied raw launch extent and digest
 
 @param bootstrapPath - this standalone entry's own canonical filename
 
 @returns Owned cross-bound host initialization, not input or execution approval
 
 @throws ProducerInputRunError when launch, topology, namespace or runtime identity differs
 
 @example
 ```ts
 const host = await initializeProducerInputHost({ launchPath, expected, bootstrapPath });
 ```
 */
export async function initializeProducerInputHost({
  launchPath,
  expected,
  bootstrapPath,
}: {
  readonly launchPath: string;
  readonly expected: ProducerInputFileIdentity;
  readonly bootstrapPath: string;
},): Promise<ProducerInputHost> {
  /**
   Independent primitive identity is copied before asynchronous reads.
   */
  const launchIdentity = {
    bytes: expected.bytes,
    sha256: expected.sha256,
  };
  /**
   Closed launch parsing cannot select an application entry or operation.
   */
  const launch = await readProducerInputLaunch({
    path: launchPath,
    expected: launchIdentity
  });
  /**
   Preserve exact original serialization rather than claiming a reserialized object has the same identity.
   */
  const launchBytes = await readProducerInputFile({
    path: launchPath,
    expected: launchIdentity,
    operation: 'read-launch'
  });
  /**
   Directory metadata may reject aliases before output creation but grants no content authority.
   */
  const layout = await inspectProducerInputHostLayout(launch);
  /**
   Cross-binding to the authenticated output parent is owned here, not left to an external caller.
   */
  const run = await createProducerInputRun({
    parent: launch.outputParent,
    launchBytes,
    expected: launchIdentity
  });
  try {
    await revalidateProducerInputHostLayout(layout);
    await canonicalHostFile({
      path: bootstrapPath,
      operation: 'verify-runtime'
    });
    await canonicalHostFile({
      path: launch.podman
        .path,
      operation: 'verify-runtime'
    });
    await canonicalHostFile({
      path: launch.atomicLibrary
        .path,
      operation: 'verify-runtime'
    });
    await canonicalHostFile({
      path: launch.selection
        .path,
      operation: 'read-selection'
    });
    await verifyProducerInputFile({
      path: bootstrapPath,
      expected: launch.bootstrap,
      operation: 'verify-runtime'
    });
    await verifyProducerInputFile({
      path: launch.podman
        .path,
      expected: launch.podman,
      operation: 'verify-runtime'
    });
    await verifyProducerInputFile({
      path: launch.atomicLibrary
        .path,
      expected: launch.atomicLibrary,
      operation: 'verify-runtime'
    });
    await verifyProducerInputFile({
      path: launch.selection
        .path,
      expected: launch.selection,
      operation: 'read-selection'
    });
    /**
     Exact manifest identity precedes filename and Node interpretation.
     */
    const manifest = await readProducerRuntimeManifest({
      dir: launch.runtime
        .dir,
      expected: launch.runtime
        .manifest
    });
    await verifyProducerNodeRuntime(manifest);
    await verifyProducerRuntimeInventory({
      dir: launch.runtime
        .dir,
      manifest
    });
    /**
     The mount uses this executing Node after its content and version checks, not an independent PATH lookup.
     */
    const nodePath = await realpath(process.execPath);
    /**
     Ambient configuration and subscription mounts are not inherited silently.
     */
    const podman = await createProducerInputPodmanContext(run);
    return {
      launch,
      launchIdentity,
      run,
      layout,
      nodePath,
      nodeIdentity: {
        bytes: manifest.node
          .executable
          .bytes,
        sha256: manifest.node
          .executable
          .sha256
      },
      bootstrapPath,
      podman,
    };
  }
  catch (error) {
    await recordInitializationFailure({
      run,
      error
    });
    throw error;
  }
}

//endregion One host-owned initialization path, never caller-fabricated mount metadata
