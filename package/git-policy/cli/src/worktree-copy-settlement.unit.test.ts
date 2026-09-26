/**
 Worktree-copy settlement lock scope:
 only commands that create or move worktrees hold it,
 so other wrapped commands in a linked worktree run while one of them is still running.

 @module
 */
import { once, } from 'node:events';
import {
  mkdir,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  barrierSource,
  waitForFile,
  writeNodeProgram,
} from './policy-engine/commit-landing-fixture.unit.test.ts';
import { createProcessGroups, } from './policy-engine/process-group-fixture.unit.test.ts';
import {
  captureWrapper,
  createTempDirectory,
  initializeRepository,
  requireSuccess,
  WRAPPER_PATH,
} from './worktree-copy-fixture.unit.test.ts';

await describe({
  name: 'worktree-copy settlement lock scope',
  children: [
    it({
      name: 'a wrapped command in a linked worktree runs while another wrapped non-worktree command is still running',
      fn: async function testConcurrentLinked(): Promise<void> {
        await using fixture = await createTempDirectory();
        /** Process groups killed before the directory is removed. */
        await using groups = createProcessGroups();
        /** Linked source worktree. */
        const repositoryRoot = join(fixture.path, 'repository',);
        await initializeRepository(repositoryRoot,);
        /** Shared hooks directory. */
        const hooks = join(`${repositoryRoot}-main`, '.git', 'hooks',);
        await mkdir(hooks, { recursive: true, },);
        /** Barrier files. */
        const ready = join(fixture.path, 'blocker.ready',);
        /** Barrier release. */
        const release = join(fixture.path, 'blocker.release',);
        await writeNodeProgram({ path: join(hooks, 'pre-auto-gc',), source: barrierSource({ ready, release, },), },);
        /** Wrapped `git hook run`, blocked in its hook. */
        const blocker = groups.spawn({ command: process.execPath, args: [WRAPPER_PATH, 'hook', 'run', 'pre-auto-gc',], options: { cwd: repositoryRoot, stdio: 'ignore', }, },);
        /** Blocker exit. */
        const blockerExit = once(blocker, 'exit',);
        await waitForFile({ path: ready, },);
        /** Concurrent wrapped command. */
        const status = requireSuccess(await captureWrapper({ cwd: repositoryRoot, args: ['status', '--short',], },),);
        expect(status.stderr,).not.toContain('worktree-copy',);
        expect(blocker.exitCode,).toBeNull();
        await writeFile(release, '',);
        /** Blocker exit code and signal. */
        const exit: readonly unknown[] = await blockerExit;
        expect(exit[0],).toBe(0,);
      },
    },),
  ],
},);
