/**
 * Packed-fixture access to the per-transaction registry `<git-dir>/cli-git-transactions/`.
 *
 * @module
 */
import { readdir, } from 'node:fs/promises';

/**
 * Length of a canonical `randomUUID` transaction ID; staging and retired names are longer.
 */
const TRANSACTION_ID_LENGTH = 36;

/**
 * Resolves the registry of a main worktree.
 *
 * @param repository - disposable repository root
 *
 * @returns registry path
 *
 * @example
 * ```ts
 * transactionRegistry('/work/repo');
 * ```
 */
export function transactionRegistry(repository: string,): string {
  return `${repository}/.git/cli-git-transactions`;
}

/**
 * Lists every registry entry name, including staging and retired names.
 *
 * @param repository - disposable repository root
 *
 * @returns sorted entry names; empty when the registry is absent
 *
 * @example
 * ```ts
 * await listRegistryEntries('/work/repo');
 * ```
 */
export async function listRegistryEntries(repository: string,): Promise<readonly string[]> {
  try {
    return (await readdir(transactionRegistry(repository,),)).toSorted();
  }
  catch (error: unknown) {
    if (Error.isError(error,) && ('code' in error)
      && (error.code === 'ENOENT'))
      return [];
    throw error;
  }
}

/**
 * Resolves the one published transaction directory an interrupted wrapper retained.
 *
 * @param repository - disposable repository root
 *
 * @returns absolute transaction directory
 *
 * @example
 * ```ts
 * await resolveSingleTransactionDirectory('/work/repo');
 * ```
 */
export async function resolveSingleTransactionDirectory(repository: string,): Promise<string> {
  /**
   * Published transaction names.
   */
  const published = (await listRegistryEntries(repository,)).filter(function isPublished(name,): boolean {
    return name.length === TRANSACTION_ID_LENGTH;
  },);
  if (published.length !== 1)
    throw new Error(`expected one retained transaction directory, found ${JSON.stringify(published,)}`,);
  return `${transactionRegistry(repository,)}/${String(published[0],)}`;
}

/**
 * Asserts no transaction directory of any kind remains.
 *
 * @param repository - disposable repository root
 *
 * @param context - scenario label
 *
 * @example
 * ```ts
 * await assertNoTransactionDirectories({ repository: '/work/repo', context: 'recovery' });
 * ```
 */
export async function assertNoTransactionDirectories({
  repository,
  context,
}: Readonly<{
  repository: string;
  context: string;
}>,): Promise<void> {
  /**
   * Remaining registry entries.
   */
  const remaining = await listRegistryEntries(repository,);
  if (remaining.length > 0)
    throw new Error(`${context} left transaction directories ${JSON.stringify(remaining,)}`,);
}

/**
 * CommonJS hook statement resolving the one published transaction directory from the repository root.
 *
 * @param file - file inside the transaction directory
 *
 * @returns JavaScript expression evaluating to the relative path
 *
 * @example
 * ```ts
 * transactionFileExpression('post-1.index');
 * ```
 */
export function transactionFileExpression(file: string,): string {
  return `(() => { const root = '.git/cli-git-transactions'; const names = require('node:fs').readdirSync(root).filter((name) => name.length === ${String(TRANSACTION_ID_LENGTH,)}); if (names.length !== 1) throw new Error('expected one transaction directory'); return root + '/' + names[0] + '/' + ${JSON.stringify(file,)}; })()`;
}
