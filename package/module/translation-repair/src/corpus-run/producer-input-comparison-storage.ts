import { randomUUID, } from 'node:crypto';
import {
  lstat,
  mkdir,
  open,
  readdir,
  realpath,
} from 'node:fs/promises';
import { join, } from 'node:path';
import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import { ProducerInputComparisonError, } from './producer-input-comparison-error.ts';
import type { ProducerInputFileIdentity, } from './producer-input-file.ts';

//region Fixed comparison records remain outside completed producer namespaces

/**
 * Private directory permissions include no special or shared-access bits.
 */
const DIRECTORY_MODE = 0o700;
/**
 * Every comparison record is created without group or other access.
 */
const FILE_MODE = 0o600;
/**
 * Permissions are compared with special bits included.
 */
const MODE_MASK = 0o7777;
/**
 * Comparison metadata does not consume the separate corpus/support byte allowance.
 */
const MAX_RECORD_BYTES = 1_048_576;
/**
 * No caller-supplied filename can turn this writer into a general output interface.
 */
const RECORD_FILES = [
  'created.json',
  'bootstrap.command.json',
  'bootstrap.exit.json',
  'bootstrap-observation.json',
  'derivation.json',
  'child-observation.json',
  'comparison.json',
  'failure.json'
] as const;

/**
 * Owned directory observation belongs to this invocation, not a caller certificate.
 *
 * @example
 * ```ts
 * const path = run.directory;
 * ```
 */
export type ProducerInputComparisonRun = {
  /**
   * Exclusive comparison namespace, never the completed input-run directory.
   */
  readonly directory: string;
  /**
   * Dedicated initially empty parent associates retained input runs even without success stdout.
   */
  readonly inputParent: string;
  /**
   * Observed child-parent inode is distinct from the comparison directory's identity.
   */
  readonly inputParentInode: bigint;
  /**
   * Fresh comparison identifier is not an acquisition-attempt identity.
   */
  readonly runId: string;
  /**
   * Independently captured caller ownership.
   */
  readonly uid: number;
  /**
   * Independently captured caller group.
   */
  readonly gid: number;
  /**
   * Observed device is compared only with another filesystem observation.
   */
  readonly device: bigint;
  /**
   * Directory replacement is checked before each fixed record write.
   */
  readonly inode: bigint;
};

/**
 * Rechecks the created directory without claiming hostile-host immunity or a filesystem lease.
 *
 * @param run - owned creation observation
 *
 * @param l - invoking record owner's logger
 *
 * @throws ProducerInputComparisonError when directory observation, identity or privacy differs
 *
 * @example
 * ```ts
 * await verifyProducerInputComparisonRun({ run, l });
 * ```
 */
export async function verifyProducerInputComparisonRun({
  run,
  l,
}: {
  readonly run: ProducerInputComparisonRun;
  readonly l: Logger;
},): Promise<void> {
  /**
   * No filesystem error body is needed to describe a refused directory observation.
   */
  const pl = tagged({
    tag: verifyProducerInputComparisonRun.name,
    l
  });
  try {
    /**
     * Both directory identities remain owned while the child adds its input-run namespace.
     */
    const directories = [
      {
        path: run.directory,
        inode: run.inode
      },
      {
        path: run.inputParent,
        inode: run.inputParentInode
      },
    ];
    for (const directory of directories) {
      /**
       * Metadata checks neither follow a leaf symlink nor read a corpus-derived body.
       */
      const state = await lstat(
        directory.path,
        { bigint: true }
      );
      if ((!state.isDirectory()) || (state.dev !== run.device) || (state.ino !== directory.inode)
        || (state.uid !== BigInt(run.uid)) || (state.gid !== BigInt(run.gid))
        || ((state.mode & BigInt(MODE_MASK)) !== BigInt(DIRECTORY_MODE))
        || (await realpath(directory.path) !== directory.path))
        throw new ProducerInputComparisonError({
          kind: 'storage',
          directory: run.directory
        });
    }
    pl.debug('verified comparison directory identity and privacy');
  }
  catch (error) {
    pl.warn(`comparison directory observation failed with ${Error.isError(error) ? 'an Error object' : 'a non-Error value'}`);
    throw new ProducerInputComparisonError({
      kind: 'storage',
      directory: run.directory
    });
  }
}

/**
 * Persists one fixed record exclusively and synchronizes its content before returning.
 * Existing output and partial records are never removed or overwritten on failure.
 *
 * @param run - private namespace created by this operation
 *
 * @param file - fixed record role, not an input-selected locator
 *
 * @param value - owned JSON metadata without environment values or corpus contents
 *
 * @param l - invoking operation logger
 *
 * @throws ProducerInputComparisonError when observation, serialization, exclusive write or sync fails
 *
 * @example
 * ```ts
 * await writeProducerInputComparisonRecord({ run, file: 'comparison.json', value, l });
 * ```
 */
export async function writeProducerInputComparisonRecord({
  run,
  file,
  value,
  l,
}: {
  readonly run: ProducerInputComparisonRun;
  readonly file: typeof RECORD_FILES[number];
  readonly value: Readonly<Record<string, unknown>>;
  readonly l: Logger;
},): Promise<void> {
  /**
   * Fixed role telemetry never serializes the record payload into logs.
   */
  const pl = tagged({
    tag: writeProducerInputComparisonRecord.name,
    l
  });
  try {
    if (!RECORD_FILES.includes(file))
      throw new ProducerInputComparisonError({
        kind: 'storage',
        directory: run.directory
      });
    await verifyProducerInputComparisonRun({
      run,
      l: pl
    });
    /**
     * Serialize before exclusive creation so over-bound metadata does not create an empty record.
     */
    const text = JSON.stringify(value);
    if (Buffer.byteLength(
      text,
      'utf8'
    ) > MAX_RECORD_BYTES)
      throw new ProducerInputComparisonError({
        kind: 'storage',
        directory: run.directory
      });
    pl.debug(`writing exclusive comparison record ${JSON.stringify(file)}`);
    /**
     * Exclusive record descriptor preserves existing and partial metadata on every failure path.
     */
    await using handle = await open(
      join(run.directory, file),
      'wx',
      FILE_MODE
    );
    await handle.writeFile(
      text,
      'utf8'
    );
    await handle.sync();
    await verifyProducerInputComparisonRun({
      run,
      l: pl
    });
  }
  catch (error) {
    pl.warn(`comparison record ${JSON.stringify(file)} failed with ${Error.isError(error) ? 'an Error object' : 'a non-Error value'}; existing evidence retained`);
    throw new ProducerInputComparisonError({
      kind: 'storage',
      directory: run.directory
    });
  }
}

/**
 * Creates one private comparison namespace after its caller's metadata-only launch preflight.
 * This is neither a preparation attempt nor permission to construct a provider client.
 *
 * @param parent - authorized canonical output parent from the matched input launch
 *
 * @param baseLaunchIdentity - independently matched base launch metadata
 *
 * @param reference - separately retained input artifact identity
 *
 * @param l - invoking operation logger
 *
 * @returns Exclusive directory observation after creation-marker content synchronization
 *
 * @throws ProducerInputComparisonError when ownership, creation or marker persistence fails
 *
 * @example
 * ```ts
 * const run = await createProducerInputComparisonRun({ parent, baseLaunchIdentity, reference, l });
 * ```
 */
export async function createProducerInputComparisonRun({
  parent,
  baseLaunchIdentity,
  reference,
  l,
}: {
  readonly parent: string;
  readonly baseLaunchIdentity: ProducerInputFileIdentity;
  readonly reference: ProducerInputFileIdentity;
  readonly l: Logger;
},): Promise<ProducerInputComparisonRun> {
  /**
   * Capture supported native ownership before logging or filesystem work.
   */
  const uid = process.getuid?.();
  /**
   * Group is independently required rather than guessed from user identity.
   */
  const gid = process.getgid?.();
  if ((uid === undefined) || (gid === undefined))
    throw new ProducerInputComparisonError({ kind: 'contract' });
  /**
   * Fresh random identity never reopens a previous comparison.
   */
  const runId = randomUUID();
  /**
   * Only a generated child name is added to the authorized output parent.
   */
  const directory = join(
    parent,
    `producer-input-comparison-${runId}`
  );
  /**
   * Namespace telemetry names no input document or provider body.
   */
  const pl = tagged({
    tag: createProducerInputComparisonRun.name,
    l
  });
  try {
    await mkdir(
      directory,
      { mode: DIRECTORY_MODE }
    );
    /**
     * Creation identity is retained for point-in-time replacement checks.
     */
    const state = await lstat(
      directory,
      { bigint: true }
    );
    /**
     * A dedicated native output parent removes ambiguity after bootstrap failure or timeout.
     */
    const inputParent = join(
      directory,
      'producer-runs'
    );
    await mkdir(
      inputParent,
      { mode: DIRECTORY_MODE }
    );
    /**
     * Parent identity is retained independently of the comparison directory.
     */
    const inputParentState = await lstat(
      inputParent,
      { bigint: true }
    );
    if ((await readdir(inputParent)).length > 0)
      throw new ProducerInputComparisonError({
        kind: 'storage',
        directory
      });
    /**
     * Only current observations, not self-asserted marker fields, drive later writes.
     */
    const run: ProducerInputComparisonRun = {
      directory,
      inputParent,
      inputParentInode: inputParentState.ino,
      runId,
      uid,
      gid,
      device: state.dev,
      inode: state.ino
    };
    await writeProducerInputComparisonRecord({
      run,
      file: 'created.json',
      value: {
        version: 1,
        kind: 'producer-preparation-input-comparison-created',
        runId,
        baseLaunchIdentity,
        reference,
        inputParent
      },
      l: pl,
    });
    pl.info(`created retained input comparison ${JSON.stringify(runId)}`);
    return run;
  }
  catch (error) {
    pl.warn(`comparison namespace creation failed with ${Error.isError(error) ? 'an Error object' : 'a non-Error value'}; no existing namespace is reused`);
    throw new ProducerInputComparisonError({
      kind: 'storage',
      directory
    });
  }
}

//endregion Fixed comparison records remain outside completed producer namespaces
