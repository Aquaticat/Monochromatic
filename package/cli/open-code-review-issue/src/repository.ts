/**
 * Canonical GitHub repository selection.
 *
 * @module
 */

import type { GitHubRepository, } from './github-model.ts';

/**
 * Required repository URL prefix.
 */
const GITHUB_URL_PREFIX = 'https://github.com/';

/**
 * Reports explicit or inferred repository selection failure.
 */
export class RepositorySelectionError extends Error {
  /**
   * Creates repository selection failure.
   *
   * @param message - User-facing repository evidence and remediation.
   *
   * @example
   * ```ts
   * const error = new RepositorySelectionError('repository URL is invalid');
   * ```
   */
  public constructor(message: string,) {
    super(message,);
    this.name = 'RepositorySelectionError';
  }
}

/**
 * Checks ASCII alphanumeric character.
 *
 * @param character - One UTF-16 code unit.
 *
 * @returns Whether character belongs to ASCII alphanumeric set.
 */
function isAsciiAlphanumeric(character: string,): boolean {
  return (character >= 'a' && character <= 'z')
    || (character >= 'A' && character <= 'Z')
    || (character >= '0' && character <= '9');
}

/**
 * Checks GitHub owner character grammar.
 *
 * @param character - One owner code unit.
 *
 * @returns Whether owner accepts character.
 */
function isOwnerCharacter(character: string,): boolean {
  return isAsciiAlphanumeric(character,) || character === '-';
}

/**
 * Checks GitHub repository-name character grammar.
 *
 * @param character - One repository-name code unit.
 *
 * @returns Whether repository name accepts character.
 */
function isRepositoryCharacter(character: string,): boolean {
  return isAsciiAlphanumeric(character,)
    || character === '-'
    || character === '_'
    || character === '.';
}

/**
 * Checks every code unit against supplied character grammar.
 *
 * @param value - Owner or repository segment.
 *
 * @param accepts - Character predicate for segment grammar.
 *
 * @returns Whether non-empty segment contains only accepted characters.
 */
function everyCharacter({
  value,
  accepts,
}: {
  readonly value: string;
  readonly accepts: (character: string) => boolean;
},): boolean {
  if (value === '') {
    return false;
  }
  for (let index = 0; index < value.length; index += 1) {
    if (!accepts(value.charAt(index,),)) {
      return false;
    }
  }
  return true;
}

/**
 * Parses exact canonical GitHub repository HTTPS URL.
 *
 * @param value - User-supplied `--repo` value.
 *
 * @returns Canonical owner, name, and unchanged URL.
 *
 * @throws {@link RepositorySelectionError} when value differs from required shape.
 *
 * @example
 * ```ts
 * parseRepositoryUrl('https://github.com/owner/repository');
 * ```
 */
export function parseRepositoryUrl(value: string,): GitHubRepository {
  if (!value.startsWith(GITHUB_URL_PREFIX,)) {
    throw new RepositorySelectionError(
      'repository must use https://github.com/OWNER/NAME',
    );
  }
  /**
   * Owner/name portion after fixed host prefix.
   */
  const suffix = value.slice(GITHUB_URL_PREFIX.length,);
  /**
   * Exact path segments without URL parser normalization.
   */
  const segments = suffix.split('/',);
  if (segments.length !== 2) {
    throw new RepositorySelectionError(
      'repository must contain exactly OWNER/NAME with no trailing slash',
    );
  }
  /**
   * Candidate owner segment.
   */
  const [owner, name,] = segments;
  if (owner === undefined
    || name === undefined
    || !everyCharacter({ value: owner, accepts: isOwnerCharacter, })
    || !everyCharacter({ value: name, accepts: isRepositoryCharacter, })
    || owner.startsWith('-',)
    || owner.endsWith('-',)
    || name.endsWith('.git',))
  {
    throw new RepositorySelectionError(
      'repository must use canonical https://github.com/OWNER/NAME characters',
    );
  }
  return {
    owner,
    name,
    url: value,
  };
}
