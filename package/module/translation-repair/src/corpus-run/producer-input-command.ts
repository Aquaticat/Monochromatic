import { spawn, } from 'node:child_process';
import { once, } from 'node:events';
import { open, } from 'node:fs/promises';
import { join, } from 'node:path';
import { ProducerInputRunError, } from './producer-input-error.ts';
import { readProducerInputMetadata, } from './producer-input-file.ts';
import type { ProducerInputHost, } from './producer-input-host-init.ts';

//region Finite native Podman stages owned by one input reconstruction

/** Each fixed command stage has one exclusive record and cannot be retried in place. */
export type ProducerInputCommandStage = 'image' | 'create' | 'inspect-created' | 'start' | 'stop' | 'inspect-terminal' | 'remove';
/** Native metadata must not allocate an unbounded response on the host. */
const MAX_METADATA_BYTES = 1_048_576;
/** Native command records carry no corpus bodies and remain private. */
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
async function commandRecord({ path, text, }: { readonly path: string; readonly text: string; },): Promise<void> {
  await using file = await open(path, 'wx', PRIVATE_MODE);
  await file.writeFile(text, 'utf8');
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
export async function runProducerInputCommand({ host, stage, arguments_, signal, }: {
  readonly host: ProducerInputHost;
  readonly stage: ProducerInputCommandStage;
  readonly arguments_: readonly string[];
  readonly signal: AbortSignal;
},): Promise<void> {
  /** Stage names are closed in both runtime and declaration space. */
  const stages: readonly ProducerInputCommandStage[] = ['image', 'create', 'inspect-created', 'start', 'stop', 'inspect-terminal', 'remove'];
  if (!stages.includes(stage))
    throw new ProducerInputRunError({ operation: 'launch-container', locator: 'native stage', });
  /** Record paths cannot be selected through an argv value. */
  const prefix = join(host.run.dir, stage);
  /** Owned argv preserves the invocation even if a caller changes an array during I/O. */
  const argv = [...host.podman.prefix, ...arguments_];
  try {
    await commandRecord({ path: `${prefix}.command.json`, text: JSON.stringify({ stage, executable: host.launch.podman.path, argv }) });
    await using stdout = await open(`${prefix}.stdout`, 'wx', PRIVATE_MODE);
    await using stderr = await open(`${prefix}.stderr`, 'wx', PRIVATE_MODE);
    if (signal.aborted) {
      await commandRecord({ path: `${prefix}.exit.json`, text: JSON.stringify({ stage, state: 'cancelled-before-spawn' }) });
      throw new ProducerInputRunError({ operation: 'launch-container', locator: stage, });
    }
    /** The independently checked binary is invoked directly without PATH or a shell. */
    const child = spawn(host.launch.podman.path, argv, { cwd: host.run.dir, env: host.podman.environment, stdio: ['ignore', stdout.fd, stderr.fd] });
    /** Register close immediately so an error or signal cannot masquerade as a successful result. */
    const closed = once(child, 'close');
    /** Cancellation requests termination of the attached native client; the owner settles the container afterward. */
    function interrupt(): void {
      child.kill('SIGTERM');
    }
    signal.addEventListener('abort', interrupt, { once: true });
    /** Native signal listeners never outlive their single stage. */
    using _listener = {
      [Symbol.dispose](): void {
        signal.removeEventListener('abort', interrupt);
      },
    };
    if (signal.aborted)
      interrupt();
    try {
      await closed;
    }
    catch (error) {
      await commandRecord({ path: `${prefix}.exit.json`, text: JSON.stringify({ stage, state: 'spawn-error', nativeError: error instanceof Error ? error.name : 'non-error throw' }) });
      throw new ProducerInputRunError({ operation: 'launch-container', locator: stage, });
    }
    await stdout.sync();
    await stderr.sync();
    await commandRecord({ path: `${prefix}.exit.json`, text: JSON.stringify({ stage, state: 'closed', code: child.exitCode, signal: child.signalCode, cancelled: signal.aborted }) });
    if (child.exitCode !== 0 || child.signalCode !== null || signal.aborted)
      throw new ProducerInputRunError({ operation: 'launch-container', locator: stage, });
  }
  catch (error) {
    if (error instanceof ProducerInputRunError)
      throw error;
    throw new ProducerInputRunError({ operation: 'launch-container', locator: stage, });
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
export async function readProducerInputCommand({ host, stage, }: {
  readonly host: ProducerInputHost;
  readonly stage: 'image' | 'create' | 'inspect-created' | 'inspect-terminal';
},): Promise<string> {
  /** The fixed native role determines its output path. */
  const path = join(host.run.dir, `${stage}.stdout`);
  try {
    return await readProducerInputMetadata({ path, maximumBytes: MAX_METADATA_BYTES, ownerUid: host.run.uid, operation: 'launch-container' });
  }
  catch (error) {
    if (error instanceof ProducerInputRunError)
      throw error;
    throw new ProducerInputRunError({ operation: 'launch-container', locator: stage, });
  }
}

//endregion Finite native Podman stages owned by one input reconstruction
