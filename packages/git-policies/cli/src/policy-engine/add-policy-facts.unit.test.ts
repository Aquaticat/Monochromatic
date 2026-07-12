import {
  mkdtemp,
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
import nanoSpawn, { SubprocessError, } from 'nano-spawn';
import { resolveGit, } from '../resolve-git.ts';
import {
  ADD_POLICY_FACTS_NOT_APPLICABLE,
  createAddPolicyFacts,
} from './add-policy-facts.ts';

/** Absolute real Git executable. */
const realGitPath = await resolveGit();

/** Disposable repository fixture. */
type RepositoryFixture = Readonly<{
  /** Repository root. */
  path: string;
  /** Removes repository after test. */
  [Symbol.asyncDispose]: () => Promise<void>;
}>;

/**
 * Runs real Git in fixture repository.
 *
 * @param repository - fixture repository root
 *
 * @param args - exact Git arguments
 */
async function runGit({
  repository,
  args,
}: Readonly<{
  repository: string;
  args: readonly string[];
}>,): Promise<void> {
  await nanoSpawn(
    realGitPath,
    args,
    { cwd: repository, },
  );
}

/**
 * Creates configured repository with one baseline commit.
 *
 * @returns disposable committed repository
 */
async function createRepository(): Promise<RepositoryFixture> {
  /** Disposable repository root. */
  const path = await mkdtemp(join(tmpdir(), 'cli-git-add-facts-',),);
  await runGit({ repository: path, args: ['init', '--quiet', '--initial-branch=main',], },);
  await runGit({ repository: path, args: ['config', 'user.email', 'cli-git@example.invalid',], },);
  await runGit({ repository: path, args: ['config', 'user.name', 'cli-git fixture',], },);
  await writeFile(join(path, 'baseline.txt',), 'baseline\n',);
  await runGit({ repository: path, args: ['add', 'baseline.txt',], },);
  await runGit({ repository: path, args: ['commit', '--quiet', '-m', 'baseline',], },);
  return {
    path,
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(path, { recursive: true, force: true, },);
    },
  };
}

/**
 * Creates scoped add facts and returns staged candidate paths.
 *
 * @param repository - fixture repository root
 *
 * @param addArguments - arguments after the add subcommand
 *
 * @returns sorted candidate paths this add staged
 */
async function addFactPaths({
  repository,
  addArguments,
}: Readonly<{
  repository: string;
  addArguments: readonly string[];
}>,): Promise<readonly string[]> {
  /** Scoped private add facts under test. */
  const facts = await createAddPolicyFacts({
    args: [
      '-C',
      repository,
      'add',
      ...addArguments,
    ],
    gitPath: realGitPath,
  },);
  if ((typeof facts) === 'symbol') {
    if (facts !== ADD_POLICY_FACTS_NOT_APPLICABLE)
      throw new TypeError('Unknown add policy facts state.',);
    throw new TypeError('Add facts unexpectedly did not apply.',);
  }
  await using scoped = facts;
  return scoped.paths
    .toSorted();
}

await describe({
  name: 'add policy facts',
  children: [
    it({
      name: 'scopes candidates to entries this add stages',
      fn: async function testAddScope() {
        await using repository = await createRepository();
        // Unrelated content staged earlier must stay outside this add's scope.
        await writeFile(join(repository.path, 'earlier.txt',), 'earlier staged\n',);
        await runGit({ repository: repository.path, args: ['add', 'earlier.txt',], },);
        await writeFile(join(repository.path, 'fresh.txt',), 'fresh\n',);
        expect(await addFactPaths({
          repository: repository.path,
          addArguments: ['fresh.txt',],
        },),).toEqual(['fresh.txt',],);
      },
    },),
    it({
      name: 'includes staged deletion of committed file',
      fn: async function testStagedDeletion() {
        await using repository = await createRepository();
        await rm(join(repository.path, 'baseline.txt',),);
        expect(await addFactPaths({
          repository: repository.path,
          addArguments: ['baseline.txt',],
        },),).toEqual(['baseline.txt',],);
      },
    },),
    it({
      name: 'drops unstaged never-committed file with no scannable state',
      fn: async function testUnstagedNeverCommitted() {
        await using repository = await createRepository();
        // Stage a brand-new file, then delete it from the worktree.
        await writeFile(join(repository.path, 'transient.txt',), 'transient\n',);
        await runGit({ repository: repository.path, args: ['add', 'transient.txt',], },);
        await rm(join(repository.path, 'transient.txt',),);
        // Re-adding the deleted path stages its removal from the index.
        expect(await addFactPaths({
          repository: repository.path,
          addArguments: ['transient.txt',],
        },),).toEqual([],);
      },
    },),
    it({
      name: 'scopes conflict-resolution add to the resolved path',
      fn: async function testConflictResolution() {
        await using repository = await createRepository();
        await writeFile(join(repository.path, 'first.txt',), 'base first\n',);
        await writeFile(join(repository.path, 'second.txt',), 'base second\n',);
        await runGit({ repository: repository.path, args: ['add', 'first.txt', 'second.txt',], },);
        await runGit({ repository: repository.path, args: ['commit', '--quiet', '-m', 'conflict base',], },);
        await runGit({ repository: repository.path, args: ['switch', '--quiet', '--create', 'side',], },);
        await writeFile(join(repository.path, 'first.txt',), 'side first\n',);
        await writeFile(join(repository.path, 'second.txt',), 'side second\n',);
        await runGit({ repository: repository.path, args: ['commit', '--quiet', '--all', '-m', 'side',], },);
        await runGit({ repository: repository.path, args: ['switch', '--quiet', 'main',], },);
        await writeFile(join(repository.path, 'first.txt',), 'main first\n',);
        await writeFile(join(repository.path, 'second.txt',), 'main second\n',);
        await runGit({ repository: repository.path, args: ['commit', '--quiet', '--all', '-m', 'main',], },);
        try {
          await runGit({ repository: repository.path, args: ['merge', 'side',], },);
          throw new Error('Merge unexpectedly succeeded without conflicts.',);
        }
        catch (error: unknown) {
          if (!(error instanceof SubprocessError))
            throw error;
        }
        // Resolve one conflict; the other file stays unmerged.
        await writeFile(join(repository.path, 'first.txt',), 'resolved first\n',);
        expect(await addFactPaths({
          repository: repository.path,
          addArguments: ['first.txt',],
        },),).toEqual(['first.txt',],);
      },
    },),
  ],
},);
