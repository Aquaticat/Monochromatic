import {
  lstat,
  readFile,
  readdir,
  statfs,
} from 'node:fs/promises';
import { networkInterfaces, } from 'node:os';
import { isDeepStrictEqual, } from 'node:util';
import { verifyProducerInputChildMounts, } from './producer-input-child-mounts.ts';
import {
  PRODUCER_INPUT_CHILD_SENTINEL,
  PRODUCER_INPUT_LIMITS,
} from './producer-input-container.ts';
import type { ProducerInputChildIdentity, } from './producer-input-environment.ts';
import { ProducerInputRunError, } from './producer-input-error.ts';
import { PRODUCER_INPUT_PATHS, } from './producer-input-paths.ts';

//region Child execution observations before application import

/**
 * Group/other permissions cannot expose writable private state.
 */
const NON_PRIVATE_BITS = 0o077;
/**
 * Linux capability fields independently constrain effective and recoverable privilege.
 */
const CAPABILITY_FIELDS: readonly string[] = [
  'CapInh',
  'CapPrm',
  'CapEff',
  'CapBnd',
  'CapAmb'
];
/**
 * The measured Linux capability words contain no enabled capability.
 */
const EMPTY_CAPABILITIES = '0000000000000000';

/**
 * Reads the fixed resource values rather than trusting requested container arguments.
 *
 * @throws ProducerInputRunError when an actual cgroup or temporary-storage allowance differs
 *
 * @example
 * ```ts
 * await verifyChildResources();
 * ```
 */
async function verifyChildResources(): Promise<void> {
  /**
   * Expected cgroup values come from the specialized invocation, not supplied JSON.
   */
  const expected: Readonly<Record<string, string>> = {
    'memory.max': String(PRODUCER_INPUT_LIMITS.memoryBytes),
    'memory.swap.max': String(PRODUCER_INPUT_LIMITS.memoryAndSwapBytes - PRODUCER_INPUT_LIMITS.memoryBytes),
    'cpu.max': `${PRODUCER_INPUT_LIMITS.cpuQuota} ${PRODUCER_INPUT_LIMITS.cpuPeriod}`,
    'pids.max': String(PRODUCER_INPUT_LIMITS.pids),
  };
  /**
   * This fixed metadata set cannot expand with findings or input cardinality.
   */
  const observed = await Promise.all(Object.entries(expected)
    .map(async function resource([name, value]): Promise<boolean> {
    return (await readFile(`/sys/fs/cgroup/${name}`, 'utf8')).trim() === value;
  }));
  /**
   * Temporary-space size is observed through its mounted filesystem, not an environment hint.
   */
  const temporary = await statfs(
    '/tmp',
    { bigint: true }
  );
  if (observed.some(function differs(value): boolean { return !value; })
    || (temporary.bsize * temporary.blocks) !== BigInt(PRODUCER_INPUT_LIMITS.temporaryBytes))
    throw new ProducerInputRunError({
      operation: 'verify-runtime',
      locator: 'child resource limits',
    });
}

/**
 * Checks process-level privilege restrictions without retaining unrelated status fields.
 *
 * @throws ProducerInputRunError when privilege or capability state differs
 *
 * @example
 * ```ts
 * await verifyChildPrivileges();
 * ```
 */
async function verifyChildPrivileges(): Promise<void> {
  /**
   * Kernel process metadata contains no corpus or provider reply body.
   */
  const lines = (await readFile(
    '/proc/self/status',
    'utf8'
  )).split('\n');
  /**
   * Only the fixed fields used by this gate are retained.
   */
  const fields = Object.fromEntries(lines.flatMap(function field(line): readonly (readonly [
    string,
    string
  ])[] {
    /**
     * Status fields have one name/value separator; value whitespace is not semantically significant here.
     */
    const separator = line.indexOf(':');
    /**
     * Unrelated process metadata never enters a diagnostic.
     */
    const name = line.slice(
      0,
      separator
    );
    if ((separator < 0) || (name !== 'NoNewPrivs') && (!CAPABILITY_FIELDS.includes(name)))
      return [];
    return [[
      name,
      line.slice(separator + 1).trim()
    ]];
  }));
  if ((fields.NoNewPrivs !== '1') || CAPABILITY_FIELDS.some(function enabled(name): boolean { return fields[name] !== EMPTY_CAPABILITIES; }))
    throw new ProducerInputRunError({
      operation: 'verify-runtime',
      locator: 'child privilege state',
    });
}

/**
 * Verifies the still-empty application namespace, not a reusable result directory.
 *
 * @param identity - host UID binding already checked against the child environment
 *
 * @throws ProducerInputRunError when output ownership, privacy or initial contents differ
 *
 * @example
 * ```ts
 * await verifyChildOutput(identity);
 * ```
 */
async function verifyChildOutput(identity: ProducerInputChildIdentity): Promise<void> {
  /**
   * Output and home are checked independently rather than relying on the parent's privacy.
   */
  const states = await Promise.all([
    PRODUCER_INPUT_PATHS.output,
    PRODUCER_INPUT_PATHS.home
  ].map(async function directory(path): Promise<boolean> {
    /**
     * Symlink leaves cannot substitute for host-created directories.
     */
    const state = await lstat(path);
    return state.isDirectory() && state.uid === identity.callerUid
      && (state.mode & NON_PRIVATE_BITS) === 0;
  }));
  if (states.some(function differs(value): boolean { return !value; })
    || (!isDeepStrictEqual(await readdir(PRODUCER_INPUT_PATHS.output), ['home']))
    || (await readdir(PRODUCER_INPUT_PATHS.home)).length > 0)
    throw new ProducerInputRunError({
      operation: 'verify-runtime',
      locator: 'child output namespace',
    });
}

/**
 * Observes the complete fixed child process context before any application import.
 * Host image, bootstrap, Node and library selection remain pre-start responsibilities.
 *
 * @param identity - owned primitive host bindings from the exact child environment
 *
 * @throws ProducerInputRunError when executable context, isolation or writable namespace differs
 *
 * @example
 * ```ts
 * await verifyProducerInputChildContext(identity);
 * ```
 */
export async function verifyProducerInputChildContext(identity: ProducerInputChildIdentity): Promise<void> {
  if ((process.platform !== 'linux') || (process.arch !== 'x64') || (process.execPath !== PRODUCER_INPUT_PATHS.node)
    || (process.execArgv.length !== 0) || (process.cwd() !== PRODUCER_INPUT_PATHS.output)
    || (!isDeepStrictEqual(process.argv.slice(1), [PRODUCER_INPUT_PATHS.bootstrap, PRODUCER_INPUT_CHILD_SENTINEL]))
    || (typeof process.getuid) !== 'function' || (process.getuid() !== identity.callerUid)
    || (typeof process.getgid) !== 'function' || (process.getgid() !== identity.callerGid))
    throw new ProducerInputRunError({
      operation: 'verify-runtime',
      locator: 'child execution context',
    });
  /**
   * Network-none is checked through actual interface state, not inferred from the launch request.
   */
  const interfaces = networkInterfaces();
  if ((!isDeepStrictEqual(Object.keys(interfaces), ['lo'])) || Object.values(interfaces).some(function external(addresses): boolean {
    return (addresses === undefined) || addresses.some(function routed(address): boolean { return !address.internal; });
  }))
    throw new ProducerInputRunError({
      operation: 'verify-runtime',
      locator: 'child network namespace',
    });
  try {
    await verifyProducerInputChildMounts();
    await verifyChildResources();
    await verifyChildPrivileges();
    await verifyChildOutput(identity);
  }
  catch (error) {
    if (error instanceof ProducerInputRunError)
      throw error;
    throw new ProducerInputRunError({
      operation: 'verify-runtime',
      locator: 'child context metadata',
    });
  }
}

//endregion Child execution observations before application import
