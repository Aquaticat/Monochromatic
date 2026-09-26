/**
 Per-transaction registry creation, publication, enumeration, and removal.

 @module
 */
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { internalTestExports, } from '../../dist/final/node/index.mjs';

const {
  CommitTransactionRecoveryError,
  ensureTransactionRoot,
  inspectRegistryEntry,
  isTransactionId,
  listTransactionEntries,
  publishTransactionDirectory,
  recoverInspectedEntry,
  removeTransactionDirectory,
} = internalTestExports;

/**
 Canonical transaction ID used by fixtures.
 */
const ID = '0b6c2c1e-6f5b-4d0e-9a55-3f5d8e2f6a10';

/**
 Second canonical transaction ID used by fixtures.
 */
const OTHER_ID = '1b6c2c1e-6f5b-4d0e-9a55-3f5d8e2f6a10';

/**
 Disposable administrative directory.
 */
type AdminDirectory = Readonly<{
  /**
   Canonical stand-in Git directory.
   */
  path: string;
  /**
   Registry path inside it.
   */
  root: string;
  /**
   Removes the directory.
   */
  [Symbol.asyncDispose]: () => Promise<void>;
}>;

/**
 Creates a canonical stand-in Git directory.

 @returns disposable directory
 */
async function createAdminDirectory(): Promise<AdminDirectory> {
  /**
   Directory root.
   */
  const path = await mkdtemp(join(tmpdir(), 'cli-git-registry-',),);
  return {
    path,
    root: join(path, 'cli-git-transactions',),
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(path, { recursive: true, force: true, },);
    },
  };
}

/**
 Captures the message of an expected rejection.

 @param operation - rejecting operation

 @returns rejection value
 */
async function rejection(operation: () => Promise<unknown>,): Promise<unknown> {
  try {
    await operation();
  }
  catch (error: unknown) {
    return error;
  }
  throw new Error('Operation unexpectedly succeeded.',);
}

await describe({
  name: '',
  children: [
    describe({
      name: isTransactionId.name,
      children: [
        it({
          name: 'accepts a canonical lowercase UUID',
          fn: async function testCanonical(): Promise<void> {
            expect(isTransactionId(ID,),).toBe(true,);
          },
        },),
        ...[
          { label: 'uppercase digits', name: ID.toUpperCase(), },
          { label: 'a missing separator', name: ID.replace('-', 'a',), },
          { label: 'a trailing suffix', name: `${ID}.pending`, },
          { label: 'a short name', name: ID.slice(1,), },
          { label: 'a traversal name', name: '..', },
        ].map(function rejectsName({ label, name, },) {
          return it({
            name: `rejects ${label}`,
            fn: async function testRejected(): Promise<void> {
              expect(isTransactionId(name,),).toBe(false,);
            },
          },);
        },),
      ],
    },),
    describe({
      name: ensureTransactionRoot.name,
      children: [
        it({
          name: 'creates a private registry once and accepts it again',
          fn: async function testCreate(): Promise<void> {
            await using admin = await createAdminDirectory();
            await ensureTransactionRoot(admin.root,);
            await ensureTransactionRoot(admin.root,);
            expect(await readdir(admin.path,),).toEqual(['cli-git-transactions',],);
          },
        },),
        it({
          name: 'rejects a symbolic-link registry',
          fn: async function testSymlinkRoot(): Promise<void> {
            await using admin = await createAdminDirectory();
            await symlink(tmpdir(), admin.root, 'dir',);
            /** Rejected registry. */
            const error = await rejection(async () => ensureTransactionRoot(admin.root,),);
            expect(error,).toBeInstanceOf(CommitTransactionRecoveryError,);
          },
        },),
        it({
          name: 'rejects a registry under a noncanonical parent',
          fn: async function testNoncanonicalParent(): Promise<void> {
            await using admin = await createAdminDirectory();
            /** Link standing in for a redirected Git directory. */
            const linked = join(admin.path, 'linked',);
            await mkdir(join(admin.path, 'real',),);
            await symlink(join(admin.path, 'real',), linked, 'dir',);
            /** Rejected registry. */
            const error = await rejection(async () => ensureTransactionRoot(join(linked, 'cli-git-transactions',),),);
            expect(error,).toBeInstanceOf(TypeError,);
          },
        },),
      ],
    },),
    describe({
      name: publishTransactionDirectory.name,
      children: [
        it({
          name: 'publishes a directory holding exactly the owner record and no staging leftover',
          fn: async function testPublish(): Promise<void> {
            await using admin = await createAdminDirectory();
            await ensureTransactionRoot(admin.root,);
            /** Published transaction directory. */
            const directory = await publishTransactionDirectory({
              root: admin.root,
              transactionId: ID,
              ownerBytes: new TextEncoder().encode('owner\n',),
            },);
            expect(directory,).toBe(join(admin.root, ID,),);
            expect(await readdir(admin.root,),).toEqual([ID,],);
            expect(await readFile(join(directory, 'owner.json',), 'utf8',),).toBe('owner\n',);
          },
        },),
        it({
          name: 'rejects a malformed transaction ID before creating anything',
          fn: async function testMalformedId(): Promise<void> {
            await using admin = await createAdminDirectory();
            await ensureTransactionRoot(admin.root,);
            /** Rejected publication. */
            const error = await rejection(async () => publishTransactionDirectory({
              root: admin.root,
              transactionId: '../escape',
              ownerBytes: new Uint8Array(),
            },),);
            expect(error,).toBeInstanceOf(TypeError,);
            expect(await readdir(admin.root,),).toEqual([],);
          },
        },),
        it({
          name: 'removes the staging candidate when publication fails',
          fn: async function testFailedPublication(): Promise<void> {
            await using admin = await createAdminDirectory();
            await ensureTransactionRoot(admin.root,);
            // A non-empty directory at the published name makes the rename fail after the owner record is written.
            await mkdir(join(admin.root, ID, 'occupied',), { recursive: true, },);
            /** Rejected publication. */
            const error = await rejection(async () => publishTransactionDirectory({
              root: admin.root,
              transactionId: ID,
              ownerBytes: new Uint8Array(),
            },),);
            expect(error,).toBeInstanceOf(Error,);
            expect(await readdir(admin.root,),).toEqual([ID,],);
          },
        },),
      ],
    },),
    describe({
      name: listTransactionEntries.name,
      children: [
        it({
          name: 'returns nothing when the registry does not exist',
          fn: async function testMissingRoot(): Promise<void> {
            await using admin = await createAdminDirectory();
            expect(await listTransactionEntries(admin.root,),).toEqual([],);
          },
        },),
        it({
          name: 'classifies published, staging, and retired directories in name order',
          fn: async function testClassify(): Promise<void> {
            await using admin = await createAdminDirectory();
            await Promise.all([
              mkdir(join(admin.root, OTHER_ID,), { recursive: true, },),
              mkdir(join(admin.root, `${ID}.pending`,), { recursive: true, },),
              mkdir(join(admin.root, `${OTHER_ID}.retired`,), { recursive: true, },),
            ],);
            expect(await listTransactionEntries(admin.root,),).toEqual([
              { kind: 'staging', transactionId: ID, path: join(admin.root, `${ID}.pending`,), },
              { kind: 'transaction', transactionId: OTHER_ID, path: join(admin.root, OTHER_ID,), },
              { kind: 'retired', transactionId: OTHER_ID, path: join(admin.root, `${OTHER_ID}.retired`,), },
            ],);
          },
        },),
        it({
          name: 'rejects a symbolic-link or file entry and an unrecognized name',
          fn: async function testUnsafeEntries(): Promise<void> {
            await using linkAdmin = await createAdminDirectory();
            await mkdir(linkAdmin.root,);
            await symlink(tmpdir(), join(linkAdmin.root, ID,), 'dir',);
            /** Listing rejection. */
            const linkAdminError = await rejection(async () => listTransactionEntries(linkAdmin.root,),);
            expect(String(linkAdminError,),)
              .toContain('Unsafe transaction recovery directory',);
            await using fileAdmin = await createAdminDirectory();
            await mkdir(fileAdmin.root,);
            await writeFile(join(fileAdmin.root, ID,), 'file',);
            /** Listing rejection. */
            const fileAdminError = await rejection(async () => listTransactionEntries(fileAdmin.root,),);
            expect(String(fileAdminError,),)
              .toContain('Unsafe transaction recovery directory',);
            await using nameAdmin = await createAdminDirectory();
            await mkdir(join(nameAdmin.root, 'landing.lock',), { recursive: true, },);
            /** Listing rejection. */
            const nameAdminError = await rejection(async () => listTransactionEntries(nameAdmin.root,),);
            expect(String(nameAdminError,),)
              .toContain('Unexpected transaction registry entry',);
          },
        },),
        it({
          name: 'rejects a registry that is not a directory',
          fn: async function testFileRoot(): Promise<void> {
            await using admin = await createAdminDirectory();
            await writeFile(admin.root, 'file',);
            /** Listing rejection. */
            const adminError = await rejection(async () => listTransactionEntries(admin.root,),);
            expect(String(adminError,),)
              .toContain('Unsafe transaction registry',);
          },
        },),
      ],
    },),
    describe({
      name: removeTransactionDirectory.name,
      children: [
        it({
          name: 'retires a registry directory before deleting it',
          fn: async function testRetire(): Promise<void> {
            await using admin = await createAdminDirectory();
            await mkdir(join(admin.root, ID,), { recursive: true, },);
            await writeFile(join(admin.root, ID, 'owner.json',), '{}\n',);
            await removeTransactionDirectory(join(admin.root, ID,),);
            expect(await readdir(admin.root,),).toEqual([],);
          },
        },),
        it({
          name: 'deletes a legacy or staging directory in place',
          fn: async function testPlainRemoval(): Promise<void> {
            await using admin = await createAdminDirectory();
            await mkdir(join(admin.path, 'cli-git-transaction',),);
            await mkdir(join(admin.root, `${ID}.pending`,), { recursive: true, },);
            await removeTransactionDirectory(join(admin.path, 'cli-git-transaction',),);
            await removeTransactionDirectory(join(admin.root, `${ID}.pending`,),);
            expect(await readdir(admin.path,),).toEqual(['cli-git-transactions',],);
            expect(await readdir(admin.root,),).toEqual([],);
          },
        },),
      ],
    },),
    describe({
      name: inspectRegistryEntry.name,
      children: [
        it({
          name: 'reports a published directory its owner removed after listing as vanished',
          fn: async function testVanished(): Promise<void> {
            await using admin = await createAdminDirectory();
            /** Entry whose directory no longer exists. */
            const inspected = await inspectRegistryEntry({
              kind: 'transaction',
              transactionId: ID,
              path: join(admin.root, ID,),
            },);
            expect(inspected.owner,).toBe('vanished',);
            expect(await recoverInspectedEntry({
              inspected,
              gitPath: '/nonexistent/git',
              effectiveCwd: admin.path,
            },),).toBe('vanished',);
          },
        },),
      ],
    },),
  ],
},);
