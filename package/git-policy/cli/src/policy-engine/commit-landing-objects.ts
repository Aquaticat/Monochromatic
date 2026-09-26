/**
 Object migration from the shadow store into the real store as a kept pack.

 `pack-objects --revs --local` packs only the shadow's own objects reachable from the new commit
 and not from the old target;
 `index-pack --keep` in the owning worktree writes the pack with its `.keep` file created first,
 so neither `git prune` nor a concurrent repack can drop the objects before the compare-and-swap.
 The keep message `cli-git <transaction-id>` lets recovery find the `.keep` even before a landing record names it.

 @module
 */
import {
  readdir,
  readFile,
  rm,
} from 'node:fs/promises';
import { join, } from 'node:path';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { runShadowGit, } from '../shadow-repository/shadow-refs.ts';
import { isMissingPath, } from '../trust/registry-io.ts';
import type { PreparationBase, } from './commit-transaction-capture.ts';
import {
  CommitTransactionGitError,
  runTransactionGit,
} from './commit-transaction-git.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Strict Git output decoder.
 */
const DECODER = new TextDecoder(
  'utf-8',
  { fatal: true, },
);

/**
 UTF-8 encoder for revision input.
 */
const ENCODER = new TextEncoder();

/**
 Keep message naming one transaction.

 @param transactionId - transaction ID

 @returns keep message

 @example
 ```ts
 transactionKeepMessage('0b6c2c1e-6f5b-4d0e-9a55-3f5d8e2f6a10'); // 'cli-git 0b6c…'
 ```
 */
export function transactionKeepMessage(transactionId: string,): string {
  return `cli-git ${transactionId}`;
}

/**
 Migrates the new commit's shadow-only objects into the real store as a pack with a `.keep` file.

 @param gitPath - real Git executable

 @param cwd - owning worktree directory

 @param shadowPath - shadow repository

 @param newOid - commit to land

 @param oldBase - expected old target value

 @param keepMessage - `.keep` contents naming the transaction; `undefined` writes no `.keep`

 @returns migrated pack hash

 @throws {@link CommitTransactionGitError} when Git does not report the pack

 @example
 ```ts
 await migrateShadowObjects({ gitPath: '/usr/bin/git', cwd: '/repo', shadowPath, newOid, oldBase, keepMessage: 'cli-git id' });
 ```
 */
export async function migrateShadowObjects({
  gitPath,
  cwd,
  shadowPath,
  newOid,
  oldBase,
  keepMessage,
}: Readonly<{
  gitPath: string;
  cwd: string;
  shadowPath: string;
  newOid: string;
  oldBase: PreparationBase;
  keepMessage?: string;
}>,): Promise<string> {
  /**
   Tagged migration logger.
   */
  const rl = tagged({
    tag: migrateShadowObjects.name,
    l,
  },);
  /**
   Pack of shadow-store objects reachable from the new commit only.
   */
  const pack = await runShadowGit({
    gitPath,
    shadowPath,
    args: [
      'pack-objects',
      '--revs',
      '--local',
      '--stdout',
      '--quiet',
    ],
    input: ENCODER.encode(`${newOid}\n${oldBase.kind === 'commit' ? `^${oldBase.oid}\n` : ''}`,),
  },);
  /**
   Index-pack report in the owning worktree's object store.
   */
  const indexed = await runTransactionGit({
    gitPath,
    cwd,
    args: [
      'index-pack',
      '--stdin',
      ...(keepMessage === undefined ? [] : [`--keep=${keepMessage}`,]),
    ],
    input: pack.stdout,
  },);
  /**
   `keep<TAB><hash>` or `pack<TAB><hash>`.
   */
  const report = DECODER.decode(indexed.stdout,)
    .trim();
  /**
   Tab separating the kind from the pack hash.
   */
  const tab = report.indexOf('\t',);
  if (tab === (-1))
    throw new CommitTransactionGitError(`git index-pack reported no pack: ${JSON.stringify(report,)}`,);
  /**
   Migrated pack hash.
   */
  const packName = report.slice(tab + 1,);
  rl.debug(`migrated ${String(pack.stdout
    .length,)} pack bytes for ${newOid} as pack-${packName}`,);
  return packName;
}

/**
 Removes the `.keep` of one migrated pack.

 @param objectDirectory - real object directory

 @param packName - pack hash

 @example
 ```ts
 await removePackKeep({ objectDirectory: '/repo/.git/objects', packName });
 ```
 */
export async function removePackKeep({
  objectDirectory,
  packName,
}: Readonly<{
  objectDirectory: string;
  packName: string;
}>,): Promise<void> {
  await rm(
    join(
      objectDirectory,
      'pack',
      `pack-${packName}.keep`,
    ),
    { force: true, },
  );
}

/**
 Lists a directory, or nothing when it does not exist.

 @param directory - directory path

 @returns entry names
 */
async function readNamesOrEmpty(directory: string,): Promise<readonly string[]> {
  try {
    return await readdir(directory,);
  }
  catch (error: unknown) {
    if (isMissingPath(error,))
      return [];
    throw error;
  }
}

/**
 Reads a text file, or an empty string when it vanished.

 @param path - file path

 @returns contents
 */
async function readTextOrEmpty(path: string,): Promise<string> {
  try {
    return await readFile(
      path,
      'utf8',
    );
  }
  catch (error: unknown) {
    if (isMissingPath(error,))
      return '';
    throw error;
  }
}

/**
 Removes every `.keep` whose message names the transaction, including one written before a landing record.

 @param objectDirectory - real object directory

 @param transactionId - transaction ID

 @returns number of removed `.keep` files

 @example
 ```ts
 await removeTransactionKeeps({ objectDirectory: '/repo/.git/objects', transactionId });
 ```
 */
export async function removeTransactionKeeps({
  objectDirectory,
  transactionId,
}: Readonly<{
  objectDirectory: string;
  transactionId: string;
}>,): Promise<number> {
  /**
   Real pack directory.
   */
  const packDirectory = join(
    objectDirectory,
    'pack',
  );
  /**
   Pack directory entries; absent before the first pack.
   */
  const names = await readNamesOrEmpty(packDirectory,);
  /**
   Exact contents index-pack writes for this transaction.
   */
  const expected = `${transactionKeepMessage(transactionId,)}\n`;
  /**
   Keep files naming this transaction.
   */
  const owned = (await Promise.all(names
    .filter(function isKeep(name,): boolean {
      return name.endsWith('.keep',);
    },)
    .map(async function ownedKeep(name,): Promise<readonly string[]> {
      /**
       Keep file path.
       */
      const path = join(
        packDirectory,
        name,
      );
      /**
       Keep message, empty when the file vanished.
       */
      const message = await readTextOrEmpty(path,);
      return message === expected ? [path,] : [];
    },),)).flat();
  await Promise.all(owned.map(async function removeKeep(path,): Promise<void> {
    await rm(
      path,
      { force: true, },
    );
  },),);
  return owned.length;
}
