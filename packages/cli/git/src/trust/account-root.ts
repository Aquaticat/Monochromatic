/**
 * Operating-system-account-derived trust registry root.
 *
 * @module
 */
import { userInfo, } from 'node:os';
import { join, } from 'node:path';
import { realpath, } from 'node:fs/promises';

/**
 * Account registry root resolution failure.
 */
export class AccountRegistryRootError extends Error {
  /**
   * Creates account-root failure.
   *
   * @param message - safe failure explanation
   */
  public constructor(message: string,) {
    super(message,);
    this.name = 'AccountRegistryRootError';
  }
}

/**
 * Resolves production registry root without repository-controlled environment variables.
 *
 * @returns canonical OS-account state path
 *
 * @example
 * ```ts
 * await resolveAccountRegistryRoot();
 * ```
 */
export async function resolveAccountRegistryRoot(): Promise<string> {
  /**
   * Canonical home from operating-system account database.
   */
  const accountHome = await (async function canonicalAccountHome(): Promise<string> {
    try {
      return await realpath(userInfo()
        .homedir,);
    }
    catch (error: unknown) {
      throw new AccountRegistryRootError(`Unable to resolve operating-system account home: ${String(error,)}`,);
    }
  })();
  return process.platform === 'win32'
    ? join(
      accountHome,
      'AppData',
      'Local',
      'cli-git',
      'trust',
      'v1',
    )
    : join(
      accountHome,
      '.local',
      'state',
      'cli-git',
      'trust',
      'v1',
    );
}
