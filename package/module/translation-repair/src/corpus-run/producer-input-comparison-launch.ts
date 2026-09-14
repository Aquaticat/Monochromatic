import { createHash, } from 'node:crypto';
import { open, } from 'node:fs/promises';
import {
  dirname,
  join,
} from 'node:path';
import { isDeepStrictEqual, } from 'node:util';
import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import { ProducerInputComparisonError, } from './producer-input-comparison-error.ts';
import { verifyProducerInputComparisonFile, } from './producer-input-comparison-file.ts';
import type {
  ProducerInputComparisonInvocation,
  ProducerInputComparisonRequest,
} from './producer-input-comparison-model.ts';
import {
  type ProducerInputComparisonRun,
  verifyProducerInputComparisonRun,
  writeProducerInputComparisonRecord,
} from './producer-input-comparison-storage.ts';
import {
  type ProducerInputFileIdentity,
  readProducerInputFile,
  verifyProducerInputOutputFile,
} from './producer-input-file.ts';
import { readProducerInputLaunch, } from './producer-input-launch.ts';
import type { ProducerInputLaunch, } from './producer-input-model.ts';

//region Exact base bytes and one explicitly authorized output-parent derivation

/**
 * Both launch records retain the existing independent metadata ceiling.
 */
const MAX_LAUNCH_BYTES = 1_048_576;
/**
 * Derived launch and source evidence are private metadata, not shared configuration.
 */
const LAUNCH_FILE_MODE = 0o600;

/**
 * Retains exact launch bytes rather than reserializing an independently matched source record.
 *
 * @param run - private comparison namespace after topology revalidation
 *
 * @param file - one fixed launch evidence role
 *
 * @param bytes - privately owned matched source or generated derived bytes
 *
 * @param l - invoking derivation owner's logger
 *
 * @returns Independently rehashed persisted identity after content synchronization
 *
 * @throws ProducerInputComparisonError when extent, observation, exclusive write or sync fails
 *
 * @example
 * ```ts
 * const identity = await writeComparisonLaunch({ run, file: 'base-launch.json', bytes, l });
 * ```
 */
async function writeComparisonLaunch({
  run,
  file,
  bytes,
  l,
}: {
  readonly run: ProducerInputComparisonRun;
  readonly file: 'base-launch.json' | 'derived-launch.json';
  readonly bytes: Uint8Array;
  readonly l: Logger;
},): Promise<ProducerInputFileIdentity> {
  /**
   * Fixed role names are sufficient to explain retention without logging launch contents.
   */
  const pl = tagged({
    tag: writeComparisonLaunch.name,
    l
  });
  try {
    if (((file !== 'base-launch.json') && (file !== 'derived-launch.json'))
      || (bytes.byteLength === 0)
      || (bytes.byteLength > MAX_LAUNCH_BYTES))
      throw new ProducerInputComparisonError({
        kind: 'storage',
        directory: run.directory
      });
    /**
     * No caller buffer remains shared across the asynchronous persistence boundary.
     */
    const owned = new Uint8Array(bytes);
    /**
     * Identity describes these exact bytes, not approval of their configuration.
     */
    const expected = {
      bytes: owned.byteLength,
      sha256: createHash('sha256')
        .update(owned)
        .digest('hex')
    };
    /**
     * Path construction uses a fixed role inside the created private namespace.
     */
    const path = join(
      run.directory,
      file
    );
    await verifyProducerInputComparisonRun({
      run,
      l: pl
    });
    /**
     * Exclusive descriptor is synchronized before any derived launch may be invoked.
     */
    await using handle = await open(
      path,
      'wx',
      LAUNCH_FILE_MODE
    );
    await handle.writeFile(owned);
    await handle.sync();
    /**
     * Original descriptor identity cannot be replaced by an equal-content pathname.
     */
    const descriptor = await handle.stat({ bigint: true });
    /**
     * The existing observer checks private ownership and hashes the persisted file itself.
     */
    const observed = await verifyProducerInputOutputFile({
      path,
      expected,
      ownerUid: run.uid,
      ownerGid: run.gid
    });
    await verifyProducerInputComparisonFile({
      path,
      expected: descriptor,
      run,
      failure: 'storage',
      l: pl
    });
    await verifyProducerInputComparisonRun({
      run,
      l: pl
    });
    pl.debug(`retained exact comparison launch ${JSON.stringify(file)}`);
    return observed;
  }
  catch (error) {
    pl.warn(`comparison launch persistence failed with ${Error.isError(error) ? 'an Error object' : 'a non-Error value'}; no file is overwritten`);
    throw new ProducerInputComparisonError({
      kind: 'storage',
      directory: run.directory
    });
  }
}

/**
 * Derives only a private descendant output parent from the matched closed base launch.
 * This Task41 invocation authorizes that fixed derivation; a base hash or writable directory alone does not.
 * Every input and executable binding remains unchanged and is compared before any child starts.
 *
 * @param request - primitive-owned independent base launch and bootstrap authority
 *
 * @param run - fresh comparison namespace with an initially empty dedicated producer-runs directory
 *
 * @param l - invoking comparison owner's logger
 *
 * @returns Exact derived launch invocation without root, phase or writer approval
 *
 * @throws ProducerInputComparisonError when source identity, derivation or persistence differs
 *
 * @example
 * ```ts
 * const invocation = await deriveProducerInputComparisonLaunch({ request, run, l });
 * ```
 */
export async function deriveProducerInputComparisonLaunch({
  request,
  run,
  l,
}: {
  readonly request: ProducerInputComparisonRequest;
  readonly run: ProducerInputComparisonRun;
  readonly l: Logger;
},): Promise<ProducerInputComparisonInvocation> {
  /**
   * Source and derived identity have different authority and remain separately recorded.
   */
  const pl = tagged({
    tag: deriveProducerInputComparisonLaunch.name,
    l
  });
  try {
    /**
     * Native closed-schema parsing owns every base field; no caller-supplied launch DTO is used.
     */
    const base = await readProducerInputLaunch({
      path: request.baseLaunchPath,
      expected: request.baseLaunchIdentity
    });
    if ((dirname(run.directory) !== base.outputParent)
      || (run.inputParent !== join(
        run.directory,
        'producer-runs'
      )))
      throw new ProducerInputComparisonError({
        kind: 'contract',
        directory: run.directory
      });
    /**
     * Preserve original source serialization, including its whitespace, independently of parsed fields.
     */
    const baseBytes = await readProducerInputFile({
      path: request.baseLaunchPath,
      expected: request.baseLaunchIdentity,
      operation: 'read-launch'
    });
    /**
     * Explicit construction cannot forward hidden or unrecognized source properties.
     */
    const derived: ProducerInputLaunch = {
      version: base.version,
      kind: base.kind,
      bootstrap: {
        bytes: base.bootstrap
          .bytes,
        sha256: base.bootstrap
          .sha256
      },
      podman: {
        path: base.podman
          .path,
        bytes: base.podman
          .bytes,
        sha256: base.podman
          .sha256
      },
      imageId: base.imageId,
      runtime: {
        dir: base.runtime
          .dir,
        manifest: {
          bytes: base.runtime
            .manifest
            .bytes,
          sha256: base.runtime
            .manifest
            .sha256
        }
      },
      atomicLibrary: {
        path: base.atomicLibrary
          .path,
        bytes: base.atomicLibrary
          .bytes,
        sha256: base.atomicLibrary
          .sha256
      },
      selection: {
        path: base.selection
          .path,
        bytes: base.selection
          .bytes,
        sha256: base.selection
          .sha256
      },
      supporting: {
        dir: base.supporting
          .dir,
        maximumBytes: base.supporting
          .maximumBytes
      },
      corpus: {
        dir: base.corpus
          .dir,
        commitSha: base.corpus
          .commitSha
      },
      outputParent: run.inputParent,
    };
    /**
     * The spread is over this function's owned literal, never untrusted input or a completion certificate.
     */
    const unchangedBindings = {
      ...derived,
      outputParent: base.outputParent
    };
    if (!isDeepStrictEqual(
      unchangedBindings,
      base
    ))
      throw new ProducerInputComparisonError({
        kind: 'contract',
        directory: run.directory
      });
    /**
     * Exactly matched source bytes remain available even if later derivation persistence fails.
     */
    const baseIdentity = await writeComparisonLaunch({
      run,
      file: 'base-launch.json',
      bytes: baseBytes,
      l: pl
    });
    if (!isDeepStrictEqual(
      baseIdentity,
      request.baseLaunchIdentity
    ))
      throw new ProducerInputComparisonError({
        kind: 'contract',
        directory: run.directory
      });
    /**
     * Derived bytes have their own identity, not a self-issued approval claim.
     */
    const derivedLaunchIdentity = await writeComparisonLaunch({
      run,
      file: 'derived-launch.json',
      bytes: new TextEncoder().encode(JSON.stringify(derived)),
      l: pl
    });
    await writeProducerInputComparisonRecord({
      run,
      file: 'derivation.json',
      value: {
        version: 1,
        kind: 'producer-preparation-input-launch-derivation',
        baseLaunchIdentity: baseIdentity,
        derivedLaunchIdentity,
        changedField: 'outputParent',
        baseOutputParent: base.outputParent,
        derivedOutputParent: run.inputParent
      },
      l: pl,
    });
    pl.info('retained base-to-derived input launch lineage without changing input or executable bindings');
    return {
      bootstrapPath: request.bootstrapPath,
      bootstrapIdentity: derived.bootstrap,
      runtime: derived.runtime,
      derivedLaunchPath: join(
        run.directory,
        'derived-launch.json'
      ),
      derivedLaunchIdentity,
      signal: request.signal,
    };
  }
  catch (error) {
    if (Error.isError(error) && (error instanceof ProducerInputComparisonError))
      throw error;
    pl.warn(`input launch derivation failed with ${Error.isError(error) ? 'an Error object' : 'a non-Error value'}`);
    throw new ProducerInputComparisonError({
      kind: 'contract',
      directory: run.directory
    });
  }
}

//endregion Exact base bytes and one explicitly authorized output-parent derivation
