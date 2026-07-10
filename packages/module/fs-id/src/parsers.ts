/**
 * Linear parsers and identity-shape validation for platform command output.
 *
 * @module
 */

import type {
  FsId,
  FsIdSource,
} from './types.ts';

/**
 * Maximum accepted platform payload length.
 *
 * @example
 * ```ts
 * const bounded = value.length <= MAX_PAYLOAD_LENGTH;
 * ```
 */
const MAX_PAYLOAD_LENGTH = 512;

/**
 * ASCII characters accepted in normalized platform payloads.
 *
 * @example
 * ```ts
 * SAFE_PAYLOAD_CHARACTERS.includes('a');
 * ```
 */
const SAFE_PAYLOAD_CHARACTERS = 'abcdefghijklmnopqrstuvwxyz0123456789-.';

/**
 * ASCII whitespace that terminates a Windows serial token.
 *
 * @example
 * ```ts
 * SERIAL_TERMINATORS.has('\n');
 * ```
 */
const SERIAL_TERMINATORS: ReadonlySet<string> = new Set([
  ' ',
  '\t',
  '\n',
  '\r',
  '\f',
  '\v',
],);

/**
 * Case-insensitive Windows `vol` serial label.
 *
 * @example
 * ```ts
 * output.toLowerCase().includes(SERIAL_LABEL);
 * ```
 */
const SERIAL_LABEL = 'serial number is';

/**
 * Stable prefixes used by generated identifiers.
 *
 * @example
 * ```ts
 * SOURCE_PREFIXES['fs-uuid'];
 * ```
 */
const SOURCE_PREFIXES: Readonly<Record<FsIdSource, string>> = {
  'fs-uuid': 'fs-uuid_',
  'volume-uuid': 'volume-uuid_',
  'volume-serial': 'volume-serial_',
  'f-fsid': 'f-fsid_',
  'device-number': 'device-number_',
};

/**
 * Checks canonical payload grammar without throwing.
 *
 * @param value - Canonical payload candidate
 *
 * @returns Whether payload is lowercase safe ASCII
 *
 * @example
 * ```ts
 * isNormalizedIdentityPayload('1a2b-3c4d'); // true
 * ```
 */
function isNormalizedIdentityPayload(value: string,): boolean {
  if ((value.length === 0)
    || (value.length > MAX_PAYLOAD_LENGTH)
    || (value === '-')
    || (value !== value.trim())
    || (value !== value.toLowerCase())) {
    return false;
  }
  for (const character of value) {
    if (!SAFE_PAYLOAD_CHARACTERS.includes(character,))
      return false;
  }
  return true;
}

/**
 * Normalizes and validates one command-supplied identity payload.
 *
 * @param value - Untrusted command output token
 *
 * @returns Lowercase safe payload
 *
 * @throws when payload is empty or unsafe
 *
 * @example
 * ```ts
 * normalizeIdentityPayload(' 1A2B-3C4D '); // '1a2b-3c4d'
 * ```
 */
export function normalizeIdentityPayload(value: string,): string {
  /**
   * Trimmed lowercase representation used by trust keys.
   */
  const normalized = value.trim()
    .toLowerCase();
  if (!isNormalizedIdentityPayload(normalized,))
    throw new TypeError('invalid filesystem identity payload',);
  return normalized;
}

/**
 * Checks whether string follows generated filesystem-ID grammar.
 *
 * @param value - Candidate identifier
 *
 * @returns Whether value has known source prefix and safe payload
 *
 * @example
 * ```ts
 * isFsId('volume-serial_1a2b-3c4d'); // true
 * ```
 */
export function isFsId(value: string,): value is FsId {
  return Object.values(SOURCE_PREFIXES,)
    .some(function prefixMatches(prefix,): boolean {
      if (!value.startsWith(prefix,))
        return false;
      return isNormalizedIdentityPayload(value.slice(prefix.length,),);
    },);
}

/**
 * Asserts generated filesystem-ID grammar.
 *
 * @param value - Candidate identifier
 *
 * @returns Nothing after narrowing value to generated identity
 *
 * @throws when value does not have generated shape
 *
 * @example
 * ```ts
 * assertFsId('fs-uuid_abcd');
 * ```
 */
export function assertFsId(value: string,): asserts value is FsId {
  if (!isFsId(value,))
    throw new TypeError('invalid generated filesystem identity',);
}

/**
 * Creates a source-qualified colon-free identity.
 *
 * @param source - Mechanism that produced payload
 *
 * @param payload - Validated platform value
 *
 * @returns Branded identity
 *
 * @throws when payload is unsafe or empty
 *
 * @example
 * ```ts
 * createFsId({ source: 'fs-uuid', payload: 'ABCD' });
 * ```
 */
export function createFsId({
  source,
  payload,
}: {
  readonly source: FsIdSource;
  readonly payload: string;
},): FsId {
  /**
   * Source-qualified canonical string before assertion narrowing.
   */
  const candidate = `${SOURCE_PREFIXES[source]}${normalizeIdentityPayload(payload,)}`;
  assertFsId(candidate,);
  return candidate;
}

/**
 * Parses UUID output emitted by `findmnt`.
 *
 * @param output - Captured standard output
 *
 * @returns Safe token
 *
 * @throws when output has no safe UUID
 *
 * @example
 * ```ts
 * parseFindmntUuid(' 1234-ABCD\n'); // '1234-abcd'
 * ```
 */
export function parseFindmntUuid(output: string,): string {
  return normalizeIdentityPayload(output,);
}

/**
 * Parses `Volume UUID` from `diskutil info` output.
 *
 * @param output - Captured `diskutil` text
 *
 * @returns Safe token
 *
 * @throws when output has no safe Volume UUID
 *
 * @example
 * ```ts
 * parseDiskutilVolumeUuid('Volume UUID: ABCD-1234\n'); // 'abcd-1234'
 * ```
 */
export function parseDiskutilVolumeUuid(output: string,): string {
  /**
   * Lowercase field label accepted after trimming line indentation.
   */
  const label = 'volume uuid:';
  for (const line of output.split('\n',)) {
    /**
     * Trimmed line whose original offsets are irrelevant after delimiter.
     */
    const trimmed = line.trim();
    if (!trimmed.toLowerCase()
      .startsWith(label,)) {
      continue;
    }
    return normalizeIdentityPayload(trimmed.slice(label.length,),);
  }
  throw new TypeError('diskutil returned no valid Volume UUID',);
}

/**
 * Extracts serial token from Windows `vol` output.
 *
 * @param output - Captured command text
 *
 * @returns Serial token or empty string when absent
 *
 * @example
 * ```ts
 * parseVolumeSerial('Volume Serial Number is 1A2B-3C4D');
 * ```
 */
export function parseVolumeSerial(output: string,): string {
  /**
   * Lowercase copy whose offsets match original output.
   */
  const lower = output.toLowerCase();
  /**
   * Label start or `-1` when localized/unexpected output omits it.
   */
  const labelIndex = lower.indexOf(SERIAL_LABEL,);
  if (labelIndex === (-1))
    return '';

  return (function scanSerialToken(): string {
    /**
     * Forward-only cursor after label.
     */
    let cursor = labelIndex + SERIAL_LABEL.length;
    while ((cursor < output.length)
      && ((output.charAt(cursor,) === ' ') || (output.charAt(cursor,) === '\t'))) {
      cursor += 1;
    }
    /**
     * Serial characters collected once to avoid repeated string rebuilding.
     */
    const characters: string[] = [];
    while (cursor < output.length) {
      /**
       * Current character whose whitespace membership ends token.
       */
      const character = output.charAt(cursor,);
      if (SERIAL_TERMINATORS.has(character,))
        break;
      characters.push(character,);
      cursor += 1;
    }
    return characters.join('',);
  })();
}
