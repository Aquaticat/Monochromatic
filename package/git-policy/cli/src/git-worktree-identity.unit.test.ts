import { mkdir, realpath, } from 'node:fs/promises';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { resolveGitWorktreeIdentity, } from './git-worktree-identity.ts';
import { resolveGit, } from './resolve-git.ts';
import {
  createTempDirectory,
  initializeMainRepository,
  initializeRepository,
  runRealGit,
} from './worktree-copy-fixture.unit.test.ts';

/**
 * Absolute real-Git executable for identity fixtures.
 */
const gitPath = await resolveGit();

/**
 * Temporarily overrides one process environment entry.
 *
 * @param key - environment key to replace
 *
 * @param value - temporary environment value
 *
 * @returns disposable environment restoration
 *
 * @mutates process.env
 *
 * @example
 * ```ts
 * using override = overrideEnvironment({ key: 'GIT_DIR', value: '/repo/.git' });
 * ```
 */
function overrideEnvironment({
  key,
  value,
}: Readonly<{
  key: string;
  value: string;
}>,): Disposable {
  /**
   * Whether environment originally owned key.
   */
  const hadOriginal = Object.hasOwn(process.env, key,);
  /**
   * Original value retained only when key was present.
   */
  const original = process.env[key] ?? '';
  process.env[key] = value;
  return {
    [Symbol.dispose](): void {
      if (hadOriginal) {
        process.env[key] = original;
        return;
      }
      delete process.env[key];
    },
  };
}

await describe({
  name: resolveGitWorktreeIdentity.name,
  concurrency: 1,
  children: [
    it({
      name: 'classifies directory outside repository',
      fn: async () => {
        await using fixture = await createTempDirectory();

        /**
         * Identity resolved outside repository.
         */
        const identity = await resolveGitWorktreeIdentity({
          args: [
            '-C',
            fixture.path,
            'status',
          ],
          gitPath,
        },);

        expect(identity,).toEqual({
          kind: 'outside-worktree',
          effectiveCwd: fixture.path,
        },);
      },
    },),

    it({
      name: 'returns canonical main worktree identity',
      fn: async () => {
        await using fixture = await createTempDirectory();
        /**
         * Main repository root under disposable fixture.
         */
        const mainRoot = join(fixture.path, 'main',);
        await initializeMainRepository(mainRoot,);

        /**
         * Canonical main repository identity.
         */
        const identity = await resolveGitWorktreeIdentity({
          args: [
            '-C',
            mainRoot,
            'status',
          ],
          gitPath,
        },);
        /**
         * Canonical main Git directory expected in identity.
         */
        const expectedGitDir = await realpath(join(mainRoot, '.git',),);

        expect(identity,).toEqual({
          kind: 'main-worktree',
          commonDir: expectedGitDir,
          effectiveCwd: mainRoot,
          gitDir: expectedGitDir,
          worktreeRoot: await realpath(mainRoot,),
        },);
      },
    },),

    it({
      name: 'returns canonical linked worktree identity',
      fn: async () => {
        await using fixture = await createTempDirectory();
        /**
         * Linked source root created with sibling main repository.
         */
        const linkedRoot = join(fixture.path, 'linked',);
        await initializeRepository(linkedRoot,);

        /**
         * Canonical linked repository identity.
         */
        const identity = await resolveGitWorktreeIdentity({
          args: [
            '-C',
            linkedRoot,
            'status',
          ],
          gitPath,
        },);

        expect(identity.kind,).toBe('linked-worktree',);
        if (identity.kind !== 'linked-worktree')
          throw new Error('Expected linked worktree identity.',);
        expect(identity.gitDir,).not.toBe(identity.commonDir,);
        expect(identity.worktreeRoot,).toBe(await realpath(linkedRoot,),);
      },
    },),

    it({
      name: 'returns canonical bare repository identity',
      fn: async () => {
        await using fixture = await createTempDirectory();
        /**
         * Bare repository selected through explicit Git directory.
         */
        const bareRoot = join(fixture.path, 'bare.git',);
        await runRealGit({
          cwd: fixture.path,
          args: [
            'init',
            '--bare',
            bareRoot,
          ],
        },);

        /**
         * Canonical bare repository identity.
         */
        const identity = await resolveGitWorktreeIdentity({
          args: [
            '--git-dir',
            bareRoot,
            'status',
          ],
          gitPath,
        },);
        /**
         * Canonical bare Git directory expected for both administrative fields.
         */
        const expectedGitDir = await realpath(bareRoot,);

        expect(identity,).toEqual({
          kind: 'bare-repository',
          commonDir: expectedGitDir,
          effectiveCwd: process.cwd(),
          gitDir: expectedGitDir,
        },);
      },
    },),

    it({
      name: 'honors pre-subcommand chdir selection',
      fn: async () => {
        await using fixture = await createTempDirectory();
        /**
         * Main repository selected from unrelated invocation cwd.
         */
        const mainRoot = join(fixture.path, 'main',);
        await initializeMainRepository(mainRoot,);

        /**
         * Main identity selected through pre-subcommand chdir.
         */
        const identity = await resolveGitWorktreeIdentity({
          args: [
            '-C',
            mainRoot,
            'status',
          ],
          gitPath,
        },);

        expect(identity.kind,).toBe('main-worktree',);
      },
    },),

    it({
      name: 'honors explicit git-dir and work-tree selection',
      fn: async () => {
        await using fixture = await createTempDirectory();
        /**
         * Unrelated cwd for explicit repository-selection options.
         */
        const invocationRoot = join(fixture.path, 'invocation',);
        /**
         * Main repository selected explicitly from unrelated cwd.
         */
        const mainRoot = join(fixture.path, 'main',);
        await Promise.all([
          mkdir(invocationRoot, { recursive: true, },),
          initializeMainRepository(mainRoot,),
        ],);

        /**
         * Main identity selected through explicit administrative options.
         */
        const identity = await resolveGitWorktreeIdentity({
          args: [
            '-C',
            invocationRoot,
            '--git-dir',
            join(mainRoot, '.git',),
            '--work-tree',
            mainRoot,
            'status',
          ],
          gitPath,
        },);

        expect(identity.kind,).toBe('main-worktree',);
      },
    },),

    it({
      name: 'honors chained relative chdir selection',
      fn: async () => {
        await using fixture = await createTempDirectory();
        /**
         * Main repository reached through relative second chdir.
         */
        const mainRoot = join(fixture.path, 'main',);
        await initializeMainRepository(mainRoot,);

        /**
         * Identity selected after ordered absolute and relative chdir options.
         */
        const identity = await resolveGitWorktreeIdentity({
          args: [
            '-C',
            fixture.path,
            '-C',
            'main',
            'status',
          ],
          gitPath,
        },);

        expect(identity.kind,).toBe('main-worktree',);
        expect(identity.effectiveCwd,).toBe(mainRoot,);
      },
    },),

    it({
      name: 'honors glued git-dir and work-tree selection',
      fn: async () => {
        await using fixture = await createTempDirectory();
        /**
         * Main repository selected by glued global options.
         */
        const mainRoot = join(fixture.path, 'main',);
        await initializeMainRepository(mainRoot,);

        /**
         * Main identity selected through glued administrative options.
         */
        const identity = await resolveGitWorktreeIdentity({
          args: [
            `--git-dir=${join(mainRoot, '.git',)}`,
            `--work-tree=${mainRoot}`,
            'status',
          ],
          gitPath,
        },);

        expect(identity.kind,).toBe('main-worktree',);
      },
    },),

    it({
      name: 'honors inherited git-dir and work-tree selection',
      fn: async () => {
        await using fixture = await createTempDirectory();
        /**
         * Main repository selected by inherited Git environment.
         */
        const mainRoot = join(fixture.path, 'main',);
        await initializeMainRepository(mainRoot,);
        /**
         * Temporary inherited Git-directory selection.
         */
        using gitDirOverride = overrideEnvironment({
          key: 'GIT_DIR',
          value: join(mainRoot, '.git',),
        },);
        /**
         * Temporary inherited worktree selection.
         */
        using workTreeOverride = overrideEnvironment({
          key: 'GIT_WORK_TREE',
          value: mainRoot,
        },);

        /**
         * Main identity selected through inherited environment.
         */
        const identity = await resolveGitWorktreeIdentity({
          args: ['status',],
          gitPath,
        },);

        expect(identity.kind,).toBe('main-worktree',);
      },
    },),

    it({
      name: 'maps invalid explicit git-dir to outside worktree',
      fn: async () => {
        await using fixture = await createTempDirectory();

        /**
         * Outside identity produced after real Git rejects explicit missing directory.
         */
        const identity = await resolveGitWorktreeIdentity({
          args: [
            '--git-dir',
            join(fixture.path, 'missing.git',),
            'status',
          ],
          gitPath,
        },);

        expect(identity.kind,).toBe('outside-worktree',);
      },
    },),
  ],
},);
