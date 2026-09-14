import {
  fieldMatches,
  inspectionRecord,
  record,
  strings,
} from './producer-input-inspect-fields.ts';
import { callerMapping, } from './producer-input-inspect-mapping.ts';
import { isDeepStrictEqual, } from 'node:util';
import { verifyCreatedBindings, } from './producer-input-inspect-bindings.ts';
import {
  PRODUCER_INPUT_CHILD_SENTINEL,
  PRODUCER_INPUT_LIMITS,
} from './producer-input-container.ts';
import {
  producerInputChildEnvironment,
  PRODUCER_INPUT_HOSTNAME,
} from './producer-input-environment.ts';
import { ProducerInputRunError, } from './producer-input-error.ts';
import type { ProducerInputHost, } from './producer-input-host-init.ts';
import { PRODUCER_INPUT_PATHS, } from './producer-input-paths.ts';

//region Native created-container evidence before Node startup

/**
 * Default capabilities removed by the pinned Podman implementation's ALL request.
 */
const REMOVED_CAPABILITIES = [
  'CAP_CHOWN',
  'CAP_DAC_OVERRIDE',
  'CAP_FOWNER',
  'CAP_FSETID',
  'CAP_KILL',
  'CAP_NET_BIND_SERVICE',
  'CAP_SETFCAP',
  'CAP_SETGID',
  'CAP_SETPCAP',
  'CAP_SETUID',
  'CAP_SYS_CHROOT'
] as const;

/**
 * Cross-checks native creation metadata before starting the fixed Node process.
 * This is point-in-time host observation, not protection against a hostile host replacing the container afterward.
 *
 * @param host - one initialized host owner
 *
 * @param id - identity returned by this run's successful exclusive create operation
 *
 * @param text - bounded native inspection response
 *
 * @throws ProducerInputRunError when image, command, environment, resource or mount bindings differ
 *
 * @example
 * ```ts
 * verifyCreatedProducerInputContainer({ host, id, text });
 * ```
 */
export function verifyCreatedProducerInputContainer({
  host,
  id,
  text,
}: {
  readonly host: ProducerInputHost;
  readonly id: string;
  readonly text: string
},): void {
  /**
   * No complete inspection object is logged before its environment and mounts are checked.
   */
  const inspection = inspectionRecord(text);
  for (const [name, expected] of Object.entries({
    Id: id,
    Image: host.launch
      .imageId,
    Name: `producer-input-${host.run
      .runId}`,
    Path: PRODUCER_INPUT_PATHS.node,
    Args: [
      PRODUCER_INPUT_PATHS.bootstrap,
      PRODUCER_INPUT_CHILD_SENTINEL
    ]
  }))
    fieldMatches({
      fields: inspection,
      name,
      expected
    });
  /**
   * These native records are checked before any nested field receives a typed interpretation.
   */
  const {
    Config: config,
    HostConfig: limits,
    State: state
  } = inspection;
  if ((!record(config)) || (!record(limits))
    || (!record(state)))
    throw new ProducerInputRunError({
      operation: 'launch-container',
      locator: 'created container records',
    });
  fieldMatches({
    fields: state,
    name: 'Status',
    expected: 'created'
  });
  fieldMatches({
    fields: state,
    name: 'Running',
    expected: false
  });
  for (const [name, expected] of Object.entries({
    User: `${host.run
      .uid}:${host.run
        .gid}`,
    WorkingDir: PRODUCER_INPUT_PATHS.output,
    Hostname: PRODUCER_INPUT_HOSTNAME,
    Entrypoint: [PRODUCER_INPUT_PATHS.node],
    Cmd: [
      PRODUCER_INPUT_PATHS.bootstrap,
      PRODUCER_INPUT_CHILD_SENTINEL
    ]
  }))
    fieldMatches({
      fields: config,
      name,
      expected
    });
  fieldMatches({
    fields: config,
    name: 'Timeout',
    expected: PRODUCER_INPUT_LIMITS.seconds
  });
  fieldMatches({
    fields: config,
    name: 'Healthcheck',
    expected: { Test: ['NONE'] }
  });
  fieldMatches({
    fields: config,
    name: 'HealthcheckOnFailureAction',
    expected: 'none'
  });
  fieldMatches({
    fields: limits,
    name: 'UsernsMode',
    expected: 'private'
  });
  if (!record(limits.IDMappings))
    throw new ProducerInputRunError({
      operation: 'launch-container',
      locator: 'created user namespace mappings',
    });
  callerMapping({
    value: limits.IDMappings
      .UidMap,
    caller: host.run
      .uid,
    name: 'UidMap'
  });
  callerMapping({
    value: limits.IDMappings
      .GidMap,
    caller: host.run
      .gid,
    name: 'GidMap'
  });
  /**
   * Environment values are independently reconstructed, not accepted merely because names are familiar.
   */
  const environment = producerInputChildEnvironment({
    runId: host.run
      .runId,
    launchSha256: host.launchIdentity
      .sha256,
    launchBytes: host.launchIdentity
      .bytes,
    callerUid: host.run
      .uid,
    callerGid: host.run
      .gid
  });
  if (!isDeepStrictEqual(
    strings({
      value: config.Env,
      name: 'Env'
    }),
    Object.entries(environment)
      .map(function entry([name, value]): string { return `${name}=${value}`; })
      .toSorted()
  ))
    throw new ProducerInputRunError({
      operation: 'launch-container',
      locator: 'created child environment',
    });
  for (const [name, expected] of Object.entries({
    NetworkMode: 'none',
    Memory: PRODUCER_INPUT_LIMITS.memoryBytes,
    MemorySwap: PRODUCER_INPUT_LIMITS.memoryAndSwapBytes,
    CpuPeriod: PRODUCER_INPUT_LIMITS.cpuPeriod,
    CpuQuota: PRODUCER_INPUT_LIMITS.cpuQuota,
    PidsLimit: PRODUCER_INPUT_LIMITS.pids,
    ReadonlyRootfs: true,
    Privileged: false,
    AutoRemove: false,
    CapAdd: []
  }))
    fieldMatches({
      fields: limits,
      name,
      expected
    });
  if ((!isDeepStrictEqual(
    strings({
      value: limits.CapDrop,
      name: 'CapDrop'
    }),
    REMOVED_CAPABILITIES.toSorted()
  ))
    || (!isDeepStrictEqual(
      strings({
        value: limits.SecurityOpt,
        name: 'SecurityOpt'
      }),
      [
        'label=disable',
        'no-new-privileges'
      ]
    )))
    throw new ProducerInputRunError({
      operation: 'launch-container',
      locator: 'created privilege configuration',
    });
  if ((!record(limits.Tmpfs)) || (Object.keys(limits.Tmpfs)
    .length
    !== 1)
    || ((typeof limits.Tmpfs['/tmp']) !== 'string')
    || (!isDeepStrictEqual(
      limits.Tmpfs['/tmp']
        .split(',')
        .toSorted(),
      [
        'rw',
        'noexec',
        'nosuid',
        'nodev',
        `size=${PRODUCER_INPUT_LIMITS.temporaryBytes}`,
        'rprivate',
        'tmpcopyup'
      ].toSorted()
    )))
    throw new ProducerInputRunError({
      operation: 'launch-container',
      locator: 'created temporary filesystem',
    });
  verifyCreatedBindings({
    host,
    value: inspection.Mounts
  });
}

/**
 * Current native state is not represented by fabricated optional exit fields.
 */
export type ProducerInputContainerState = { readonly state: 'created'; } | { readonly state: 'running'; } | {
  /**
   * Native process lifecycle has ended.
   */
  readonly state: 'exited';
  /**
   * Native exit status, including the runtime's negative termination sentinel.
   */
  readonly exitCode: number;
  /**
   * Runtime-reported OOM status supplements, not replaces, retained resource evidence.
   */
  readonly oomKilled: boolean;
};

/**
 * Reads current state only for the container returned by this run's create operation.
 *
 * @param host - owning launch and run
 *
 * @param id - already verified created container identity
 *
 * @param text - bounded terminal inspection
 *
 * @returns Native terminal evidence without returning the environment or other unconsumed fields
 *
 * @throws ProducerInputRunError when identity or terminal state cannot be established
 *
 * @example
 * ```ts
 * const terminal = readProducerInputContainerTerminal({ host, id, text });
 * ```
 */
export function readProducerInputContainerTerminal({
  host,
  id,
  text,
}: {
  readonly host: ProducerInputHost;
  readonly id: string;
  readonly text: string
},): ProducerInputContainerState {
  /**
   * Terminal inspection cannot select a different container by name alone.
   */
  const inspection = inspectionRecord(text);
  fieldMatches({
    fields: inspection,
    name: 'Id',
    expected: id
  });
  fieldMatches({
    fields: inspection,
    name: 'Image',
    expected: host.launch
      .imageId
  });
  fieldMatches({
    fields: inspection,
    name: 'Name',
    expected: `producer-input-${host.run
      .runId}`
  });
  /**
   * The host stops running containers before recording their terminal state or removing them.
   */
  const state = inspection.State;
  if (!record(state))
    throw new ProducerInputRunError({
      operation: 'launch-container',
      locator: 'container state',
    });
  if ((state.Running === true) && (state.Status === 'running'))
    return { state: 'running' };
  if ((state.Running === false) && (state.Status === 'created'))
    return { state: 'created' };
  if ((state.Running !== false) || (state.Status !== 'exited')
    || ((typeof state.ExitCode) !== 'number')
    || (!Number.isSafeInteger(state.ExitCode))
    || ((typeof state.OOMKilled) !== 'boolean'))
    throw new ProducerInputRunError({
      operation: 'launch-container',
      locator: 'container terminal state',
    });
  return {
    state: 'exited',
    exitCode: state.ExitCode,
    oomKilled: state.OOMKilled
  };
}

//endregion Native created-container evidence before Node startup
