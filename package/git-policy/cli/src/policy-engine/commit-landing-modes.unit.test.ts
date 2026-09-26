/**
 Commit modes and conclusions through private preparation, compared with native Git on disposable repositories.

 @module
 */
import {
  access,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import nanoSpawn from 'nano-spawn';
import {
  createLandingRepository,
  git,
  gitOutcome,
  type LandingRepository,
  leftovers,
  runWrapper,
  writeWorktreeFile,
} from './commit-landing-fixture.unit.test.ts';

/**
 Conclusion state files native `git commit` removes.
 */
const CONCLUSION_FILES = [
  'MERGE_HEAD',
  'MERGE_MSG',
  'MERGE_MODE',
  'AUTO_MERGE',
  'CHERRY_PICK_HEAD',
  'REVERT_HEAD',
  'sequencer',
  'ORIG_HEAD',
] as const;

/**
 Reports which conclusion state entries exist in a repository's Git directory.

 @param repository - fixture repository

 @returns existing entry names
 */
async function conclusionState(repository: LandingRepository,): Promise<readonly string[]> {
  /**
   Presence of each entry.
   */
  const present = await Promise.all(CONCLUSION_FILES.map(async function exists(name,): Promise<boolean> {
    try {
      await access(join(repository.gitDir, name,),);
      return true;
    }
    catch (error: unknown) {
      if (Error.isError(error,) && ('code' in error) && (error.code === 'ENOENT'))
        return false;
      throw error;
    }
  },),);
  return CONCLUSION_FILES.filter(function isPresent(_name, index,): boolean {
    return present[index] === true;
  },);
}

/**
 Builds two identical repositories stopped at the same conclusion, one for native Git and one for the wrapper.

 @param operation - conflicting operation: merge, cherry-pick, or revert

 @returns native and wrapper repositories
 */
async function conflictedPair(operation: 'merge' | 'cherry-pick' | 'revert',): Promise<readonly [LandingRepository, LandingRepository]> {
  /**
   Both repositories built by identical deterministic steps.
   */
  return Promise.all([0, 1,].map(async function build(): Promise<LandingRepository> {
    /**
     One repository.
     */
    const repository = await createLandingRepository();
    await writeWorktreeFile({ repository, name: 'x.txt', content: 'one\n', },);
    await git({ repository, args: ['add', 'x.txt',], },);
    await git({ repository, args: ['commit', '--quiet', '-m', 'x one',], },);
    await git({ repository, args: ['switch', '--quiet', '-c', 'side',], },);
    await writeWorktreeFile({ repository, name: 'x.txt', content: 'side\n', },);
    await git({ repository, args: ['commit', '--quiet', '-am', 'x side',], },);
    await git({ repository, args: ['switch', '--quiet', 'main',], },);
    await writeWorktreeFile({ repository, name: 'x.txt', content: 'main\n', },);
    await git({ repository, args: ['commit', '--quiet', '-am', 'x main',], },);
    /**
     Conflicting operation arguments.
     */
    const args = operation === 'merge'
      ? ['merge', 'side',]
      : (operation === 'cherry-pick' ? ['cherry-pick', 'side',] : ['revert', '--no-edit', 'HEAD~1',]);
    /** Conflicting operation outcome. */
    const conflicted = await gitOutcome({ repository, args, },);
    if (conflicted.exitCode === 0)
      throw new Error(`${operation} unexpectedly succeeded without a conflict.`,);
    await writeWorktreeFile({ repository, name: 'x.txt', content: 'resolved\n', },);
    await git({ repository, args: ['add', 'x.txt',], },);
    return repository;
  },),) as Promise<readonly [LandingRepository, LandingRepository]>;
}

await describe({
  name: 'commit landing modes',
  children: [
    it({
      name: 'an explicit-path commit lands only its paths and keeps unrelated staging',
      fn: async function testExplicitPath(): Promise<void> {
        await using repository = await createLandingRepository();
        await writeWorktreeFile({ repository, name: 'staged.txt', content: 'staged\n', },);
        await git({ repository, args: ['add', 'staged.txt',], },);
        await writeWorktreeFile({ repository, name: 'a.txt', content: 'a\n', },);
        /** Commit outcome. */
        const outcome = await runWrapper({ repository, args: ['commit', '-m', 'explicit', 'a.txt',], },);
        expect(outcome.exitCode,).toBe(0,);
        expect(await git({ repository, args: ['show', '--name-only', '--format=', 'HEAD',], },),).toBe('a.txt',);
        expect(await git({ repository, args: ['diff', '--cached', '--name-only',], },),).toBe('staged.txt',);
        expect(await git({ repository, args: ['status', '--porcelain',], },),).toBe('A  staged.txt',);
        expect(await leftovers(repository,),).toEqual([],);
      },
    },),
    it({
      name: 'an index commit and a clean commit -a land through private preparation',
      fn: async function testIndexAndAll(): Promise<void> {
        await using repository = await createLandingRepository();
        await writeWorktreeFile({ repository, name: 'b.txt', content: 'b\n', },);
        await git({ repository, args: ['add', 'b.txt',], },);
        /** Index commit. */
        const indexed = await runWrapper({ repository, args: ['commit', '--no-enforce-only', '-m', 'index',], },);
        expect(indexed.exitCode,).toBe(0,);
        expect(await git({ repository, args: ['show', '--name-only', '--format=', 'HEAD',], },),).toBe('b.txt',);
        await writeWorktreeFile({ repository, name: 'base.txt', content: 'changed\n', },);
        await writeWorktreeFile({ repository, name: 'untracked.txt', content: 'u\n', },);
        /** Commit -a. */
        const all = await runWrapper({ repository, args: ['commit', '--no-enforce-only', '-am', 'all',], },);
        expect(all.exitCode,).toBe(0,);
        expect(await git({ repository, args: ['show', '--name-only', '--format=%s', 'HEAD',], },),).toBe('all\n\nbase.txt',);
        expect(await git({ repository, args: ['status', '--porcelain',], },),).toBe('?? untracked.txt',);
        expect(await leftovers(repository,),).toEqual([],);
      },
    },),
    it({
      name: 'an amend produces the commit native Git produces',
      fn: async function testAmend(): Promise<void> {
        /** Native and wrapper repositories. */
        const [native, wrapped,] = await Promise.all([createLandingRepository(), createLandingRepository(),],);
        await using _native = native;
        await using _wrapped = wrapped;
        await git({ repository: native, args: ['commit', '--quiet', '--amend', '-m', 'amended',], },);
        /** Wrapper amend. */
        const outcome = await runWrapper({ repository: wrapped, args: ['commit', '--amend', '-m', 'amended',], },);
        expect(outcome.exitCode,).toBe(0,);
        expect(await git({ repository: wrapped, args: ['cat-file', 'commit', 'HEAD',], },),)
          .toBe(await git({ repository: native, args: ['cat-file', 'commit', 'HEAD',], },),);
        expect(await leftovers(wrapped,),).toEqual([],);
      },
    },),
    it({
      name: 'a mid-sequence cherry-pick conclusion keeps the sequencer as native Git does',
      fn: async function testMidSequence(): Promise<void> {
        /** Native and wrapper repositories stopped at the first of two picks. */
        const [native, wrapped,] = await Promise.all([0, 1,].map(async function build(): Promise<LandingRepository> {
          /** One repository. */
          const repository = await createLandingRepository();
          await git({ repository, args: ['switch', '--quiet', '-c', 'side',], },);
          await writeWorktreeFile({ repository, name: 'base.txt', content: 'side\n', },);
          await git({ repository, args: ['commit', '--quiet', '-am', 'side one',], },);
          await writeWorktreeFile({ repository, name: 'y.txt', content: 'y\n', },);
          await git({ repository, args: ['add', 'y.txt',], },);
          await git({ repository, args: ['commit', '--quiet', '-m', 'side two',], },);
          await git({ repository, args: ['switch', '--quiet', 'main',], },);
          await writeWorktreeFile({ repository, name: 'base.txt', content: 'main\n', },);
          await git({ repository, args: ['commit', '--quiet', '-am', 'main change',], },);
          await gitOutcome({ repository, args: ['cherry-pick', 'side~1', 'side',], },);
          await writeWorktreeFile({ repository, name: 'base.txt', content: 'resolved\n', },);
          await git({ repository, args: ['add', 'base.txt',], },);
          return repository;
        },),);
        await using _native = native;
        await using _wrapped = wrapped;
        await git({ repository: native, args: ['commit', '--quiet', '--no-edit',], },);
        /** Wrapper conclusion. */
        const outcome = await runWrapper({ repository: wrapped, args: ['commit', '--no-edit',], },);
        expect(outcome.exitCode,).toBe(0,);
        expect(await git({ repository: wrapped, args: ['rev-parse', 'HEAD',], },),).toBe(await git({ repository: native, args: ['rev-parse', 'HEAD',], },),);
        expect(await conclusionState(wrapped,),).toEqual(await conclusionState(native,),);
        expect(await readFile(join(wrapped.gitDir, 'sequencer', 'todo',), 'utf8',),).toBe(await readFile(join(native.gitDir, 'sequencer', 'todo',), 'utf8',),);
        expect(await leftovers(wrapped,),).toEqual([],);
      },
    },),
    it({
      name: 'an SSH-signed commit lands with its signature on the fast path',
      fn: async function testSshSigned(): Promise<void> {
        await using repository = await createLandingRepository();
        /** Signing key path. */
        const key = join(repository.scratch, 'signing-key',);
        await nanoSpawn('ssh-keygen', ['-q', '-t', 'ed25519', '-N', '', '-C', 'landing', '-f', key,],);
        /** Public key line. */
        const publicKey = (await readFile(`${key}.pub`, 'utf8',)).trim();
        /** Allowed signers file for verification. */
        const allowed = join(repository.scratch, 'allowed-signers',);
        await writeFile(allowed, `landing@example.invalid ${publicKey}\n`,);
        await git({ repository, args: ['config', 'gpg.format', 'ssh',], },);
        await git({ repository, args: ['config', 'user.signingKey', `${key}.pub`,], },);
        await git({ repository, args: ['config', 'gpg.ssh.allowedSignersFile', allowed,], },);
        await writeWorktreeFile({ repository, name: 'signed.txt', content: 'signed\n', },);
        /** Signed commit. */
        const outcome = await runWrapper({ repository, args: ['commit', '-S', '-m', 'signed', 'signed.txt',], },);
        expect(outcome.exitCode,).toBe(0,);
        expect(await git({ repository, args: ['cat-file', 'commit', 'HEAD',], },),).toContain('gpgsig -----BEGIN SSH SIGNATURE-----',);
        expect((await gitOutcome({ repository, args: ['verify-commit', 'HEAD',], },)).exitCode,).toBe(0,);
        expect(await leftovers(repository,),).toEqual([],);
      },
    },),
    ...(['merge', 'cherry-pick', 'revert',] as const).map(function conclusionTest(operation,) {
      return it({
        name: `a ${operation} conclusion is byte-identical to native Git and cleans the same state`,
        fn: async function testConclusion(): Promise<void> {
          /** Native and wrapper repositories at the same conflict. */
          const [native, wrapped,] = await conflictedPair(operation,);
          await using _native = native;
          await using _wrapped = wrapped;
          expect(await conclusionState(wrapped,),).toEqual(await conclusionState(native,),);
          await git({ repository: native, args: ['commit', '--quiet', '--no-edit',], },);
          /** Wrapper conclusion. */
          const outcome = await runWrapper({ repository: wrapped, args: ['commit', '--no-edit',], },);
          expect(outcome.exitCode,).toBe(0,);
          expect(await git({ repository: wrapped, args: ['cat-file', 'commit', 'HEAD',], },),)
            .toBe(await git({ repository: native, args: ['cat-file', 'commit', 'HEAD',], },),);
          expect(await conclusionState(wrapped,),).toEqual(await conclusionState(native,),);
          expect(await git({ repository: wrapped, args: ['status', '--porcelain',], },),)
            .toBe(await git({ repository: native, args: ['status', '--porcelain',], },),);
          expect(await leftovers(wrapped,),).toEqual([],);
        },
      },);
    },),
  ],
},);
