import {
  type ChildProcess,
  spawn,
} from 'node:child_process';
import { open, } from 'node:fs/promises';
import { join, } from 'node:path';
import { homedir, } from 'node:os';
import {
  clearTimeout,
  setTimeout,
} from 'node:timers';
import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import { producerInputCommandClose, } from './producer-input-command-close.ts';
import { ProducerInputComparisonError, } from './producer-input-comparison-error.ts';
import type { ProducerInputComparisonInvocation, } from './producer-input-comparison-model.ts';
import { verifyProducerInputFile, } from './producer-input-file.ts';
import {
  readProducerRuntimeManifest,
  verifyProducerNodeRuntime,
} from './producer-input-runtime.ts';
import {
  type ProducerInputComparisonRun,
  verifyProducerInputComparisonRun,
  writeProducerInputComparisonRecord,
} from './producer-input-comparison-storage.ts';

//region One fixed bootstrap subprocess with retained streams and actual-close observation

/** Independent whole-bootstrap deadline, not a model-call or provider retry allowance. */
const BOOTSTRAP_DEADLINE_MS = 600_000;
/** Cooperative cleanup has its own bound before forced host-process termination. */
const BOOTSTRAP_TERMINATION_GRACE_MS = 180_000;
/** Streams are private even when the bootstrap fails before producing a completion record. */
const STREAM_MODE = 0o600;

/**
 * Removes interruption listeners and timers without treating an error event as native close.
 * The grace period bounds this caller, not filesystem durability or successful container cleanup.
 *
 * @param child - actual spawned bootstrap process, not copied exit fields
 *
 * @param signal - caller cancellation combined with the independent bootstrap deadline
 *
 * @param l - invoking subprocess owner's logger
 *
 * @returns Scoped interruption ownership
 *
 * @example
 * ```ts
 * using interruption = comparisonBootstrapInterruption({ child, signal, l });
 * ```
 */
function comparisonBootstrapInterruption({
  child,
  signal,
  l,
}: {
  readonly child: Readonly<Pick<ChildProcess, 'exitCode' | 'signalCode' | 'kill'>>;
  readonly signal: AbortSignal;
  readonly l: Logger;
},): Disposable {
  /** All escalation timers belong to this subprocess scope. */
  const timers = new Set<ReturnType<typeof setTimeout>>();
  /** Cancellation telemetry never reads or forwards the caller's abort reason. */
  const pl = tagged({ tag: comparisonBootstrapInterruption.name, l });
  /** Enforces the outer process bound without claiming that inner container cleanup finished. */
  function forceTermination(): void {
    if ((child.exitCode === null) && (child.signalCode === null)) {
      child.kill('SIGKILL');
      pl.warn('forced bootstrap termination after its cooperative cleanup allowance');
    }
  }
  /** A closed child is never signalled again, but the caller still observes late cancellation. */
  function interrupt(): void {
    if ((child.exitCode !== null) || (child.signalCode !== null))
      return;
    child.kill('SIGTERM');
    timers.add(setTimeout(forceTermination, BOOTSTRAP_TERMINATION_GRACE_MS));
    pl.warn('requested bootstrap termination; any completed output remains retained');
  }
  signal.addEventListener('abort', interrupt, { once: true });
  if (signal.aborted)
    interrupt();
  return {
    [Symbol.dispose](): void {
      signal.removeEventListener('abort', interrupt);
      for (const timer of timers)
        clearTimeout(timer);
    },
  };
}

/**
 * Invokes only the independently authenticated standalone preparation-input bootstrap.
 * The process completes before stream synchronization and termination recording;
 * no retry, application selector or provider client is introduced.
 *
 * @param run - fresh private comparison namespace after metadata preflight and creation
 *
 * @param invocation - fixed owner's derived launch and unchanged authenticated bootstrap/runtime bindings
 *
 * @param l - invoking comparison owner's logger
 *
 * @returns Fixed retained stdout and stderr locations after successful native close
 *
 * @throws ProducerInputComparisonError when cancellation, invocation, stream or record handling fails
 *
 * @example
 * ```ts
 * const streams = await invokeProducerInputBootstrap({ run, invocation, l });
 * ```
 */
export async function invokeProducerInputBootstrap({
  run,
  invocation,
  l,
}: {
  readonly run: ProducerInputComparisonRun;
  readonly invocation: ProducerInputComparisonInvocation;
  readonly l: Logger;
},): Promise<{ readonly stdoutPath: string; readonly stderrPath: string; }> {
  /** This operation cannot accept a caller-selected executable or arbitrary environment. */
  const nodePath = process.execPath;
  /** Only rootless local Podman session routing may accompany the fixed host environment. */
  const sessionKeys = ['XDG_RUNTIME_DIR', 'DBUS_SESSION_BUS_ADDRESS'] as const;
  /** No loader options, credentials or complete parent environment are inherited. */
  const environment: Readonly<NodeJS.ProcessEnv> = {
    HOME: homedir(),
    PATH: '/usr/bin:/bin',
    ...Object.fromEntries(sessionKeys.flatMap(function sessionValue(key): readonly (readonly [string, string])[] {
      /** Each optional session primitive is captured once before logging or I/O. */
      const value = process.env[key];
      return value === undefined ? [] : [[key, value]];
    })),
  };
  /** Only operation names and retained paths belong in normal telemetry. */
  const pl = tagged({ tag: invokeProducerInputBootstrap.name, l });
  if (invocation.signal.aborted)
    throw new ProducerInputComparisonError({ kind: 'interruption', directory: run.directory });
  /** Fixed argument grammar cannot select a command, application entry or future live mode. */
  const args = [
    invocation.bootstrapPath,
    '--launch', invocation.derivedLaunchPath,
    '--launch-sha256', invocation.derivedLaunchIdentity.sha256,
    '--launch-bytes', String(invocation.derivedLaunchIdentity.bytes),
  ];
  /** Stream filenames are fixed independently of bootstrap output. */
  const stdoutPath = join(run.directory, 'bootstrap.stdout');
  /** Native diagnostics remain private rather than becoming thrown cause text. */
  const stderrPath = join(run.directory, 'bootstrap.stderr');
  await writeProducerInputComparisonRecord({
    run,
    file: 'bootstrap.command.json',
    value: { version: 1, executable: nodePath, args, deadlineMilliseconds: BOOTSTRAP_DEADLINE_MS, terminationGraceMilliseconds: BOOTSTRAP_TERMINATION_GRACE_MS, environmentKeys: Object.keys(environment).toSorted() },
    l: pl,
  });
  try {
    /** The base-to-derived owner cannot change executable bindings through an output-parent derivation. */
    const manifest = await readProducerRuntimeManifest({ dir: invocation.runtime.dir, expected: invocation.runtime.manifest });
    await verifyProducerNodeRuntime(manifest);
    await verifyProducerInputFile({ path: nodePath, expected: manifest.node.executable, operation: 'verify-runtime' });
    await verifyProducerInputFile({ path: invocation.bootstrapPath, expected: invocation.bootstrapIdentity, operation: 'verify-runtime' });
    await verifyProducerInputComparisonRun({ run, l: pl });
    await using stdout = await open(stdoutPath, 'wx', STREAM_MODE);
    await using stderr = await open(stderrPath, 'wx', STREAM_MODE);
    /** No deadline state is copied into a stale process-result object. */
    const deadline = AbortSignal.timeout(BOOTSTRAP_DEADLINE_MS);
    /** The outer deadline and caller cancellation are independent refusal evidence. */
    const signal = AbortSignal.any([invocation.signal, deadline]);
    if (signal.aborted)
      throw new ProducerInputComparisonError({ kind: 'interruption', directory: run.directory });
    pl.info('starting the fixed provider-free input bootstrap');
    if (signal.aborted)
      throw new ProducerInputComparisonError({ kind: 'interruption', directory: run.directory });
    /** No shell interpolation or inherited environment merge is used. */
    const child = spawn(nodePath, args, {
      cwd: run.directory,
      env: environment,
      stdio: ['ignore', stdout.fd, stderr.fd],
    });
    /** Actual close observation is installed before cancellation forwarding. */
    const closed = producerInputCommandClose(child);
    using interruption = comparisonBootstrapInterruption({ child, signal, l: pl });
    /** Error categories do not end observation before native descriptors close. */
    const errors = await closed;
    await stdout.sync();
    await stderr.sync();
    await writeProducerInputComparisonRecord({
      run,
      file: 'bootstrap.exit.json',
      value: { version: 1, code: child.exitCode, signal: child.signalCode, errors, callerAborted: invocation.signal.aborted, deadlineReached: deadline.aborted },
      l: pl,
    });
    if (signal.aborted)
      throw new ProducerInputComparisonError({ kind: 'interruption', directory: run.directory });
    if ((child.exitCode !== 0) || (child.signalCode !== null) || (errors.length > 0))
      throw new ProducerInputComparisonError({ kind: 'bootstrap', directory: run.directory });
    pl.info('input bootstrap closed successfully; persisted output still requires independent verification');
    return { stdoutPath, stderrPath };
  }
  catch (error) {
    if (error instanceof ProducerInputComparisonError)
      throw error;
    pl.warn(`bootstrap invocation failed with ${Error.isError(error) ? 'an Error object' : 'a non-Error value'}; native details remain in private records`);
    throw new ProducerInputComparisonError({ kind: 'bootstrap', directory: run.directory });
  }
}

//endregion One fixed bootstrap subprocess with retained streams and actual-close observation
