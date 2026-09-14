import { join, } from 'node:path';
import {
  lstat,
  readdir,
} from 'node:fs/promises';
import { isDeepStrictEqual, } from 'node:util';
import { ProducerInputRunError, } from './producer-input-error.ts';
import {
  readProducerInputMetadata,
  verifyProducerInputOutputFile,
} from './producer-input-file.ts';
import type { ProducerInputHost, } from './producer-input-host-init.ts';
import type { ProducerInputCompletion, } from './producer-input-model.ts';

/**
 * Completion metadata is bounded separately from the corpus-derived artifact it describes.
 */
const MAX_COMPLETION_BYTES = 1_048_576;
/**
 * Raw SHA-256 identity width does not come from supplied completion content.
 */
const SHA256_WIDTH = 64;
/**
 * Completed output retains the exact private directory mode, without special permission bits.
 */
const OUTPUT_DIRECTORY_MODE = 0o700;
/**
 * Permission comparison includes special bits rather than only group/other access.
 */
const PERMISSION_MASK = 0o7777;

/**
 * Checks a closed native JSON record before its fields receive authority.
 *
 * @param value - decoded completion field
 *
 * @param keys - fixed schema keys
 *
 * @returns Checked native JSON record
 *
 * @throws ProducerInputRunError when object or key shape differs
 *
 * @example
 * ```ts
 * const valid = completionRecord({ value, keys: ['file', 'bytes', 'sha256'] });
 * ```
 */
function completionRecord({
  value,
  keys,
}: {
  readonly value: unknown;
  readonly keys: readonly string[]
},): Readonly<Record<string, unknown>> {
  if (((typeof value) !== 'object') || (value === null)
    || Array.isArray(value))
    throw new ProducerInputRunError({
      operation: 'read-output',
      locator: 'completion record',
    });
  /**
   * Native own-property projection preserves unknown values without asserting a record shape.
   */
  const fields: Readonly<Record<string, unknown>> = Object.fromEntries(Object.entries(value));
  if ((Object.keys(fields)
    .length
    !== keys.length) || (!keys.every(function present(key): boolean { return Object.hasOwn(
    fields,
    key
  ); })))
    throw new ProducerInputRunError({
      operation: 'read-output',
      locator: 'completion record',
    });
  return fields;
}

/**
 * Checks the artifact identity without accepting alternate digest spellings.
 *
 * @param value - decoded SHA-256 field
 *
 * @returns Whether its spelling is canonical
 *
 * @example
 * ```ts
 * const valid = completionDigest(value);
 * ```
 */
function completionDigest(value: unknown): value is string {
  if (((typeof value) !== 'string') || (value.length !== SHA256_WIDTH))
    return false;
  for (let index = 0; index < value.length; index += 1) {
    if (!'0123456789abcdef'.includes(value.charAt(index)))
      return false;
  }
  return true;
}

/**
 * Parses completion only as internal consistency evidence for this exact unqualified input run.
 *
 * @param text - bounded completion JSON, never logged as a parse diagnostic
 *
 * @param host - independent run and launch identity
 *
 * @returns Owned completion metadata with no phase or writer authority
 *
 * @throws ProducerInputRunError when identity or schema differs
 *
 * @example
 * ```ts
 * const completion = parseProducerInputCompletion({ text, host });
 * ```
 */
function parseProducerInputCompletion({
  text,
  host,
}: {
  readonly text: string;
  readonly host: ProducerInputHost
},): ProducerInputCompletion {
  try {
    /**
     * Decoder output remains unknown until every consumed field is checked.
     */
    const decoded: unknown = JSON.parse(text);
    /**
     * Root keys are owned before any nested identity is interpreted.
     */
    const value = completionRecord({
      value: decoded,
      keys: [
        'version',
        'kind',
        'runId',
        'launchSha256',
        'artifact',
        'parentCount',
        'registrationCount'
      ]
    });
    /**
     * Artifact identity describes an existing fixed filename, never another output path.
     */
    const artifact = completionRecord({
      value: value.artifact,
      keys: [
        'file',
        'bytes',
        'sha256'
      ]
    });
    if ((value.version !== 1) || (value.kind !== 'producer-preparation-input-complete')
      || (value.runId
        !== host.run
        .runId)
      || (value.launchSha256
        !== host.launchIdentity
        .sha256)
      || (artifact.file !== 'unqualified-inputs.json')
      || ((typeof artifact.bytes) !== 'number')
      || (!Number.isSafeInteger(artifact.bytes))
      || (artifact.bytes <= 0)
      || (!completionDigest(artifact.sha256))
      || ((typeof value.parentCount) !== 'number')
      || (!Number.isSafeInteger(value.parentCount))
      || (value.parentCount <= 0)
      || ((typeof value.registrationCount) !== 'number')
      || (!Number.isSafeInteger(value.registrationCount))
      || (value.registrationCount < value.parentCount))
      throw new ProducerInputRunError({
        operation: 'read-output',
        locator: 'complete.json',
      });
    return {
      version: 1,
      kind: 'producer-preparation-input-complete',
      runId: host.run
        .runId,
      launchSha256: host.launchIdentity
        .sha256,
      artifact: {
        file: 'unqualified-inputs.json',
        bytes: artifact.bytes,
        sha256: artifact.sha256
      },
      parentCount: value.parentCount,
      registrationCount: value.registrationCount
    };
  }
  catch (error) {
    if (error instanceof ProducerInputRunError)
      throw error;
    throw new ProducerInputRunError({
      operation: 'read-output',
      locator: 'complete.json',
    });
  }
}

/**
 * Checks only the exact allowed output inventory and caller-owned private directories.
 *
 * @param host - owning run identity
 *
 * @throws ProducerInputRunError when extra files, home contents, ownership or modes differ
 *
 * @example
 * ```ts
 * await completionDirectories(host);
 * ```
 */
async function completionDirectories(host: ProducerInputHost): Promise<void> {
  try {
    await Promise.all([
      host.run
        .outputDir,
      join(
        host.run
          .outputDir,
        'home'
      )
    ].map(async function verifyDirectory(path): Promise<void> {
      /**
       * Directory checks do not follow a symlink leaf or accept a different group.
       */
      const state = await lstat(path);
      if ((!state.isDirectory()) || (state.uid
        !== host.run
        .uid)
        || (state.gid
          !== host.run
          .gid)
        || ((state.mode & PERMISSION_MASK) !== OUTPUT_DIRECTORY_MODE))
        throw new ProducerInputRunError({
          operation: 'read-output',
          locator: path,
        });
    }));
    if ((!isDeepStrictEqual(
      (await readdir(host.run
        .outputDir)).toSorted(),
      [
        'complete.json',
        'home',
        'unqualified-inputs.json'
      ]
    )) || ((await readdir(join(
      host.run
        .outputDir,
      'home'
    ))).length > 0))
      throw new ProducerInputRunError({
        operation: 'read-output',
        locator: 'output inventory',
      });
  }
  catch (error) {
    if (error instanceof ProducerInputRunError)
      throw error;
    throw new ProducerInputRunError({
      operation: 'read-output',
      locator: 'output directories',
    });
  }
}

/**
 * Checks the private output and its internal completion identity without loading corpus-derived bodies.
 * Complete producer output is retained even when this consistency check fails.
 *
 * @param host - owning launch and exclusive output
 *
 * @returns Internally consistent unqualified metadata, never review or execution authority
 *
 * @throws ProducerInputRunError when inventory, identity, ownership or modes differ
 *
 * @example
 * ```ts
 * const completion = await verifyProducerInputCompletion(host);
 * ```
 */
export async function verifyProducerInputCompletion(host: ProducerInputHost): Promise<ProducerInputCompletion> {
  await completionDirectories(host);
  /**
   * Completion has its own metadata ceiling; artifact hashing remains streamed.
   */
  const text = await readProducerInputMetadata({
    path: join(
      host.run
        .outputDir,
      'complete.json'
    ),
    maximumBytes: MAX_COMPLETION_BYTES,
    ownerUid: host.run
      .uid,
    ownerGid: host.run
      .gid,
    operation: 'read-output'
  });
  /**
   * Run identity is reconstructed from host-owned state rather than accepted from a completion certificate.
   */
  const completion = parseProducerInputCompletion({
    text,
    host
  });
  await verifyProducerInputOutputFile({
    path: join(
      host.run
        .outputDir,
      completion.artifact
        .file
    ),
    expected: completion.artifact,
    ownerUid: host.run
      .uid,
    ownerGid: host.run
      .gid
  });
  await completionDirectories(host);
  return completion;
}
