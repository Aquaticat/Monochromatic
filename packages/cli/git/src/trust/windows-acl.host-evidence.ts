/**
 * Windows trust-registry ACL host evidence. @module
 */
import {
  mkdtemp,
  realpath,
  rm,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';
import nanoSpawn from 'nano-spawn';
import { readPrivateFile, } from './record-validation.ts';
import {
  ensureRegistryRoot,
  writePrivateFile,
} from './registry-io.ts';

if (process.platform !== 'win32')
  throw new Error('Windows ACL host evidence must run on Windows.',);
/**
 * Canonical disposable parent.
 */
const root = await realpath(
  await mkdtemp(join(
    tmpdir(),
    'cli-git-windows-acl-',
  ),),
);
/**
 * Disposable fixture cleanup.
 */
await using fixture = {
  async [Symbol.asyncDispose](): Promise<void> {
    await rm(
      root,
      {
        recursive: true,
        force: true,
      },
    );
  },
};
/**
 * Private registry root under disposable canonical parent.
 */
const registryRoot = join(
  root,
  'registry',
);
await ensureRegistryRoot(registryRoot,);
/**
 * Private snapshot fixture.
 */
const snapshotPath = join(
  registryRoot,
  'snapshot.mjs',
);
await writePrivateFile({
  path: snapshotPath,
  bytes: new TextEncoder().encode('export default {};\n',),
},);
await readPrivateFile(snapshotPath,);
await nanoSpawn(
  'icacls.exe',
  [
  snapshotPath,
  '/inheritance:e',
  '/grant',
  '*S-1-1-0:(R)',
],
);
/**
 * Rejection after broadening fixture ACL.
 */
const broadenedFailure = await (async function captureBroadenedAclFailure(): Promise<unknown> {
  try {
    return await readPrivateFile(snapshotPath,);
  }
  catch (error: unknown) {
    return error;
  }
})();
if (!(Error.isError(broadenedFailure,)))
  throw new Error('Broadened trust ACL was accepted.',);
console.log('windows-trust-acl-ok',);
