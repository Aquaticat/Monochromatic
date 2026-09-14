import { spawn, } from 'node:child_process';
import { open, } from 'node:fs/promises';
import { join, } from 'node:path';
import {
  PRODUCER_INPUT_COMMAND_TIMES,
  PRODUCER_INPUT_METADATA_BYTES,
} from './producer-input-bounds.ts';
import { producerInputCommandClose, } from './producer-input-command-close.ts';
import { interruptProducerInputCommand, } from './producer-input-command-interrupt.ts';
import { ProducerInputRunError, } from './producer-input-error.ts';
import { readProducerInputMetadata, } from './producer-input-file.ts';
import type { ProducerInputHost, } from './producer-input-host-init.ts';

//region Finite native Podman stages owned by one input reconstruction

/**
 * Each fixed command stage has one exclusive record and cannot be retried in place.
 */
export type ProducerInputCommandStage = 'image' | 'create' | 'inspect-created' | 'start' | 'stop' | 'inspect-terminal' | 'inspect-stopped' | 'remove' | 'verify-removed';
/**
 * Native command records carry no corpus bodies and remain private.
 */
const PRIVATE_MODE = 0o600;

/**
 * Writes one exclusive synchronized native-command metadata file.
 *
 * @param path - fixed stage-owned file path
 *
 * @param text - owned command metadata, never a provider payload
 *
 * @throws ProducerInputRunError when private stage evidence cannot be retained
 *
 * @example
 * ```ts
 * await commandRecord({ path, text });
 * ```
 */
async function commandRecord({
  path,
  text,
}: {
  readonly path: string;
  readonly text: string
},): Promise<void> {
  /**
   * Exclusive descriptor keeps one command record independent from any existing file.
   */
  await using file = await open(
    path,
    'wx',
    PRIVATE_MODE
  );
  await file.writeFile(
    text,
    'utf8'
  );
  await file.sync();
}

/**
 * Executes one fixed host-owned Podman stage and retains command, output and termination before returning.
 * The owning caller supplies only its predefined image/create/inspect/start/stop/remove operations.
 * There is no public arbitrary-command or live-provider entry.
 *
 * @param host - cross-bound initialized host context
 *
 * @param stage - unique finite command role
 *
 * @param arguments_ - native argv built by the owning stage, never shell text
 *
 * @param signal - owning host cancellation; cleanup uses a separate uncancelled signal
 *
 * @throws ProducerInputRunError when cancellation, spawn or native status prevents completion
 *
 * @example
 * ```ts
 * await runProducerInputCommand({ host, stage: 'start', arguments_, signal });
 * ```
 */
export async function runProducerInputCommand({
  host,
  stage,
  arguments_,
  signal,
}: {
  readonly host: ProducerInputHost;
  readonly stage: ProducerInputCommandStage;
  readonly arguments_: readonly string[];
  readonly signal: AbortSignal;
},): Promise<void> {
  /**
   * Stage names are closed in both runtime and declaration space.
   */
  const stages: readonly ProducerInputCommandStage[] = [
    'image',
    'create',
    'inspect-created',
    'start',
    'stop',
    'inspect-terminal',
    'inspect-stopped',
    'remove',
    'verify-removed'
  ];
  if (!stages.includes(stage))
    throw new ProducerInputRunError({
      operation: 'launch-container',
      locator: 'native stage',
    });
  /**
   * Record paths cannot be selected through an argv value.
   */
  const prefix = join(
    host.run
      .dir,
    stage
  );
  /**
   * Owned argv preserves the invocation even if a caller changes an array during I/O.
   */
  const argv = [
    ...host.podman
      .prefix,
    ...arguments_
  ];
  /**
   * Native command lifetime is bounded independently from the container's own execution timeout.
   */
  const timeoutMilliseconds = stage === 'start' ? PRODUCER_INPUT_COMMAND_TIMES.attachedMilliseconds : PRODUCER_INPUT_COMMAND_TIMES.metadataMilliseconds;
  /**
   * Deadline is separate from caller interruption so records retain both causes.
   */
  const deadline = AbortSignal.timeout(timeoutMilliseconds);
  /**
   * Either cause stops this one native stage, without cancelling later cleanup.
   */
  const effective = AbortSignal.any([
    signal,
    deadline
  ]);
  try {
    await commandRecord({
      path: `${prefix}.command.json`,
      text: JSON.stringify({
        stage,
        executable: host.launch
          .podman
          .path,
        argv,
        timeoutMilliseconds
      })
    });
    /**
     * Native stdout remains private and owned until actual process close.
     */
    await using stdout = await open(
      `${prefix}.stdout`,
      'wx',
      PRIVATE_MODE
    );
    /**
     * Native diagnostics are retained independently from their public names-only rendering.
     */
    await using stderr = await open(
      `${prefix}.stderr`,
      'wx',
      PRIVATE_MODE
    );
    if (effective.aborted) {
      await commandRecord({
        path: `${prefix}.exit.json`,
        text: JSON.stringify({
          stage,
          state: 'cancelled-before-spawn',
          interrupted: signal.aborted,
          deadlineExpired: deadline.aborted
        })
      });
      throw new ProducerInputRunError({
        operation: 'launch-container',
        locator: stage,
      });
    }
    /**
     * The independently checked binary is invoked directly without PATH or a shell.
     */
    const child = spawn(
      host.launch
        .podman
        .path,
      argv,
      {
        cwd: host.run
          .dir,
        env: host.podman
          .environment,
        stdio: [
          'ignore',
          stdout.fd,
          stderr.fd
        ]
      }
    );
    /**
     * An earlier native error cannot detach the actual close observation.
     */
    const closed = producerInputCommandClose(child);
    /**
     * Native interruption resources never outlive this stage's close observation.
     */
    using _listener = interruptProducerInputCommand({
      child,
      signal: effective
    });
    /**
     * Native output descriptors and error evidence remain owned until actual close.
     */
    const nativeErrors = await closed;
    await stdout.sync();
    await stderr.sync();
    await commandRecord({
      path: `${prefix}.exit.json`,
      text: JSON.stringify({
        stage,
        state: 'closed',
        code: child.exitCode,
        signal: child.signalCode,
        interrupted: signal.aborted,
        deadlineExpired: deadline.aborted,
        nativeErrors
      })
    });
    if (nativeErrors.length > 0)
      throw new ProducerInputRunError({
        operation: 'launch-container',
        locator: stage,
      });
    /**
     * Podman's fixed absence query succeeds with its documented nonexistence code.
     */
    const expectedExitCode = stage === 'verify-removed' ? 1 : 0;
    if ((child.exitCode !== expectedExitCode) || (child.signalCode !== null)
      || effective.aborted)
      throw new ProducerInputRunError({
        operation: 'launch-container',
        locator: stage,
      });
    if ((stage !== 'start') && ((await stderr.stat()).size > 0))
      throw new ProducerInputRunError({
        operation: 'launch-container',
        locator: `native diagnostics during ${stage}`,
      });
  }
  catch (error) {
    if (error instanceof ProducerInputRunError)
      throw error;
    throw new ProducerInputRunError({
      operation: 'launch-container',
      locator: stage,
    });
  }
}

/**
 * Reads only bounded metadata from an already completed native stage.
 * This function never reads application stdout or stderr as a JSON result.
 *
 * @param host - owning private run
 *
 * @param stage - metadata-producing stage
 *
 * @returns Exact native UTF-8 metadata after extent and file-shape checks
 *
 * @throws ProducerInputRunError when metadata cannot be read within the declared internal bound
 *
 * @example
 * ```ts
 * const text = await readProducerInputCommand({ host, stage: 'image' });
 * ```
 */
export async function readProducerInputCommand({
  host,
  stage,
}: {
  readonly host: ProducerInputHost;
  readonly stage: 'image' | 'create' | 'inspect-created' | 'inspect-terminal' | 'inspect-stopped';
},): Promise<string> {
  /**
   * The fixed native role determines its output path.
   */
  const path = join(
    host.run
      .dir,
    `${stage}.stdout`
  );
  try {
    return await readProducerInputMetadata({
      path,
      maximumBytes: PRODUCER_INPUT_METADATA_BYTES,
      ownerUid: host.run
        .uid,
      ownerGid: host.run
        .gid,
      operation: 'launch-container'
    });
  }
  catch (error) {
    if (error instanceof ProducerInputRunError)
      throw error;
    throw new ProducerInputRunError({
      operation: 'launch-container',
      locator: stage,
    });
  }
}

//endregion Finite native Podman stages owned by one input reconstruction
