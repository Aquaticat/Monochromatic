/**
 * Whether a source file can name `type-fest` in a type position.
 *
 * The structural suggestion used to require the file to already import `ReadonlyDeep`,
 * which was the wrong test for the right reason. It was wrong because the import is unused
 * until the suggestion is applied, so the unused-import fix deletes it in the same pass and
 * the emitted file stops compiling. It was right because a file that imports a package can
 * certainly resolve it, and dropping the test alone traded one broken emission for another:
 * measured on a package that does not depend on `type-fest`, the inline form produced
 * `TS2307: Cannot find module 'type-fest'` where the named form had produced `TS2552`.
 *
 * Eighteen of a hundred and fifty workspace packages declare the dependency, so this is the
 * common case rather than the corner.
 *
 * Resolution is answered the way Node answers it, by walking ancestors and asking whether
 * any of them installed the package, rather than by reading a manifest. A manifest states
 * intent and the walk states fact, and what decides whether the emitted type compiles is
 * fact.
 *
 * @module
 */

import { existsSync, } from 'node:fs';
import {
  dirname,
  resolve,
} from 'node:path';

import { ancestorDirectories, } from './ancestor-directories.ts';

/**
 * Reachability answers by directory, so one walk serves every parameter beneath it.
 */
const reachabilityByDirectory = new Map<string, boolean>();

/**
 * Clears memoized reachability answers.
 *
 * Exported for the same reason the other caches here expose one: a long-lived process can
 * outlive an install, and a test that installs into a disposable tree needs the next answer
 * to be measured rather than remembered.
 *
 * @example
 * ```ts
 * clearTypeFestReachabilityCache();
 * ```
 */
export function clearTypeFestReachabilityCache(): void {
  reachabilityByDirectory.clear();
}

/**
 * Tests whether `type-fest` resolves from one source file.
 *
 * @param fileName - Absolute path of file whose type position would name the package.
 *
 * @returns whether an ancestor of that file installed `type-fest`.
 *
 * @example
 * ```ts
 * typeFestResolvesFrom({ fileName: parameter.getSourceFile().fileName, },);
 * ```
 */
export function typeFestResolvesFrom({
  fileName,
}: {
  readonly fileName: string;
},): boolean {
  /**
   * Directory the walk starts from, which is the file's own.
   */
  const startDirectory = dirname(fileName,);
  /**
   * Answer measured for this directory on an earlier parameter, when available.
   */
  const remembered = reachabilityByDirectory.get(startDirectory,);
  if (remembered !== undefined)
    return remembered;
  /**
   * Whether any ancestor installed the package.
   */
  const reachable = [...ancestorDirectories(startDirectory,),]
    .some(function installedHere(directory,): boolean {
      // oxlint-disable-next-line no-restricted-syntax/no-sync -- A rule decides suggestions synchronously, and this path is never opened afterwards, so the race the rule guards has no window here.
      return existsSync(resolve(
        directory,
        'node_modules',
        'type-fest',
      ),);
    },);
  reachabilityByDirectory.set(
    startDirectory,
    reachable,
  );
  return reachable;
}
