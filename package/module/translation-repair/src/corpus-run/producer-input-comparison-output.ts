import {
  lstat,
  readdir,
  realpath,
} from 'node:fs/promises';
import { join, } from 'node:path';
import { isDeepStrictEqual, } from 'node:util';
import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import { parseProducerInputCompletion, } from './producer-input-completion-record.ts';
import type { ProducerInputComparisonChildObservation, } from './producer-input-comparison-child.ts';
import { ProducerInputComparisonError, } from './producer-input-comparison-error.ts';
import type { ProducerInputComparisonInvocation, } from './producer-input-comparison-model.ts';
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

/** Completion and command metadata have a ceiling separate from artifact body hashing. */
const METADATA_LIMIT = 1_048_576;
/** Input runs use the existing fixed native prefix. */
const RUN_PREFIX = 'producer-input-';
/** Namespace grammar is structural identity only, not creation authentication. */
const UUID_GROUP_WIDTHS = [8, 4, 4, 4, 12] as const;
/** Directory privacy includes special bits, not only group/other access. */
const DIRECTORY_MODE = 0o700n;
/** Complete permission mask for BigInt filesystem observations. */
const MODE_MASK = 0o7777n;
/** Native container identities use canonical lowercase SHA-256 spelling. */
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
  /** Observed dedicated-parent child, never an arbitrary stdout-selected path. */
  readonly inputRunDirectory: string;
  /** Canonical native input-run identifier, not a preparation-attempt identity. */
  readonly inputRunId: string;
  /** Fixed retained artifact location. */
  readonly artifactPath: string;
  /** Independently observed persisted bytes, not metadata accepted without hashing. */
  readonly identity: ProducerInputFileIdentity;
};

/**
 * Reads closed JSON metadata without forwarding native parser messages.
 *
 * @param text - bounded private native metadata
 *
 * @param keys - exact role-specific keys
 *
 * @param directory - owned comparison evidence locator
 *
 * @returns Owned parsed fields for explicit binding checks
 *
 * @throws ProducerInputComparisonError when syntax or closed shape differs
 *
 * @example
 * ```ts
 * const frame = comparisonMetadata({ text, keys, directory });
 * ```
 */
function comparisonMetadata({
  text,
  keys,
  directory,
}: {
  readonly text: string;
  readonly keys: readonly string[];
  readonly directory: string;
},): Readonly<Record<string, unknown>> {
  try {
    /** Native JSON parsing does not expose caller getters or prototype methods. */
    const value: unknown = JSON.parse(text);
    if ((typeof value !== 'object') || (value === null) || Array.isArray(value))
      throw new ProducerInputComparisonError({ kind: 'output', directory });
    /** Unknown fields cannot become execution or review authority. */
    const fields: Readonly<Record<string, unknown>> = Object.fromEntries(Object.entries(value));
    if ((Object.keys(fields).length !== keys.length) || !keys.every(function present(key): boolean { return Object.hasOwn(fields, key); }))
      throw new ProducerInputComparisonError({ kind: 'output', directory });
    return fields;
  }
  catch (error) {
    if (Error.isError(error) && error instanceof ProducerInputComparisonError)
      throw error;
    throw new ProducerInputComparisonError({ kind: 'output', directory });
  }
}

/**
 * Checks bounded ASCII identity syntax without code-point or grapheme iteration.
 *
 * @param value - decoded identity or UUID group
 *
 * @param length - fixed width required by its role
 *
 * @returns Whether exact width and lowercase hexadecimal spelling both match
 *
 * @example
 * ```ts
 * const valid = comparisonHex({ value, length: CONTAINER_ID_WIDTH });
 * ```
 */
function comparisonHex({ value, length }: {
  readonly value: unknown;
  readonly length: number;
},): boolean {
  if ((typeof value !== 'string') || (value.length !== length))
    return false;
  for (let index = 0; index < value.length; index += 1) {
    if (!'0123456789abcdef'.includes(value.charAt(index)))
      return false;
  }
  return true;
}

/**
 * Requires one directory with the native canonical UUIDv4 spelling before constructing a retained path.
 *
 * @param observation - bounded direct-child metadata from the dedicated native output parent
 *
 * @param directory - comparison evidence locator for a refusal
 *
 * @returns Canonical input-run identity without granting creation authenticity
 *
 * @throws ProducerInputComparisonError when observation or namespace grammar differs
 *
 * @example
 * ```ts
 * const runId = comparisonInputRunId({ observation, directory });
 * ```
 */
function comparisonInputRunId({
  observation,
  directory,
}: {
  readonly observation: ProducerInputComparisonChildObservation;
  readonly directory: string;
},): string {
  /** The single-child branch must still prove that its entry is a directory. */
  const child = observation.children[0];
  if ((observation.state !== 'single') || !observation.completeEnumeration
    || (observation.children.length !== 1) || (child === undefined)
    || (child.kind !== 'directory') || !child.name.startsWith(RUN_PREFIX))
    throw new ProducerInputComparisonError({ kind: 'output', directory });
  /** Removing a fixed prefix does not normalize the identifier. */
  const runId = child.name.slice(RUN_PREFIX.length);
  /** Exact group widths prevent traversal and alternate UUID spellings. */
  const groups = runId.split('-');
  /**
   * Presence, version and variant remain explicit independently of the group-width check.
   */
  const [version, variant] = groups.slice(2);
  if ((groups.length !== UUID_GROUP_WIDTHS.length)
    || !UUID_GROUP_WIDTHS.every(function validGroup(width, index): boolean {
      return comparisonHex({ value: groups[index], length: width });
    })
    || (version === undefined) || !version.startsWith('4')
    || (variant === undefined) || !'89ab'.includes(variant.charAt(0)))
    throw new ProducerInputComparisonError({ kind: 'output', directory });
  return runId;
}

/**
 * Verifies current private directory metadata without following a symlink leaf.
 *
 * @param path - fixed role inside the dedicated retained run
 *
 * @param run - independently captured comparison ownership
 *
 * @throws ProducerInputComparisonError when canonical identity, entry kind or permissions differ
 *
 * @example
 * ```ts
 * await comparisonOutputDirectory({ path, run });
 * ```
 */
async function comparisonOutputDirectory({ path, run }: {
  readonly path: string;
  readonly run: ProducerInputComparisonRun;
},): Promise<void> {
  /** Point-in-time observations are not leases or creator authentication. */
  const state = await lstat(path, { bigint: true });
  if (!state.isDirectory() || (state.uid !== BigInt(run.uid)) || (state.gid !== BigInt(run.gid))
    || ((state.mode & MODE_MASK) !== DIRECTORY_MODE) || (await realpath(path) !== path))
    throw new ProducerInputComparisonError({ kind: 'output', directory: run.directory });
}

/**
 * Rechecks every fixed directory inventory before and after streamed artifact observation.
 *
 * @param inputRunDirectory - independently associated native run
 *
 * @param inputRunId - canonical observed namespace identity
 *
 * @param run - comparison ownership and dedicated native parent
 *
 * @throws ProducerInputComparisonError when directory privacy or a closed inventory differs
 *
 * @example
 * ```ts
 * await comparisonOutputLayout({ inputRunDirectory, inputRunId, run });
 * ```
 */
async function comparisonOutputLayout({ inputRunDirectory, inputRunId, run }: {
  readonly inputRunDirectory: string;
  readonly inputRunId: string;
  readonly run: ProducerInputComparisonRun;
},): Promise<void> {
  /** Output paths remain fixed independently of completion fields. */
  const output = join(inputRunDirectory, 'output');
  /** Child home is an empty private role, not application cache storage. */
  const home = join(output, 'home');
  await Promise.all([inputRunDirectory, output, home].map(async function verify(path): Promise<void> { await comparisonOutputDirectory({ path, run }); }));
  if (!isDeepStrictEqual(await readdir(run.inputParent), [`${RUN_PREFIX}${inputRunId}`])
    || !isDeepStrictEqual((await readdir(output)).toSorted(), ['complete.json', 'home', 'unqualified-inputs.json'])
    || ((await readdir(home)).length !== 0))
    throw new ProducerInputComparisonError({ kind: 'output', directory: run.directory });
}

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
 * @param l - invoking comparison owner's logger
 *
 * @returns Independently observed retained artifact files, still unqualified
 *
 * @throws ProducerInputComparisonError when any file, shape or lineage check fails
 *
 * @example
 * ```ts
 * const files = await readProducerInputComparisonOutput({ run, invocation, observation, stdoutPath, stderrPath, l });
 * ```
 */
export async function readProducerInputComparisonOutput({
  run,
  invocation,
  observation,
  stdoutPath,
  stderrPath,
  l,
}: {
  readonly run: ProducerInputComparisonRun;
  readonly invocation: ProducerInputComparisonInvocation;
  readonly observation: ProducerInputComparisonChildObservation;
  readonly stdoutPath: string;
  readonly stderrPath: string;
  readonly l: Logger;
},): Promise<ProducerInputReconstructionFiles> {
  /** Independent file verification never logs corpus-derived bytes. */
  const pl = tagged({ tag: readProducerInputComparisonOutput.name, l });
  try {
    await verifyProducerInputComparisonRun({ run, l: pl });
    /** Identity comes from the dedicated parent's observed child, not success stdout. */
    const inputRunId = comparisonInputRunId({ observation, directory: run.directory });
    /** The parent and generated prefix are already fixed by this operation. */
    const inputRunDirectory = join(run.inputParent, `${RUN_PREFIX}${inputRunId}`);
    /** Only the native output directory can contain the unqualified artifact. */
    const output = join(inputRunDirectory, 'output');
    await comparisonOutputLayout({ inputRunDirectory, inputRunId, run });
    /** Shared descriptor observer supplies the same metadata bound and ownership checks for each fixed role. */
    async function metadata(path: string): Promise<string> {
      return await readProducerInputMetadata({ path, maximumBytes: METADATA_LIMIT, ownerUid: run.uid, ownerGid: run.gid, operation: 'read-output' });
    }
    if ((stdoutPath !== join(run.directory, 'bootstrap.stdout')) || (stderrPath !== join(run.directory, 'bootstrap.stderr'))
      || (await metadata(stderrPath) !== ''))
      throw new ProducerInputComparisonError({ kind: 'output', directory: run.directory });
    /** Strict stdout framing does not allow selection of another retained directory. */
    const frame = comparisonMetadata({ text: await metadata(stdoutPath), keys: ['kind', 'directory', 'completion'], directory: run.directory });
    if ((frame.kind !== 'producer-preparation-input-host-complete') || (frame.directory !== inputRunDirectory))
      throw new ProducerInputComparisonError({ kind: 'output', directory: run.directory });
    /** Metadata parsing is not artifact-identity reserialization. */
    const fromStdout = parseProducerInputCompletion({ text: JSON.stringify(frame.completion), runId: inputRunId, launchSha256: invocation.derivedLaunchIdentity.sha256 });
    /** The fixed disk completion must agree independently with the observed native frame. */
    const completion = parseProducerInputCompletion({ text: await metadata(join(output, 'complete.json')), runId: inputRunId, launchSha256: invocation.derivedLaunchIdentity.sha256 });
    /** The native host's retained verification copy is checked through the same shared closed reader. */
    const verified = parseProducerInputCompletion({ text: await metadata(join(inputRunDirectory, 'verified-completion.json')), runId: inputRunId, launchSha256: invocation.derivedLaunchIdentity.sha256 });
    if (!isDeepStrictEqual(fromStdout, completion) || !isDeepStrictEqual(verified, completion))
      throw new ProducerInputComparisonError({ kind: 'output', directory: run.directory });
    await verifyProducerInputFile({ path: join(inputRunDirectory, 'launch.json'), expected: invocation.derivedLaunchIdentity, operation: 'read-launch' });
    /** Creation-marker consistency does not authenticate its creator. */
    const created = comparisonMetadata({ text: await metadata(join(inputRunDirectory, 'created.json')), keys: ['version', 'kind', 'runId', 'launchSha256', 'launchBytes', 'uid', 'gid'], directory: run.directory });
    if ((created.version !== 1) || (created.kind !== 'producer-preparation-input-created')
      || (created.runId !== inputRunId) || (created.launchSha256 !== invocation.derivedLaunchIdentity.sha256)
      || (created.launchBytes !== invocation.derivedLaunchIdentity.bytes) || (created.uid !== run.uid) || (created.gid !== run.gid))
      throw new ProducerInputComparisonError({ kind: 'output', directory: run.directory });
    /** Native success must retain its non-interrupted cleanup record; this is not a new stopped-state probe. */
    const cleanup = comparisonMetadata({ text: await metadata(join(inputRunDirectory, 'cleanup-complete.json')), keys: ['version', 'kind', 'runId', 'containerId', 'removed', 'absenceChecked', 'interrupted'], directory: run.directory });
    if ((cleanup.version !== 1) || (cleanup.kind !== 'producer-preparation-input-cleanup-complete')
      || (cleanup.runId !== inputRunId) || (cleanup.removed !== true) || (cleanup.absenceChecked !== true)
      || (cleanup.interrupted !== false)
      || !comparisonHex({ value: cleanup.containerId, length: CONTAINER_ID_WIDTH }))
      throw new ProducerInputComparisonError({ kind: 'output', directory: run.directory });
    /** Artifact location is fixed, not selected by the completion body. */
    const artifactPath = join(output, 'unqualified-inputs.json');
    /** Hashing observes actual persisted bytes and permissions on the same descriptor. */
    const identity = await verifyProducerInputOutputFile({ path: artifactPath, expected: completion.artifact, ownerUid: run.uid, ownerGid: run.gid });
    await comparisonOutputLayout({ inputRunDirectory, inputRunId, run });
    await verifyProducerInputComparisonRun({ run, l: pl });
    pl.info('independently verified retained unqualified input files and derived-launch binding');
    return { inputRunDirectory, inputRunId, artifactPath, identity };
  }
  catch (error) {
    if (Error.isError(error) && error instanceof ProducerInputComparisonError)
      throw error;
    pl.warn(`retained input verification failed with ${Error.isError(error) ? 'an Error object' : 'a non-Error value'}`);
    throw new ProducerInputComparisonError({ kind: 'output', directory: run.directory });
  }
}

//endregion Retained native output is independently observed, never reconstructed from stdout claims
