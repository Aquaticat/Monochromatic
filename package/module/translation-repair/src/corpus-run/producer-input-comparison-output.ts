import { comparisonOutputLayout, } from './producer-input-comparison-output-layout.ts';
import { join, } from 'node:path';
import { isDeepStrictEqual, } from 'node:util';
import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import { parseProducerInputCompletion, } from './producer-input-completion-record.ts';
import type { ProducerInputComparisonChildObservation, } from './producer-input-comparison-child.ts';
import { ProducerInputComparisonError, } from './producer-input-comparison-error.ts';
import {
  comparisonHex,
  comparisonInputRunId,
  comparisonMetadata,
  RUN_PREFIX,
} from './producer-input-comparison-output-shape.ts';
import type {
  ProducerInputBootstrapStreams,
  ProducerInputComparisonInvocation,
} from './producer-input-comparison-model.ts';
import { verifyProducerInputComparisonFile, } from './producer-input-comparison-file.ts';
import {
  type ProducerInputComparisonRun,
  verifyProducerInputComparisonRun,
} from './producer-input-comparison-storage.ts';
import {
  type ProducerInputFileIdentity,
  readProducerInputMetadata,
  verifyProducerInputFile,
  verifyProducerInputOutputFile,
} from './producer-input-file.ts';

//region Retained native output is independently observed, never reconstructed from stdout claims

/**
 * Completion and command metadata have a ceiling separate from artifact body hashing.
 */
const METADATA_LIMIT = 1_048_576;
/**
 * Native container identities use canonical lowercase SHA-256 spelling.
 */
const CONTAINER_ID_WIDTH = 64;

/**
 * Byte-verified files remain unqualified until their independent reference comparison and later reviews.
 *
 * @example
 * ```ts
 * const identity = files.identity;
 * ```
 */
export type ProducerInputReconstructionFiles = {
  /**
   * Observed dedicated-parent child, never an arbitrary stdout-selected path.
   */
  readonly inputRunDirectory: string;
  /**
   * Canonical native input-run identifier, not a preparation-attempt identity.
   */
  readonly inputRunId: string;
  /**
   * Fixed retained artifact location.
   */
  readonly artifactPath: string;
  /**
   * Independently observed persisted bytes, not metadata accepted without hashing.
   */
  readonly identity: ProducerInputFileIdentity;
};

/**
 * Checks private output, exact launch lineage, completion copies and raw artifact bytes after bootstrap success.
 * No root-input JSON is reserialized or parsed to establish its byte identity.
 *
 * @param run - owned comparison namespace and dedicated native output parent
 *
 * @param invocation - exact executed derived launch and unchanged runtime bindings
 *
 * @param observation - independently recorded direct-child observation after actual native close
 *
 * @param stdoutPath - fixed retained bootstrap stdout location
 *
 * @param stderrPath - fixed retained bootstrap stderr location
 *
 * @param stdoutState - actual synchronized stdout descriptor snapshot from the owning subprocess
 *
 * @param stderrState - actual synchronized stderr descriptor snapshot from the owning subprocess
 *
 * @param l - invoking comparison owner's logger
 *
 * @returns Independently observed retained artifact files, still unqualified
 *
 * @throws ProducerInputComparisonError when any file, shape or lineage check fails
 *
 * @example
 * ```ts
 * const files = await readProducerInputComparisonOutput({ run, invocation, observation, stdoutPath, stderrPath, stdoutState, stderrState, l });
 * ```
 */
export async function readProducerInputComparisonOutput({
  run,
  invocation,
  observation,
  stdoutPath,
  stderrPath,
  stdoutState,
  stderrState,
  l,
}: {
  readonly run: ProducerInputComparisonRun;
  readonly invocation: ProducerInputComparisonInvocation;
  readonly observation: ProducerInputComparisonChildObservation;
  readonly stdoutPath: string;
  readonly stderrPath: string;
  readonly stdoutState: ProducerInputBootstrapStreams['stdoutState'];
  readonly stderrState: ProducerInputBootstrapStreams['stderrState'];
  readonly l: Logger;
},): Promise<ProducerInputReconstructionFiles> {
  /**
   * Independent file verification never logs corpus-derived bytes.
   */
  const pl = tagged({
    tag: readProducerInputComparisonOutput.name,
    l
  });
  /**
   * Shared descriptor observer supplies the same metadata bound and ownership for each fixed role.
   *
   * @param path - fixed private native metadata locator
   *
   * @returns Strictly decoded text after extent and descriptor checks
   *
   * @throws ProducerInputRunError when private metadata observation fails
   *
   * @example
   * ```ts
   * const text = await metadata(stdoutPath);
   * ```
   */
  async function metadata(path: string): Promise<string> {
    return await readProducerInputMetadata({
      path,
      maximumBytes: METADATA_LIMIT,
      ownerUid: run.uid,
      ownerGid: run.gid,
      operation: 'read-output',
    });
  }
  try {
    await verifyProducerInputComparisonRun({
      run,
      l: pl
    });
    /**
     * Identity comes from the dedicated parent's observed child, not success stdout.
     */
    const inputRunId = comparisonInputRunId({
      observation,
      directory: run.directory
    });
    /**
     * The parent and generated prefix are already fixed by this operation.
     */
    const inputRunDirectory = join(
      run.inputParent,
      `${RUN_PREFIX}${inputRunId}`
    );
    /**
     * Only the native output directory can contain the unqualified artifact.
     */
    const output = join(
      inputRunDirectory,
      'output'
    );
    await comparisonOutputLayout({
      inputRunDirectory,
      inputRunId,
      run
    });
    if ((stdoutPath !== join(
      run.directory,
      'bootstrap.stdout'
    )) || (stderrPath !== join(
      run.directory,
      'bootstrap.stderr'
    )))
      throw new ProducerInputComparisonError({
        kind: 'output',
        directory: run.directory
      });
    await verifyProducerInputComparisonFile({
      path: stdoutPath,
      expected: stdoutState,
      run,
      failure: 'output',
      l: pl
    });
    await verifyProducerInputComparisonFile({
      path: stderrPath,
      expected: stderrState,
      run,
      failure: 'output',
      l: pl
    });
    if (await metadata(stderrPath) !== '')
      throw new ProducerInputComparisonError({
        kind: 'output',
        directory: run.directory
      });
    /**
     * Strict stdout framing does not allow selection of another retained directory.
     */
    const frame = comparisonMetadata({
      text: await metadata(stdoutPath),
      keys: [
        'kind',
        'directory',
        'completion'
      ],
      directory: run.directory
    });
    if ((frame.kind !== 'producer-preparation-input-host-complete') || (frame.directory !== inputRunDirectory))
      throw new ProducerInputComparisonError({
        kind: 'output',
        directory: run.directory
      });
    /**
     * Metadata parsing is not artifact-identity reserialization.
     */
    const fromStdout = parseProducerInputCompletion({
      text: JSON.stringify(frame.completion),
      runId: inputRunId,
      launchSha256: invocation.derivedLaunchIdentity
        .sha256
    });
    /**
     * The fixed disk completion must agree independently with the observed native frame.
     */
    const completion = parseProducerInputCompletion({
      text: await metadata(join(
        output,
        'complete.json'
      )),
      runId: inputRunId,
      launchSha256: invocation.derivedLaunchIdentity
        .sha256
    });
    /**
     * The native host's retained verification copy is checked through the same shared closed reader.
     */
    const verified = parseProducerInputCompletion({
      text: await metadata(join(
        inputRunDirectory,
        'verified-completion.json'
      )),
      runId: inputRunId,
      launchSha256: invocation.derivedLaunchIdentity
        .sha256
    });
    if ((!isDeepStrictEqual(
      fromStdout,
      completion
    )) || (!isDeepStrictEqual(
      verified,
      completion
    )))
      throw new ProducerInputComparisonError({
        kind: 'output',
        directory: run.directory
      });
    await verifyProducerInputFile({
      path: join(
        inputRunDirectory,
        'launch.json'
      ),
      expected: invocation.derivedLaunchIdentity,
      operation: 'read-launch'
    });
    /**
     * Creation-marker consistency does not authenticate its creator.
     */
    const created = comparisonMetadata({
      text: await metadata(join(
        inputRunDirectory,
        'created.json'
      )),
      keys: [
        'version',
        'kind',
        'runId',
        'launchSha256',
        'launchBytes',
        'uid',
        'gid'
      ],
      directory: run.directory
    });
    if ((created.version !== 1) || (created.kind !== 'producer-preparation-input-created')
      || (created.runId !== inputRunId)
      || (created.launchSha256
        !== invocation.derivedLaunchIdentity
        .sha256)
      || (created.launchBytes
        !== invocation.derivedLaunchIdentity
        .bytes)
      || (created.uid !== run.uid)
      || (created.gid !== run.gid))
      throw new ProducerInputComparisonError({
        kind: 'output',
        directory: run.directory
      });
    /**
     * Native success must retain its non-interrupted cleanup record; this is not a new stopped-state probe.
     */
    const cleanup = comparisonMetadata({
      text: await metadata(join(
        inputRunDirectory,
        'cleanup-complete.json'
      )),
      keys: [
        'version',
        'kind',
        'runId',
        'containerId',
        'removed',
        'absenceChecked',
        'interrupted'
      ],
      directory: run.directory
    });
    if ((cleanup.version !== 1) || (cleanup.kind !== 'producer-preparation-input-cleanup-complete')
      || (cleanup.runId !== inputRunId)
      || (cleanup.removed !== true)
      || (cleanup.absenceChecked !== true)
      || (cleanup.interrupted !== false)
      || (!comparisonHex({
        value: cleanup.containerId,
        length: CONTAINER_ID_WIDTH,
      })))
      throw new ProducerInputComparisonError({
        kind: 'output',
        directory: run.directory
      });
    /**
     * Artifact location is fixed, not selected by the completion body.
     */
    const artifactPath = join(
      output,
      'unqualified-inputs.json'
    );
    /**
     * Hashing observes actual persisted bytes and permissions on the same descriptor.
     */
    const identity = await verifyProducerInputOutputFile({
      path: artifactPath,
      expected: completion.artifact,
      ownerUid: run.uid,
      ownerGid: run.gid
    });
    await comparisonOutputLayout({
      inputRunDirectory,
      inputRunId,
      run
    });
    await verifyProducerInputComparisonRun({
      run,
      l: pl
    });
    await verifyProducerInputComparisonFile({
      path: stdoutPath,
      expected: stdoutState,
      run,
      failure: 'output',
      l: pl
    });
    await verifyProducerInputComparisonFile({
      path: stderrPath,
      expected: stderrState,
      run,
      failure: 'output',
      l: pl
    });
    pl.info('independently verified retained unqualified input files and derived-launch binding');
    return {
      inputRunDirectory,
      inputRunId,
      artifactPath,
      identity
    };
  }
  catch (error) {
    if (Error.isError(error) && (error instanceof ProducerInputComparisonError))
      throw error;
    pl.warn(`retained input verification failed with ${Error.isError(error) ? 'an Error object' : 'a non-Error value'}`);
    throw new ProducerInputComparisonError({
      kind: 'output',
      directory: run.directory
    });
  }
}

//endregion Retained native output is independently observed, never reconstructed from stdout claims
