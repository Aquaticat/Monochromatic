/**
 Test-only account preload regression test.

 @module
 */
import {
  mkdir,
  mkdtemp,
  readdir,
  realpath,
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
import { disposableAccountEnvironment, } from './account-home-fixture.unit.test.ts';

/** Built wrapper entry. */
const WRAPPER = join(import.meta.dirname, '..', '..', 'dist', 'final', 'node', 'index.mjs',);

await describe({
  name: disposableAccountEnvironment.name,
  children: [
    it({
      name: 'makes a spawned Node process report the disposable home as its account home',
      fn: async function testAccountHome(): Promise<void> {
        /** Disposable home that need not exist for the lookup. */
        const home = join(import.meta.dirname, 'disposable-home-probe',);
        /** Account home the child reads through a named ESM import. */
        const result = await nanoSpawn(
          process.execPath,
          ['--input-type=module', '--eval', 'import { userInfo } from "node:os"; console.log(userInfo().homedir);',],
          { env: { ...process.env, ...disposableAccountEnvironment(home,), }, },
        );
        expect(result.stdout,).toBe(home,);
      },
    },),
    it({
      name: 'makes the built wrapper install trust records under the disposable home',
      fn: async function testWrapperRegistry(): Promise<void> {
        /** Created disposable root. */
        const created = await mkdtemp(join(tmpdir(), 'cli-git-account-home-',),);
        /** Canonical disposable root. */
        const root = await realpath(created,);
        /** Removes the disposable root. */
        await using _cleanup = {
          async [Symbol.asyncDispose](): Promise<void> {
            await rm(root, { recursive: true, force: true, },);
          },
        };
        /** Disposable home. */
        const home = join(root, 'home',);
        /** Repository with a config. */
        const repository = join(root, 'repo',);
        await mkdir(home,);
        await mkdir(repository,);
        await nanoSpawn(await resolveRealGit(), ['init', '--quiet',], { cwd: repository, },);
        await writeFile(join(repository, 'cli-git.config.mjs',), 'export default { plugins: {} };\n',);
        await nanoSpawn(process.execPath, [WRAPPER, 'cli-git', 'trust', '--yes',], {
          cwd: repository,
          env: { ...process.env, ...disposableAccountEnvironment(home,), },
        },);
        /** Record files under the disposable account registry. */
        const records = (await readdir(join(home, '.local', 'state', 'cli-git', 'trust', 'v1', 'records',), { recursive: true, },))
          .filter(function isRecord(path,) {
            return path.endsWith('record.json',);
          },);
        expect(records.length,).toBe(1,);
      },
    },),
  ],
},);
