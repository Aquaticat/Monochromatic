import { ProducerInputRunError, } from './producer-input-error.ts';
import type { ProducerInputCompletion, } from './producer-input-model.ts';

//region Completion syntax shared by the producer and its persisted-output consumer

/**
 * Raw SHA-256 identity width does not come from supplied completion content.
 */
const SHA256_WIDTH = 64;

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
 * Parses completion against independently owned run and launch primitives.
 * Filesystem observation and artifact hashing remain with the I/O owner;
 * this reader never turns a completion record into a creation or review certificate.
 *
 * @param text - bounded completion JSON, never logged as a parse diagnostic
 *
 * @param runId - current exclusive run identity established outside the supplied completion
 *
 * @param launchSha256 - independently matched launch digest for that run
 *
 * @returns Owned completion metadata with no phase or writer authority
 *
 * @throws ProducerInputRunError when identity or schema differs
 *
 * @example
 * ```ts
 * const completion = parseProducerInputCompletion({ text, runId, launchSha256 });
 * ```
 */
export function parseProducerInputCompletion({
  text,
  runId,
  launchSha256,
}: {
  readonly text: string;
  readonly runId: string;
  readonly launchSha256: string;
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
      || (value.runId !== runId)
      || (value.launchSha256 !== launchSha256)
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
      runId,
      launchSha256,
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

//endregion Completion syntax shared by the producer and its persisted-output consumer
