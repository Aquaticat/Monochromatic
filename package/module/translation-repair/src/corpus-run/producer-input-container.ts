import { producerInputBindings, type ProducerInputBinding, } from './producer-input-bindings.ts';
import { producerInputChildEnvironment, PRODUCER_INPUT_HOSTNAME, } from './producer-input-environment.ts';
import type { ProducerInputHost, } from './producer-input-host-init.ts';
import { PRODUCER_INPUT_PATHS, } from './producer-input-paths.ts';

//region Fixed no-network input container contract

/** Only the owning host path inserts this private child-mode sentinel. */
export const PRODUCER_INPUT_CHILD_SENTINEL = '--sealed-preparation-child';
/** Host and child agree on one bounded reconstruction envelope. */
export const PRODUCER_INPUT_LIMITS = {
  /** Hard resident-memory allowance. */
  memoryBytes: 2_147_483_648,
  /** Combined memory-plus-swap request retains the measured 2 GiB swap allowance. */
  memoryAndSwapBytes: 4_294_967_296,
  /** CPU quota is checked independently from its period. */
  cpuQuota: 200_000,
  /** Explicit period avoids interpreting an unspecified native default. */
  cpuPeriod: 100_000,
  /** Process count remains independent of input cardinality. */
  pids: 512,
  /** A stopped host cannot leave an unbounded reconstruction container. */
  seconds: 300,
  /** Temporary storage cannot become an unbounded writable input channel. */
  temporaryBytes: 67_108_864,
} as const;

/**
 * Encodes Podman's CSV grammar at the final bind-mount syntax boundary.
 *
 * @param source - independently authorized canonical host path
 *
 * @param target - fixed child role path
 *
 * @param writable - only private output permits writes
 *
 * @returns Native mount argument, never shell text
 *
 * @example
 * ```ts
 * const argument = producerInputMount({ source, target: '/runtime', writable: false });
 * ```
 */
function producerInputMount({ source, target, writable, }: ProducerInputBinding): string {
  return ['type=bind', `source=${source}`, `target=${target}`, writable ? 'rw' : 'ro'].map(function quoted(field): string {
    return `"${field.replaceAll('"', '""')}"`;
  }).join(',');
}

/**
 * Creates only the fixed input-reconstruction container, which the host inspects before starting Node.
 * All paths and identities derive from one initialized host owner rather than independent caller arguments.
 *
 * @param host - cross-bound launch, run, executables and private output
 *
 * @returns Native Podman creation arguments with no arbitrary entry or live operation
 *
 * @example
 * ```ts
 * const arguments_ = producerInputContainerArgs(host);
 * ```
 */
export function producerInputContainerArgs(host: ProducerInputHost): readonly string[] {
  /** Exact environment is shared with the child validator, not inherited from the host or image. */
  const environment = producerInputChildEnvironment({
    runId: host.run.runId,
    launchSha256: host.launchIdentity.sha256,
    launchBytes: host.launchIdentity.bytes,
    callerUid: host.run.uid,
    callerGid: host.run.gid,
  });
  return [
    'create', '--pull=never', '--name', `producer-input-${host.run.runId}`, '--cidfile', host.run.containerIdPath,
    '--network=none', '--memory', String(PRODUCER_INPUT_LIMITS.memoryBytes),
    '--memory-swap', String(PRODUCER_INPUT_LIMITS.memoryAndSwapBytes),
    '--cpu-period', String(PRODUCER_INPUT_LIMITS.cpuPeriod), '--cpu-quota', String(PRODUCER_INPUT_LIMITS.cpuQuota),
    '--pids-limit', String(PRODUCER_INPUT_LIMITS.pids), '--timeout', String(PRODUCER_INPUT_LIMITS.seconds),
    '--read-only', '--read-only-tmpfs=false', '--cap-drop=ALL', '--security-opt=no-new-privileges', '--security-opt=label=disable',
    '--userns=keep-id', '--no-healthcheck', '--image-volume=ignore', '--systemd=false', '--unsetenv-all', '--http-proxy=false',
    '--hostname', PRODUCER_INPUT_HOSTNAME,
    '--tmpfs', `/tmp:rw,noexec,nosuid,nodev,size=${String(PRODUCER_INPUT_LIMITS.temporaryBytes)}`,
    '--workdir', PRODUCER_INPUT_PATHS.output, '--entrypoint', PRODUCER_INPUT_PATHS.node,
    ...Object.entries(environment).flatMap(function env([name, value]): readonly string[] { return ['--env', `${name}=${value}`]; }),
    ...producerInputBindings(host).flatMap(function mount(binding): readonly string[] { return ['--mount', producerInputMount(binding)]; }),
    host.launch.imageId, PRODUCER_INPUT_PATHS.bootstrap, PRODUCER_INPUT_CHILD_SENTINEL,
  ];
}

//endregion Fixed no-network input container contract
