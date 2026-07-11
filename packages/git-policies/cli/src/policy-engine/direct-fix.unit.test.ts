/**
 * Direct worktree policy-fix integration tests.
 *
 * @module
 */
import {
  mkdtemp,
  readFile,
  rm,
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
import { runManagementCommand, } from '../management.ts';
import { createFinalNewlinePatch, } from './final-newline-patch.ts';
import { runDirectFix, } from './direct-fix.ts';
import type { RuntimePolicyDefinition, } from './types.ts';

/** Real Git executable for disposable fixture setup and assertions. */
const REAL_GIT = '/usr/bin/git';

/** Disposable direct-fix repository. */
type DirectFixFixture = Readonly<{
  /** Repository root. */
  repository: string;
  /** Removes fixture. */
  [Symbol.asyncDispose]: () => Promise<void>;
}>;

/**
 * Runs real Git in fixture repository.
 *
 * @param repository - fixture repository root
 *
 * @param args - exact Git arguments
 */
async function git({
  repository,
  args,
}: Readonly<{
  repository: string;
  args: readonly string[];
}>,): Promise<void> {
  await nanoSpawn(
    REAL_GIT,
    args,
    { cwd: repository, },
  );
}

/**
 * Creates committed two-file direct-fix fixture.
 *
 * @returns disposable fixture
 */
async function createFixture(): Promise<DirectFixFixture> {
  /** Disposable repository root. */
  const repository = await mkdtemp(join(tmpdir(), 'cli-git-direct-fix-',),);
  await git({ repository, args: ['init', '--quiet', '--initial-branch=main',], },);
  await git({ repository, args: ['config', 'user.email', 'fixture@example.invalid',], },);
  await git({ repository, args: ['config', 'user.name', 'Fixture',], },);
  await writeFile(join(repository, 'one.txt',), 'one\n',);
  await writeFile(join(repository, 'two.txt',), 'two\n',);
  await git({ repository, args: ['add', 'one.txt', 'two.txt',], },);
  await git({ repository, args: ['commit', '--quiet', '--message=baseline',], },);
  return {
    repository,
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(repository, { recursive: true, force: true, },);
    },
  };
}

await describe({
  name: 'direct policy fix',
  children: [
    it({
      name: 'fixes explicit paths then all scope without changing index',
      fn: async function testDirectFixScopes() {
        await using fixture = await createFixture();
        /** Exact real index bytes before direct worktree fixes. */
        const indexBefore = await readFile(join(fixture.repository, '.git/index',),);
        await writeFile(join(fixture.repository, 'one.txt',), 'one',);
        await writeFile(join(fixture.repository, 'two.txt',), 'two',);
        expect(await runManagementCommand({
          args: [
            'fix',
            '--policy',
            'final-newline',
            '--',
            'one.txt',
          ],
          gitGlobalArgs: [
            '-C',
            fixture.repository,
          ],
        },),).toBe(0,);
        expect(await readFile(join(fixture.repository, 'one.txt',), 'utf8',),).toBe('one\n',);
        expect(await readFile(join(fixture.repository, 'two.txt',), 'utf8',),).toBe('two',);
        expect(
          await readFile(join(fixture.repository, '.git/index',),),
        ).toEqual(indexBefore,);
        expect(await runManagementCommand({
          args: [
            'fix',
            '--all',
          ],
          gitGlobalArgs: [
            '-C',
            fixture.repository,
          ],
        },),).toBe(0,);
        expect(await readFile(join(fixture.repository, 'two.txt',), 'utf8',),).toBe('two\n',);
        expect(
          await readFile(join(fixture.repository, '.git/index',),),
        ).toEqual(indexBefore,);
      },
    },),
    it({
      name: 'rejects repeated private candidate state without changing worktree',
      fn: async function testDirectFixCycle() {
        await using fixture = await createFixture();
        /** Exact real index bytes before cyclic policy evaluation. */
        const indexBefore = await readFile(join(fixture.repository, '.git/index',),);
        /** Exact original worktree bytes that cycle must preserve. */
        const worktreeBefore = await readFile(join(fixture.repository, 'one.txt',),);
        /** Fixture policy alternating one candidate between two exact states. */
        const alternatingPolicy: RuntimePolicyDefinition = {
          name: 'alternating',
          defaultSeverity: 'error',
          warnSafe: false,
          triggers: ['direct-fix',],
          async check({ context, }) {
            /** Sole selected fixture candidate. */
            const [selected,] = await context.git.candidates();
            if ((selected === undefined) || ((typeof selected.revision) === 'symbol')
              || ((selected.mode !== 'regular') && (selected.mode !== 'executable')))
              return [];
            /** Exact current fixture bytes. */
            const original = await selected.bytes();
            /** Alternating replacement bytes. */
            const replacement = new TextEncoder().encode(new TextDecoder().decode(original,) === 'one\n'
              ? 'other\n'
              : 'one\n',);
            return [{
              code: 'alternate',
              message: 'Alternate exact candidate state.',
              path: selected.path,
              patch: createFinalNewlinePatch({
                targetId: selected.targetId,
                path: selected.path,
                revision: selected.revision,
                mode: selected.mode,
                original,
                replacement,
              },),
            },];
          },
        };
        /** Failed cyclic direct-fix result. */
        const result = await runDirectFix({
          gitGlobalArgs: [
            '-C',
            fixture.repository,
          ],
          pathspecs: ['one.txt',],
          policyOptions: {
            registeredPolicies: [alternatingPolicy,],
          },
        },);
        expect(result.policyResult.exitCode,).toBe(2,);
        expect(result.policyResult.events[0]?.message,).toContain('repeated candidate-state cycle',);
        expect(await readFile(join(fixture.repository, 'one.txt',),)).toEqual(worktreeBefore,);
        expect(await readFile(join(fixture.repository, '.git/index',),)).toEqual(indexBefore,);
      },
    },),
  ],
},);
