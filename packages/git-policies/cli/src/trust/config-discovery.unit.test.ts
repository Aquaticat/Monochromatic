import {
  mkdir,
  mkdtemp,
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
import nanoSpawn from 'nano-spawn';
import { resolveGit, } from '../resolve-git.ts';
import {
  ConfigDiscoveryError,
  discoverConfig,
} from './config-discovery.ts';

/** Real Git binary for disposable discovery fixtures. */
const REAL_GIT = await resolveGit();
/** Disposable discovery fixture. */
type DiscoveryFixture = Readonly<{
  /** Repository root. */
  repository: string;
  /** Removes fixture root. */
  [Symbol.asyncDispose]: () => Promise<void>;
}>;

/**
 * Creates disposable real Git repository.
 *
 * @returns disposable discovery fixture
 */
async function createFixture(): Promise<DiscoveryFixture> {
  /** Disposable fixture root. */
  const root = await mkdtemp(join(tmpdir(), 'cli-git-discovery-',),);
  /** Repository root. */
  const repository = join(root, 'repo',);
  await mkdir(repository,);
  await nanoSpawn(REAL_GIT, ['init', '--quiet',], { cwd: repository, },);
  return {
    repository,
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(root, { recursive: true, force: true, },);
    },
  };
}

await describe({
  name: 'repository config discovery',
  children: [
    it({
      name: 'discovers from chained Git global chdir',
      fn: async function testChainedChdir() {
        await using fixture = await createFixture();
        await mkdir(join(fixture.repository, 'nested',),);
        await writeFile(join(fixture.repository, 'cli-git.config.mjs',), 'export default {};\n',);
        /** Config discovered after ordered relative chdir options. */
        const discovered = await discoverConfig([
          '-C', fixture.repository,
          '-C', 'nested',
          'future-command',
        ],);
        expect(discovered,).toMatchObject({
          repositoryRoot: fixture.repository,
          format: 'mjs',
        },);
      },
    },),
    it({
      name: 'prefers MJS when TypeScript config also exists',
      fn: async function testMjsPrecedence() {
        await using fixture = await createFixture();
        await writeFile(join(fixture.repository, 'cli-git.config.ts',), 'export default {};\n',);
        await writeFile(join(fixture.repository, 'cli-git.config.mjs',), 'export default {};\n',);
        /** Preferred discovered config. */
        const discovered = await discoverConfig(['-C', fixture.repository, 'future-command',],);
        expect(discovered,).toMatchObject({ format: 'mjs', });
      },
    },),
    it({
      name: 'rejects symbolic-link config before capture',
      fn: async function testSymlinkRejection() {
        await using fixture = await createFixture();
        /** External symlink target. */
        const target = join(fixture.repository, 'actual.mjs',);
        await writeFile(target, 'export default {};\n',);
        await symlink(target, join(fixture.repository, 'cli-git.config.mjs',),);
        /** Discovery failure retained for assertion. */
        const failure = await (async function captureDiscoveryFailure(): Promise<unknown> {
          try {
            return await discoverConfig(['-C', fixture.repository, 'future-command',],);
          }
          catch (error: unknown) {
            return error;
          }
        })();
        expect(failure,).toBeInstanceOf(ConfigDiscoveryError,);
      },
    },),
  ],
},);
