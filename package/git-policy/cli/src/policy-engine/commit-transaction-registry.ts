/**
 Per-transaction durable directories under one worktree Git directory.

 Each commit transaction owns `<git-dir>/cli-git-transactions/<transaction-id>/`.
 A directory is published by renaming a complete staging candidate,
 so every published directory already holds its owner record,
 and removed by renaming it to a retired name first,
 so a concurrent reader never observes a published directory losing its owner record.

 @module
 */
import type { Dirent, } from 'node:fs';
import {
  lstat,
  mkdir,
  readdir,
  realpath,
  rename,
  rm,
} from 'node:fs/promises';
import {
  basename,
  dirname,
  join,
  resolve,
} from 'node:path';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  DIRECTORY_MODE,
  isMissingPath,
  protectPath,
  syncDirectory,
  writePrivateFile,
} from '../trust/registry-io.ts';
import { CommitTransactionRecoveryError, } from './commit-transaction-recovery-validation.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Git administrative name of the per-worktree transaction registry.
 */
export const TRANSACTION_ROOT_NAME = 'cli-git-transactions';

/**
 Git administrative name of the single per-index journal written by builds before per-transaction journals.
 */
export const LEGACY_TRANSACTION_DIRECTORY_NAME = 'cli-git-transaction';

/**
 Owner record filename present in every published transaction directory.
 */
export const OWNER_FILENAME = 'owner.json';

/**
 Suffix of an unpublished candidate whose owner record may still be incomplete.
 */
export const STAGING_SUFFIX = '.pending';

/**
 Suffix of a completed transaction directory whose removal is in progress.
 */
export const RETIRED_SUFFIX = '.retired';

/**
 Landing reservation lock directory name inside the transaction registry.
 */
export const RESERVATION_LOCK_NAME = 'reservation.lock';

/**
 Owner-lock directories that live beside transactions in the registry, with their pending and stale candidates.
 */
const REGISTRY_LOCK_NAMES: readonly string[] = [
  'landing.lock',
  RESERVATION_LOCK_NAME,
];

/**
 Reports whether a registry entry is an owner lock or one of its candidates rather than a transaction.

 @param name - registry entry name

 @returns whether the entry belongs to a registry lock

 @example
 ```ts
 isRegistryLockName('landing.lock'); // true
 ```
 */
export function isRegistryLockName(name: string,): boolean {
  return REGISTRY_LOCK_NAMES.some(function belongsToLock(lockName,): boolean {
    return (name === lockName) || name.startsWith(`${lockName}.`,);
  },);
}

/**
 Canonical `randomUUID` layout: `-` marks separator positions, every other position is one lowercase hex digit.
 */
const TRANSACTION_ID_TEMPLATE = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';

/**
 Lowercase hexadecimal digits `randomUUID` emits.
 */
const HEX_DIGITS = '0123456789abcdef';

/**
 Registry entry kinds recovery handles differently.
 */
export type TransactionRegistryEntryKind = 'transaction' | 'staging' | 'retired';

/**
 One classified registry directory entry.
 */
export type TransactionRegistryEntry = Readonly<{
  /**
   Publication state encoded in the entry name.
   */
  kind: TransactionRegistryEntryKind;
  /**
   Transaction ID shared by every name form of one transaction.
   */
  transactionId: string;
  /**
   Absolute entry path.
   */
  path: string;
}>;

/**
 Reports whether a name is exactly one canonical transaction ID.

 @param name - untrusted directory entry name or ID

 @returns whether name matches the `randomUUID` layout

 @example
 ```ts
 isTransactionId('0b6c2c1e-6f5b-4d0e-9a55-3f5d8e2f6a10'); // true
 ```
 */
export function isTransactionId(name: string,): boolean {
  /**
   Individual name characters compared against the template position by position.
   */
  const characters = Array.from(name,);
  return (characters.length === TRANSACTION_ID_TEMPLATE.length)
    && characters.every(function matchesTemplate(
      character,
      index,
    ): boolean {
      return TRANSACTION_ID_TEMPLATE[index] === '-'
        ? character === '-'
        : HEX_DIGITS.includes(character,);
    },);
}

/**
 Extracts the transaction ID from a suffixed registry name.

 @param name - directory entry name

 @param suffix - staging or retired suffix

 @returns transaction ID, or an empty string when the name is not `<transaction-id><suffix>`
 */
function suffixedTransactionId({
  name,
  suffix,
}: Readonly<{
  name: string;
  suffix: string;
}>,): string {
  if (!name.endsWith(suffix,))
    return '';
  /**
   Name with the suffix removed.
   */
  const prefix = name.slice(
    0,
    name.length - suffix.length,
  );
  return isTransactionId(prefix,) ? prefix : '';
}

/**
 Creates the registry directory when absent and proves it is a real directory under a canonical parent.

 @param root - absolute registry path Git reported

 @throws {@link CommitTransactionRecoveryError} when the registry is a symbolic link or non-directory

 @example
 ```ts
 await ensureTransactionRoot('/repo/.git/cli-git-transactions');
 ```
 */
export async function ensureTransactionRoot(root: string,): Promise<void> {
  /**
   Tagged registry logger.
   */
  const rl = tagged({
    tag: ensureTransactionRoot.name,
    l,
  },);
  /**
   Canonical administrative parent proving no symbolic-link ancestor redirects the registry.
   */
  const canonicalParent = await realpath(dirname(root,),);
  if (join(
    canonicalParent,
    basename(root,),
  ) !== resolve(root,))
    throw new TypeError('Git transaction registry path has a noncanonical administrative parent.',);
  try {
    await mkdir(
      root,
      { mode: DIRECTORY_MODE, },
    );
    await protectPath({
      path: root,
      directory: true,
    },);
    await syncDirectory(canonicalParent,);
    rl.debug(`created transaction registry ${root}`,);
  }
  catch (error: unknown) {
    if (!(Error.isError(error,)
      && ('code' in error)
      && (error.code === 'EEXIST')))
      throw error;
    rl.debug(`transaction registry already exists: ${error.message}`,);
  }
  /**
   Non-followed registry metadata.
   */
  const metadata = await lstat(root,);
  if ((!metadata.isDirectory()) || metadata.isSymbolicLink())
    throw new CommitTransactionRecoveryError(`Unsafe transaction registry: ${root}`,);
}

/**
 Publishes one transaction directory holding its complete owner record.

 @param root - existing registry directory

 @param transactionId - fresh `randomUUID` value

 @param ownerBytes - encoded owner record

 @returns absolute published transaction directory

 @example
 ```ts
 await publishTransactionDirectory({ root, transactionId: randomUUID(), ownerBytes });
 ```
 */
export async function publishTransactionDirectory({
  root,
  transactionId,
  ownerBytes,
}: Readonly<{
  root: string;
  transactionId: string;
  ownerBytes: Uint8Array;
}>,): Promise<string> {
  if (!isTransactionId(transactionId,))
    throw new TypeError(`Malformed commit transaction ID: ${transactionId}`,);
  /**
   Unpublished candidate that recovery never treats as a transaction.
   */
  const stagingDirectory = join(
    root,
    `${transactionId}${STAGING_SUFFIX}`,
  );
  /**
   Published transaction directory.
   */
  const directory = join(
    root,
    transactionId,
  );
  await mkdir(
    stagingDirectory,
    { mode: DIRECTORY_MODE, },
  );
  /**
   Whether rename transferred the candidate into the published name.
   */
  const published = new Set<'published'>();
  /**
   Removes an unpublished candidate on any setup failure.
   */
  await using stagingCleanup = {
    [Symbol.asyncDispose]: async function removeUnpublishedCandidate(): Promise<void> {
      if (published.size === 0)
        await rm(
          stagingDirectory,
          {
            recursive: true,
            force: true,
          },
        );
    },
  };
  await protectPath({
    path: stagingDirectory,
    directory: true,
  },);
  await writePrivateFile({
    path: join(
      stagingDirectory,
      OWNER_FILENAME,
    ),
    bytes: ownerBytes,
  },);
  await syncDirectory(stagingDirectory,);
  await rename(
    stagingDirectory,
    directory,
  );
  published.add('published',);
  await syncDirectory(root,);
  return directory;
}

/**
 Removes a transaction directory; registry directories are unpublished by rename before deletion.

 @param directory - exact transaction directory, registry or legacy

 @example
 ```ts
 await removeTransactionDirectory('/repo/.git/cli-git-transactions/0b6c2c1e-6f5b-4d0e-9a55-3f5d8e2f6a10');
 ```
 */
export async function removeTransactionDirectory(directory: string,): Promise<void> {
  /**
   Registry containing directory.
   */
  const parent = dirname(directory,);
  if ((basename(parent,) !== TRANSACTION_ROOT_NAME) || (!isTransactionId(basename(directory,),))) {
    await rm(
      directory,
      {
        recursive: true,
        force: true,
      },
    );
    await syncDirectory(parent,);
    return;
  }
  /**
   Retired name no reader treats as a published transaction.
   */
  const retiredDirectory = `${directory}${RETIRED_SUFFIX}`;
  await rename(
    directory,
    retiredDirectory,
  );
  await syncDirectory(parent,);
  await rm(
    retiredDirectory,
    {
      recursive: true,
      force: true,
    },
  );
  await syncDirectory(parent,);
}

/**
 Classifies one registry entry by name and non-followed type.

 @param root - registry directory

 @param entry - directory entry read without following links

 @returns classified entry

 @throws {@link CommitTransactionRecoveryError} for links, files, and unrecognized names
 */
function classifyRegistryEntry({
  root,
  entry,
}: Readonly<{
  root: string;
  entry: Dirent;
}>,): TransactionRegistryEntry {
  /**
   Entry name encoding the publication state.
   */
  const { name, } = entry;
  /**
   Absolute entry path named in diagnostics.
   */
  const path = join(
    root,
    name,
  );
  if (!entry.isDirectory())
    throw new CommitTransactionRecoveryError(`Unsafe transaction recovery directory: ${path}`,);
  if (isTransactionId(name,))
    return {
      kind: 'transaction',
      transactionId: name,
      path,
    };
  /**
   Transaction ID of a staging candidate, or empty.
   */
  const stagingId = suffixedTransactionId({
    name,
    suffix: STAGING_SUFFIX,
  },);
  if (stagingId !== '')
    return {
      kind: 'staging',
      transactionId: stagingId,
      path,
    };
  /**
   Transaction ID of a retired directory, or empty.
   */
  const retiredId = suffixedTransactionId({
    name,
    suffix: RETIRED_SUFFIX,
  },);
  if (retiredId !== '')
    return {
      kind: 'retired',
      transactionId: retiredId,
      path,
    };
  throw new CommitTransactionRecoveryError(`Unexpected transaction registry entry: ${path}`,);
}

/**
 Lists every registry entry in name order without following links.

 @param root - absolute registry path

 @returns classified entries; empty when the registry does not exist

 @throws {@link CommitTransactionRecoveryError} when the registry or an entry is unsafe or unrecognized

 @example
 ```ts
 await listTransactionEntries('/repo/.git/cli-git-transactions');
 ```
 */
export async function listTransactionEntries(root: string,): Promise<readonly TransactionRegistryEntry[]> {
  /**
   Tagged registry logger.
   */
  const rl = tagged({
    tag: listTransactionEntries.name,
    l,
  },);
  try {
    /**
     Non-followed registry metadata.
     */
    const metadata = await lstat(root,);
    if ((!metadata.isDirectory()) || metadata.isSymbolicLink())
      throw new CommitTransactionRecoveryError(`Unsafe transaction registry: ${root}`,);
  }
  catch (error: unknown) {
    if (!isMissingPath(error,))
      throw error;
    rl.debug(`no transaction registry at ${root}`,);
    return [];
  }
  /**
   Entries typed by `lstat` semantics, so links never report as directories.
   */
  const entries = await readdir(
    root,
    { withFileTypes: true, },
  );
  return entries
    .filter(function isTransactionEntry(entry,): boolean {
      return !isRegistryLockName(entry.name,);
    },)
    .map(function classifyEntry(entry,): TransactionRegistryEntry {
      return classifyRegistryEntry({
        root,
        entry,
      },);
    },)
    .toSorted(function byName(
      { path: leftPath, },
      { path: rightPath, },
    ): number {
      return leftPath.localeCompare(rightPath,);
    },);
}
