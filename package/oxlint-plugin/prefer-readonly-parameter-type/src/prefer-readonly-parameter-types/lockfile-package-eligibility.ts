/**
 * Exact pnpm lockfile package-version eligibility.
 *
 * @module
 */

import {
  existsSync,
  readFileSync,
  statSync,
} from 'node:fs';
import {
  dirname,
  join,
} from 'node:path';

import type { InstalledPackageIdentity, } from './installed-package-identity.ts';

/**
 * Sentinel when configured project has no governing pnpm lockfile.
 */
const PNPM_LOCKFILE_UNAVAILABLE: unique symbol = Symbol(
  'configured project governing pnpm lockfile was unavailable',
);

/**
 * Cached lockfile text and metadata identity by exact path.
 */
const lockTextByPath = new Map<string, {
  readonly signature: string;
  readonly text: string;
}>();

/**
 * Finds nearest pnpm lockfile governing configured project.
 *
 * @param configFileName - Configured TypeScript project path.
 *
 * @returns lockfile path or unavailable sentinel.
 */
function nearestPnpmLockfile(
  configFileName: string,
): string | typeof PNPM_LOCKFILE_UNAVAILABLE {
  /**
   * Mutable ancestor cursor bounded by filesystem root.
   */
  const cursor = { current: dirname(configFileName,), };
  while (true) {
    /**
     * Candidate lockfile at current ancestor.
     */
    const candidate = join(
      cursor.current,
      'pnpm-lock.yaml',
    );
    // oxlint-disable-next-line no-restricted-syntax/no-sync -- Synchronous semantic visitor verifies package eligibility before implementation analysis.
    if (existsSync(candidate,))
      return candidate;
    /**
     * Parent directory for next bounded ancestor step.
     */
    const parent = dirname(cursor.current,);
    if (parent === cursor.current)
      return PNPM_LOCKFILE_UNAVAILABLE;
    cursor.current = parent;
  }
}

/**
 * Reads governing lockfile once in stable lint process.
 *
 * @param path - Exact pnpm lockfile path.
 *
 * @returns lockfile text.
 */
function lockfileText(path: string,): string {
  /* oxlint-disable no-restricted-syntax/no-sync -- Synchronous semantic visitor validates governing lockfile metadata before cached reuse. */
  /**
   * Current governing lockfile metadata.
   */
  const metadata = statSync(path,);
  /* oxlint-enable no-restricted-syntax/no-sync */
  /**
   * Metadata signature invalidated by ordinary lockfile replacement or write.
   */
  const signature = `${String(metadata.dev,)}:${String(metadata.ino,)}:${String(metadata.size,)}:${String(metadata.mtimeMs,)}:${String(metadata.ctimeMs,)}`;
  /**
   * Prior lockfile text retained for exact metadata identity.
   */
  const cached = lockTextByPath.get(path,);
  if ((cached !== undefined) && (cached.signature === signature))
    return cached.text;
  /* oxlint-disable no-restricted-syntax/no-sync -- Synchronous semantic visitor reads governing lockfile after metadata cache miss. */
  /**
   * Exact governing lockfile text.
   */
  const text = readFileSync(
    path,
    'utf8',
  );
  /* oxlint-enable no-restricted-syntax/no-sync */
  lockTextByPath.set(
    path,
    {
      signature,
      text,
    },
  );
  return text;
}

/**
 * Tests whether lockfile key starts with exact package name and version.
 *
 * @param line - One lockfile line.
 *
 * @param identity - Exact installed package identity.
 *
 * @returns whether line is matching package or snapshot key.
 */
function matchesPackageKey({
  line,
  identity,
}: {
  readonly line: string;
  readonly identity: InstalledPackageIdentity;
}): boolean {
  /**
   * Unquoted lock key prefix used by ordinary package names.
   */
  const unquoted = `  ${identity.name}@${identity.version}`;
  /**
   * Quoted lock key prefix used by scoped package names.
   */
  const quoted = `  '${identity.name}@${identity.version}`;
  if (line.startsWith(unquoted,)) {
    /**
     * Delimiter after exact unquoted package version.
     */
    const delimiter = line[unquoted.length];
    return (delimiter === ':') || (delimiter === '(');
  }
  if (line.startsWith(quoted,)) {
    /**
     * Delimiter after exact quoted package version.
     */
    const delimiter = line[quoted.length];
    return (delimiter === "'") || (delimiter === '(');
  }
  return false;
}

/**
 * Clears process-local lockfile text at semantic lifecycle boundary.
 *
 * @example
 * ```ts
 * clearLockfilePackageEligibilityCache();
 * ```
 */
export function clearLockfilePackageEligibilityCache(): void {
  lockTextByPath.clear();
}

/**
 * Tests whether exact installed package version occurs in governing pnpm lockfile.
 *
 * @param configFileName - Consumer configured-project path.
 *
 * @param identity - Exact installed package identity.
 *
 * @returns whether package version is eligible for implementation inference.
 *
 * @example
 * ```ts
 * packageVersionIsLocked({ configFileName, identity });
 * ```
 */
export function packageVersionIsLocked({
  configFileName,
  identity,
}: {
  readonly configFileName: string;
  readonly identity: InstalledPackageIdentity;
}): boolean {
  /**
   * Governing pnpm lockfile path.
   */
  const path = nearestPnpmLockfile(configFileName,);
  if (path === PNPM_LOCKFILE_UNAVAILABLE)
    return false;
  return lockfileText(path,)
    .split('\n',)
    .some(function packageKey(line,): boolean {
      return matchesPackageKey({
        line,
        identity,
      },);
    },);
}
