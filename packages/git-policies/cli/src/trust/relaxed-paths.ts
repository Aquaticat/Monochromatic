/**
 * Exact CLI_GIT_NO_PARANOID path grammar. @module
 */
import {
  isAbsolute,
  normalize,
} from 'node:path';
import { isFsId, } from '@monochromatic-dev/module-fs-id/ts';
import type {
  TrustIdentity,
  TrustWarning,
} from './types.ts';

/**
 * Percent plus two hexadecimal digits.
 */
const ESCAPED_SEQUENCE_LENGTH = 3;

/**
 * Decodes exact percent grammar for one raw entry.
 *
 * @param rawEntry - comma-delimited raw entry
 *
 * @returns decoded entry
 */
function decodeEntry(rawEntry: string,): string {
  /**
   * Decoded scalar chunks.
   */
  const decoded: string[] = [];
  for (let index = 0; index < rawEntry.length; index += 1) {
    /**
     * Current source character.
     */
    const character = rawEntry[index];
    if (character !== '%') {
      decoded.push(character ?? '',);
      continue;
    }
    /**
     * Exact two-digit escape payload.
     */
    const escape = rawEntry.slice(
      index + 1,
      index + ESCAPED_SEQUENCE_LENGTH,
    )
      .toUpperCase();
    if (escape === '25')
      decoded.push('%',);
    else if (escape === '2C')
      decoded.push(',',);
    else
      throw new Error(`unsupported percent escape %${escape}`,);
    index += 2;
  }
  return decoded.join('',);
}

/**
 * Reports whether one decoded entry matches current identity.
 *
 * @param entry - decoded candidate entry
 *
 * @param identity - current exact identity
 *
 * @param warn - prominent malformed or planted-entry warning
 *
 * @returns whether entry enables relaxed behavior
 */
function entryMatches({
  entry,
  identity,
  warn,
}: {
  readonly entry: string;
  readonly identity: TrustIdentity;
  readonly warn: (warning: TrustWarning,) => void;
},): boolean {
  /**
   * First identity/path separator.
   */
  const separator = entry.indexOf(':',);
  if ((separator <= 0) || (separator === (entry.length
    - 1))) {
    warn({
      code: 'relaxed-entry-malformed',
      message: `CLI_GIT_NO_PARANOID entry is malformed and ignored: ${entry}`,
    },);
    return false;
  }
  /**
   * Source-qualified filesystem ID.
   */
  const filesystemId = entry.slice(
    0,
    separator,
  );
  /**
   * Canonical path candidate.
   */
  const canonicalPath = entry.slice(separator + 1,);
  if ((!isFsId(filesystemId,)) || (!isAbsolute(canonicalPath,))
    || (normalize(canonicalPath,) !== canonicalPath)) {
    warn({
      code: 'relaxed-entry-malformed',
      message: `CLI_GIT_NO_PARANOID entry is malformed and ignored: ${entry}`,
    },);
    return false;
  }
  if (canonicalPath !== identity.canonicalConfigPath)
    return false;
  if (filesystemId !== identity.filesystemId) {
    warn({
      code: 'relaxed-entry-filesystem-mismatch',
      message: `CLI_GIT_NO_PARANOID entry names current path with a different filesystem identity and is ignored: ${entry}`,
    },);
    return false;
  }
  return true;
}

/**
 * Parses relaxed-mode entries and matches exact current identity.
 *
 * @param raw - complete environment value
 *
 * @param identity - current exact identity
 *
 * @param warn - one prominent warning sink per invalid entry
 *
 * @returns whether current identity is explicitly relaxed
 *
 * @example
 * ```ts
 * relaxedPathMatches({ raw: `${identity.filesystemId}:${identity.canonicalConfigPath}`, identity, warn });
 * ```
 */
export function relaxedPathMatches({
  raw,
  identity,
  warn,
}: {
  readonly raw?: string;
  readonly identity: TrustIdentity;
  readonly warn: (warning: TrustWarning,) => void;
},): boolean {
  if ((raw === undefined) || (raw.length === 0))
    return false;
  return raw.split(',')
    .some(function rawEntryMatches(rawEntry,) {
    try {
      return entryMatches({
        entry: decodeEntry(rawEntry,),
        identity,
        warn,
      },);
    }
    catch (error: unknown) {
      warn({
        code: 'relaxed-entry-malformed',
        message: `CLI_GIT_NO_PARANOID entry is malformed and ignored: ${rawEntry} (${String(error,)})`,
      },);
      return false;
    }
  },);
}
