//region Normalization-only recovery fixture
/**
 * Packed recovery of a prepared normalization-only journal with no new commit.
 *
 * @module
 */
import {
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { execute, } from './built-consumer-helpers.ts';
import {
  KILL_WRAPPER_SOURCE,
  waitForOrphan,
} from './built-autofix-recovery-consumer.ts';
import {
  assertFixtureEqual,
  initializePostCommitRepository,
} from './built-post-commit-helpers.ts';

/**
 * Exercises both differing and byte-identical prepared index snapshots.
 *
 * A post-commit kill yields a real prepared journal and selected worktree record.
 * Reclassifying its already-landed HEAD as the no-commit reference simulates an
 * interruption immediately after a normalization-only journal was prepared.
 *
 * @param env - packed Git shim environment
 *
 * @example
 * ```ts
 * await verifyNormalizationRecovery({ env: process.env });
 * ```
 */
export async function verifyNormalizationRecovery({ env, }: Readonly<{
  env: NodeJS.ProcessEnv;
}>,): Promise<void> {
  const repository = '/work/final-newline-normalization-recovery';
  const transaction = `${repository}/.git/cli-git-transaction`;
  const hook = `${repository}/.git/hooks/post-commit`;
  await initializePostCommitRepository(repository,);
  await writeFile(`${repository}/value.txt`, 'before\n',);
  await execute({ command: '/usr/bin/git', args: ['add', 'value.txt',], cwd: repository, },);
  await execute({ command: '/usr/bin/git', args: ['commit', '--quiet', '--message=baseline',], cwd: repository, },);
  for (const [content, sameIndex,] of [
    ['after', false,],
    ['third', true,],
  ] as const) {
    // oxlint-disable-next-line no-await-in-loop -- Each interrupted transaction starts from the preceding recovered HEAD.
    await writeFile(`${repository}/value.txt`, content,);
    // oxlint-disable-next-line no-await-in-loop -- Real Git provides the pre-commit index snapshot.
    await execute({ command: '/usr/bin/git', args: ['add', 'value.txt',], cwd: repository, },);
    // oxlint-disable-next-line no-await-in-loop -- Hook kills wrapper only after its journal is durable and real Git advances HEAD.
    await writeFile(hook, KILL_WRAPPER_SOURCE, { mode: 0o700, },);
    // oxlint-disable-next-line no-await-in-loop -- Each invocation is independent and must be interrupted.
    await execute({
      command: 'git',
      args: ['commit', '--quiet', `--message=${content}`, '--', 'value.txt',],
      cwd: repository,
      env,
      expectedExit: -1,
    },);
    // oxlint-disable-next-line no-await-in-loop -- Waits for orphaned Git after killing its wrapper.
    await waitForOrphan();
    // oxlint-disable-next-line no-await-in-loop -- Prevent hook from affecting recovery.
    await rm(hook,);
    const oid = (await execute({
      command: '/usr/bin/git',
      args: ['rev-parse', 'HEAD',],
      cwd: repository,
    },)).stdout.trim();
    const path = `${transaction}/journal.json`;
    const parsed: unknown = JSON.parse(await readFile(path, 'utf8',),);
    if ((typeof parsed !== 'object') || (parsed === null))
      throw new Error('Prepared normalization fixture journal is malformed.',);
    /** Rebind to identical landed tree as a normalization-only operation. */
    await writeFile(path, `${JSON.stringify({
      ...parsed,
      operation: 'normalize-only',
      originalHead: { kind: 'oid', oid, },
    })}\n`,);
    if (sameIndex) {
      /** Identical indexes must still replay pending worktree completion. */
      // oxlint-disable-next-line no-await-in-loop -- Copy preserves post.index inode bound by journal.
      await writeFile(`${transaction}/post.index`, await readFile(`${transaction}/original.index`,),);
    }
    // oxlint-disable-next-line no-await-in-loop -- Invokes startup recovery through packed shim.
    await execute({ command: 'git', args: ['status', '--short',], cwd: repository, env, },);
    // oxlint-disable-next-line no-await-in-loop -- Each replay must install canonical worktree bytes.
    assertFixtureEqual({
      actual: await readFile(`${repository}/value.txt`, 'utf8',),
      expected: `${content}\n`,
      context: `${content} normalization-only recovered worktree`,
    },);
    /** Recovery must remove its journal even when index snapshots were equal. */
    // oxlint-disable-next-line no-await-in-loop -- Native Git must be usable after replay.
    const status = (await execute({ command: '/usr/bin/git', args: ['status', '--short',], cwd: repository, },)).stdout;
    assertFixtureEqual({
      actual: status,
      expected: sameIndex ? 'M  value.txt\n' : '',
      context: `${content} normalization-only recovered index`,
    },);
    if (sameIndex)
      // oxlint-disable-next-line no-await-in-loop -- Final fixture reset is on disposable state only.
      await execute({ command: '/usr/bin/git', args: ['reset', '--quiet', 'HEAD', '--', 'value.txt',], cwd: repository, },);
  }
}
//endregion Normalization-only recovery fixture
