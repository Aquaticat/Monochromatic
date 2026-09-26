/**
 Shadow repository file formats: config values read back by real Git, the config layout, the packed-refs snapshot, and private entries.

 @module
 */
import {
  mkdtemp,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';
import { resolveRealGit, } from '@monochromatic-dev/git-executable/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import nanoSpawn from 'nano-spawn';
import { internalTestExports, } from '../../dist/final/node/index.mjs';

const {
  formatPackedRefs,
  formatShadowConfig,
  isPrivateShadowEntry,
  quoteGitConfigValue,
} = internalTestExports;

/**
 Absolute real Git executable.
 */
const REAL_GIT = await resolveRealGit();

/**
 Environment isolating Git from host configuration.
 */
const ISOLATED_ENV: NodeJS.ProcessEnv = {
  ...process.env,
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
};

/**
 Scratch directory.

 @returns directory and disposer
 */
async function scratch(): Promise<AsyncDisposable & Readonly<{ path: string; }>> {
  /**
   Directory.
   */
  const path = await mkdtemp(join(tmpdir(), 'cli-git-shadow-format-',),);
  return {
    path,
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(path, { recursive: true, force: true, },);
    },
  };
}

/**
 Object ID of the right length.
 */
const OID = 'a'.repeat(40,);

await describe({
  name: 'shadow repository formats',
  children: [
    it({
      name: `${quoteGitConfigValue.name} values read back verbatim by git config`,
      fn: async function testConfigQuoting(): Promise<void> {
        await using directory = await scratch();
        /** Adversarial values: comment characters, quotes, backslashes, tabs, newlines, and edge whitespace. */
        const values = ['/path with; semicolon # hash', 'say "hi"', String.raw`C:\dir\n`, 'tab\there', 'line\nbreak', '  edges  ', '',];
        /** Config file. */
        const file = join(directory.path, 'config',);
        await writeFile(file, `[fixture]\n${values.map(function line(value, index,): string {
          return `\tvalue${String(index,)} = ${quoteGitConfigValue(value,)}\n`;
        },).join('',)}`,);
        /** Values Git reads back. */
        const readBack = await Promise.all(values.map(async function readValue(_value, index,): Promise<string> {
          return (await nanoSpawn(REAL_GIT, ['config', '--file', file, '--get', `fixture.value${String(index,)}`,], { env: ISOLATED_ENV, },)).stdout;
        },),);
        expect(readBack,).toEqual(values,);
      },
    },),
    it({
      name: `${formatShadowConfig.name} is valid Git config with the copied format, the include, the worktree, and automatic maintenance off`,
      fn: async function testShadowConfig(): Promise<void> {
        await using directory = await scratch();
        /** Config file. */
        const file = join(directory.path, 'config',);
        await writeFile(file, formatShadowConfig({
          format: { version: '1', extensions: [['objectFormat', 'sha256',], ['worktreeConfig', 'true',],], },
          commonDir: '/repo "quoted"/.git',
          worktreeRoot: '/repo "quoted"',
        },),);
        /** Git's reading of the file without following the include. */
        const listing = (await nanoSpawn(REAL_GIT, ['config', '--file', file, '--no-includes', '--list',], { env: ISOLATED_ENV, },)).stdout;
        expect(listing.split('\n',),).toEqual([
          'core.repositoryformatversion=1',
          'core.hookspath=/repo "quoted"/.git/hooks',
          'extensions.objectformat=sha256',
          'extensions.worktreeconfig=true',
          'include.path=/repo "quoted"/.git/config',
          'core.worktree=/repo "quoted"',
          'gc.auto=0',
          'maintenance.auto=false',
        ],);
      },
    },),
    it({
      name: `${formatPackedRefs.name} writes a sorted header and every direct ref except the private target, never a symbolic ref`,
      fn: async function testPackedRefs(): Promise<void> {
        expect(formatPackedRefs({
          refs: [
            { name: 'refs/heads/main', oid: OID, symref: '', },
            { name: 'refs/heads/other', oid: OID, symref: '', },
            { name: 'refs/remotes/origin/HEAD', oid: OID, symref: 'refs/remotes/origin/main', },
            { name: 'refs/tags/v1', oid: OID, symref: '', },
          ],
          targetRef: 'refs/heads/main',
        },),).toBe(`# pack-refs with: sorted \n${OID} refs/heads/other\n${OID} refs/tags/v1\n`,);
      },
    },),
    it({
      name: `${isPrivateShadowEntry.name} keeps ref stores, the index, config, objects, conclusion state, cli-git state, and every lock private`,
      fn: async function testPrivateEntries(): Promise<void> {
        expect([
          'HEAD',
          'refs',
          'packed-refs',
          'reftable',
          'logs',
          'index',
          'config',
          'config.worktree',
          'objects',
          'COMMIT_EDITMSG',
          'MERGE_HEAD',
          'sequencer',
          'cli-git',
          'cli-git-transactions',
          'index.lock',
          'shallow.lock',
        ].every(function isPrivate(name,): boolean {
          return isPrivateShadowEntry(name,);
        },),).toBe(true,);
        expect(['hooks', 'info', 'rr-cache', 'shallow', 'modules', 'worktrees', 'description', 'FETCH_HEAD',].some(function isPrivate(name,): boolean {
          return isPrivateShadowEntry(name,);
        },),).toBe(false,);
      },
    },),
  ],
},);
