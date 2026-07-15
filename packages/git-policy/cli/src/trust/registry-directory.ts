/**
 * Component-wise private registry directory creation.
 *
 * @module
 */

import { mkdir, } from 'node:fs/promises';
import {
  join,
  relative,
  resolve,
} from 'node:path';
import {
  assertSafeRegistryDirectory,
  DIRECTORY_MODE,
  protectPath,
  TrustStorageError,
} from './registry-io.ts';

/**
 * Creates missing registry descendants and protects each before deeper creation.
 *
 * @param registryRoot - complete protected registry root
 *
 * @param targetDirectory - descendant directory to ensure
 *
 * @example
 * ```ts
 * await ensurePrivateRegistryDirectory({ registryRoot: '/r', targetDirectory: '/r/records/id' });
 * ```
 */
export async function ensurePrivateRegistryDirectory({
  registryRoot,
  targetDirectory,
}: Readonly<{
  registryRoot: string;
  targetDirectory: string;
}>,): Promise<void> {
  /**
   * Component-aware relative descendant path.
   */
  const relativeTarget = relative(
    registryRoot,
    targetDirectory,
  );
  if (relativeTarget.startsWith('..',) || (resolve(
    registryRoot,
    relativeTarget,
  ) !== resolve(targetDirectory,)))
    throw new TrustStorageError('Trust registry path escapes registry root.',);
  /**
   * Native descendant path segments.
   */
  const segments = relativeTarget === ''
    ? []
    : relativeTarget.split(process.platform === 'win32' ? '\\' : '/',);
  /**
   * Ordered descendants excluding already-protected root.
   */
  const paths = segments.map(function descendantPath(
    _segment,
    index,
  ) {
    return join(
      registryRoot,
      ...segments.slice(
        0,
        index + 1,
      ),
    );
  },);
  await paths.reduce(
    async function ensureSequentially(
      previous,
      path,
    ) {
      await previous;
      try {
        await mkdir(
          path,
          { mode: DIRECTORY_MODE, },
        );
        await protectPath({
          path,
          directory: true,
        },);
      }
      catch (error: unknown) {
        if (!(Error.isError(error,) && ('code' in error)
          && (error.code === 'EEXIST')))
          throw error;
      }
    },
    Promise.resolve(),
  );
  await assertSafeRegistryDirectory({
    registryRoot,
    targetDirectory,
  },);
}
