/**
 Capture order's parts through the built artifact:
 the per-path decision,
 history parsing,
 record parsing,
 the sequence and the capture lock,
 worktree-captured path listing,
 and pruning of landed-capture records.

 @module
 */
import { execFileSync, } from 'node:child_process';
import {
  copyFile,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
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
import { internalTestExports, } from '../../dist/final/node/index.mjs';
import {
  createLandingRepository,
  git,
  REAL_GIT,
  writeWorktreeFile,
} from './commit-landing-fixture.unit.test.ts';

const {
  captureInOrder,
  decideCaptureOrder,
  landedRecordDirectory,
  listLandedChanges,
  listWorktreeCapturedPaths,
  parseCapturedRecord,
  parseCommitChanges,
  parseLandedCaptureRecord,
  pruneLandedCaptures,
  readNextCaptureSequence,
  recordLandedCapture,
} = internalTestExports;

/**
 One capture view.

 @param sequence - capture sequence number

 @param paths - worktree-captured paths

 @param worktreeId - store identity

 @returns view
 */
function view(sequence: number, paths: readonly string[], worktreeId = 'w',) {
  return {
    worktreeId,
    sequence,
    paths: new Set(paths,),
  };
}

/**
 One landed change.

 @param commit - commit ID

 @param paths - changed paths

 @returns change
 */
function change(commit: string, paths: readonly string[],) {
  return {
    commit,
    paths: new Set(paths,),
  };
}

/**
 Disposable directory with a canonical path.

 @returns path and disposer
 */
async function scratchDirectory() {
  /** Canonical root. */
  const path = await realpath(
    await mkdtemp(join(tmpdir(), 'cli-git-capture-order-',),),
  );
  return {
    path,
    [Symbol.asyncDispose]: async () => {
      await rm(path, { recursive: true, force: true, },);
    },
  };
}

/**
 Writes a published transaction directory, optionally with its `captured.json`.

 @param registry - registry root

 @param id - transaction ID

 @param nextSequenceBeforeBase - recorded bound; absent writes no `captured.json`

 @param worktreeId - store identity the capture names

 @returns transaction directory
 */
async function publishTransaction(registry: string, id: string, nextSequenceBeforeBase?: number, worktreeId?: string,) {
  /** Transaction directory. */
  const directory = join(registry, id,);
  await mkdir(directory, { recursive: true, mode: 0o700, },);
  if (nextSequenceBeforeBase !== undefined)
    await writeFile(join(directory, 'captured.json',), `${JSON.stringify({
      schemaVersion: 2,
      state: 'captured',
      worktreeId,
      sequence: 1,
      nextSequenceBeforeBase,
      worktreePaths: ['a.txt',],
    },)}\n`, { mode: 0o600, },);
  return directory;
}

await describe({
  name: 'capture order',
  children: [
    it({
      name: 'the later capture of a path wins in both directions',
      fn: async function testDirections(): Promise<void> {
        /** One landed commit that captured a.txt as capture 5. */
        const landed = new Map([['c1', view(5, ['a.txt',],),],],);
        /** History of that commit. */
        const history = [change('c1', ['a.txt',],),];
        expect(decideCaptureOrder({ path: 'a.txt', captured: view(7, ['a.txt',],), history, landed, },),).toBe('prepared',);
        expect(decideCaptureOrder({ path: 'a.txt', captured: view(3, ['a.txt',],), history, landed, },),).toBe('landed',);
      },
    },),
    it({
      name: 'the latest of several landed captures decides, and any landed change without this worktree\'s capture falls back',
      fn: async function testFallbacks(): Promise<void> {
        /** Landed captures. */
        const landed = new Map([
          ['c1', view(2, ['a.txt',],),],
          ['c2', view(9, ['a.txt',],),],
          ['other', view(1, ['a.txt',], 'another-store',),],
          ['index', view(4, [],),],
        ],);
        /** Own capture between the two landed ones. */
        const captured = view(6, ['a.txt', 'b.txt',],);
        expect(decideCaptureOrder({ path: 'a.txt', captured, history: [change('c1', ['a.txt',],), change('c2', ['a.txt',],),], landed, },),).toBe('landed',);
        expect(decideCaptureOrder({ path: 'a.txt', captured: view(10, ['a.txt',],), history: [change('c1', ['a.txt',],), change('c2', ['a.txt',],),], landed, },),).toBe('prepared',);
        // A native commit without a record, a record of another store generation, and a record whose capture did not read the path.
        expect(decideCaptureOrder({ path: 'a.txt', captured, history: [change('c1', ['a.txt',],), change('native', ['a.txt',],),], landed, },),).toBe('unordered',);
        expect(decideCaptureOrder({ path: 'a.txt', captured, history: [change('other', ['a.txt',],),], landed, },),).toBe('unordered',);
        expect(decideCaptureOrder({ path: 'a.txt', captured, history: [change('index', ['a.txt',],),], landed, },),).toBe('unordered',);
        // A path this capture did not read from the worktree, and one no landed commit changed.
        expect(decideCaptureOrder({ path: 'c.txt', captured, history: [change('c1', ['c.txt',],),], landed, },),).toBe('unordered',);
        expect(decideCaptureOrder({ path: 'b.txt', captured, history: [change('c1', ['a.txt',],),], landed, },),).toBe('unordered',);
      },
    },),
    it({
      name: 'parseCommitChanges reads commits, raw records, and paths with every byte',
      fn: async function testParse(): Promise<void> {
        /** Two commits, the second with two records and a Latin-1 path. */
        const output = 'c1\0:100644 100644 a b M\0a.txt\0c2\0:000000 100644 0 b A\0café\0:100644 000000 a 0 D\0x\0';
        expect(parseCommitChanges(output,).map((entry,) => [entry.commit, [...entry.paths,],]),).toEqual([['c1', ['a.txt',],], ['c2', ['café', 'x',],],],);
        expect(parseCommitChanges('',),).toEqual([],);
        expect(() => parseCommitChanges(':100644 100644 a b M\0a.txt\0',),).toThrow('without a commit',);
      },
    },),
    it({
      name: 'record parsers reject missing, mistyped, and zero fields',
      fn: async function testRecordParsers(): Promise<void> {
        /** Valid captured record. */
        const captured = { schemaVersion: 2, state: 'captured', worktreeId: 'w', sequence: 1, nextSequenceBeforeBase: 1, worktreePaths: ['a',], };
        expect(
          parseCapturedRecord(JSON.stringify(captured,),),
        ).toEqual(captured,);
        expect(() => parseCapturedRecord(JSON.stringify({ ...captured, sequence: 0, },),),).toThrow('sequence',);
        expect(() => parseCapturedRecord(JSON.stringify({ ...captured, worktreePaths: [1,], },),),).toThrow('worktreePaths',);
        expect(() => parseCapturedRecord(JSON.stringify({ ...captured, state: 'prepared', },),),).toThrow('captured record',);
        expect(() => parseCapturedRecord('[]',),).toThrow('JSON object',);
        /** Valid landed record. */
        const landed = { schemaVersion: 1, commit: 'c', transactionId: 't', worktreeId: 'w', sequence: 2, nextSequenceAfterLanding: 3, worktreePaths: [], };
        expect(parseLandedCaptureRecord({ text: JSON.stringify(landed,), name: 'r', },),).toEqual(landed,);
        expect(() => parseLandedCaptureRecord({ text: JSON.stringify({ ...landed, worktreeId: '', },), name: 'r', },),).toThrow('worktreeId',);
        expect(() => parseLandedCaptureRecord({ text: JSON.stringify({ ...landed, schemaVersion: 2, },), name: 'r', },),).toThrow('schema-version-1',);
      },
    },),
    it({
      name: 'captures take consecutive sequence numbers that persist in the store, under one stable identity',
      fn: async function testSequence(): Promise<void> {
        await using scratch = await scratchDirectory();
        expect(await readNextCaptureSequence(scratch.path,),).toBe(1,);
        /** First capture. */
        const first = await captureInOrder({ gitDir: scratch.path, capture: async () => 'one', },);
        /** Second capture. */
        const second = await captureInOrder({ gitDir: scratch.path, capture: async () => 'two', },);
        expect([first.stamp.sequence, second.stamp.sequence, first.value, second.value,],).toEqual([1, 2, 'one', 'two',],);
        expect(second.stamp.worktreeId,).toBe(first.stamp.worktreeId,);
        expect(await readFile(join(scratch.path, 'cli-git-captures', 'sequence',), 'utf8',),).toBe('2\n',);
        expect(await readNextCaptureSequence(scratch.path,),).toBe(3,);
        expect((await readdir(join(scratch.path, 'cli-git-captures',),)).toSorted(),).toEqual(['sequence', 'worktree-id',],);
        await writeFile(join(scratch.path, 'cli-git-captures', 'sequence',), 'x\n',);
        await expect(readNextCaptureSequence(scratch.path,),).rejects.toThrow('malformed',);
      },
    },),
    it({
      name: 'concurrent captures in one process run one at a time and keep their order',
      fn: async function testSerialized(): Promise<void> {
        await using scratch = await scratchDirectory();
        /** Captures running inside the lock right now. */
        const inside = { now: 0, most: 0, };
        /** Eight captures started together. */
        const stamps = await Promise.all(Array.from({ length: 8, }, async (_value, index,) => (await captureInOrder({
          gitDir: scratch.path,
          capture: async () => {
            inside.now += 1;
            inside.most = Math.max(inside.most, inside.now,);
            await new Promise((resolve,) => {
              setTimeout(resolve, 5,);
            },);
            inside.now -= 1;
            return index;
          },
        },)).stamp.sequence),);
        expect(inside.most,).toBe(1,);
        expect(stamps.toSorted((left, right,) => left - right),).toEqual([1, 2, 3, 4, 5, 6, 7, 8,],);
      },
    },),
    it({
      name: 'worktree-captured paths are the selected paths of an explicit-path capture and the staged changes of commit -a, and none for a plain index capture',
      fn: async function testWorktreePaths(): Promise<void> {
        await using repository = await createLandingRepository();
        await writeWorktreeFile({ repository, name: 'a.txt', content: 'a\n', },);
        await writeWorktreeFile({ repository, name: 'b.txt', content: 'b\n', },);
        await git({ repository, args: ['add', 'a.txt', 'b.txt',], },);
        await git({ repository, args: ['commit', '--quiet', '-m', 'files',], },);
        await writeWorktreeFile({ repository, name: 'a.txt', content: 'a2\n', },);
        await writeWorktreeFile({ repository, name: 'b.txt', content: 'b2\n', },);
        await git({ repository, args: ['add', 'b.txt',], },);
        /** Private indexes. */
        const workspace = {
          capturedIndexPath: join(repository.scratch, 'captured.index',),
          commitIndexPath: join(repository.scratch, 'commit.index',),
          objectDirectory: join(repository.gitDir, 'objects',),
        };
        /** Base commit. */
        const baseRevision = await git({ repository, args: ['rev-parse', 'HEAD',], },);
        /** Git with the private commit index. */
        const privateGit = (args: readonly string[],) => execFileSync(REAL_GIT, [...args,], { cwd: repository.path, env: { ...repository.env, GIT_INDEX_FILE: workspace.commitIndexPath, }, },);
        privateGit(['read-tree', baseRevision,],);
        privateGit(['add', '--all', '--', 'a.txt',],);
        /** Shared arguments. */
        const shared = { gitPath: REAL_GIT, cwd: repository.path, workspace, baseRevision, };
        expect(await listWorktreeCapturedPaths({ ...shared, mode: 'explicit-path', stagesWorktree: false, },),).toEqual(['a.txt',],);
        await copyFile(join(repository.gitDir, 'index',), workspace.capturedIndexPath,);
        await copyFile(workspace.capturedIndexPath, workspace.commitIndexPath,);
        expect(await listWorktreeCapturedPaths({ ...shared, mode: 'index', stagesWorktree: false, },),).toEqual([],);
        privateGit(['add', '--update', '--', ':/',],);
        // b.txt was staged already, so commit -a changed only a.txt; the staged b.txt stays out of capture order.
        expect(await listWorktreeCapturedPaths({ ...shared, mode: 'index', stagesWorktree: true, },),).toEqual(['a.txt',],);
      },
    },),
    it({
      name: 'the landed history lists every first-parent commit since the base with the paths it changed',
      fn: async function testHistory(): Promise<void> {
        await using repository = await createLandingRepository();
        /** Base commit. */
        const base = await git({ repository, args: ['rev-parse', 'HEAD',], },);
        await writeWorktreeFile({ repository, name: 'a.txt', content: 'a\n', },);
        await git({ repository, args: ['add', 'a.txt',], },);
        await git({ repository, args: ['commit', '--quiet', '-m', 'a',], },);
        await git({ repository, args: ['commit', '--quiet', '--allow-empty', '-m', 'empty',], },);
        await git({ repository, args: ['rm', '--quiet', 'base.txt',], },);
        await git({ repository, args: ['commit', '--quiet', '-m', 'rm',], },);
        /** Current commit. */
        const current = await git({ repository, args: ['rev-parse', 'HEAD',], },);
        /** Listed history. */
        const history = await listLandedChanges({ gitPath: REAL_GIT, shadowPath: repository.gitDir, base: { kind: 'commit', oid: base, }, current, },);
        expect(history.map((entry,) => [...entry.paths,]),).toEqual([['base.txt',], ['a.txt',],],);
        expect(history[0]?.commit,).toBe(current,);
        /** Every commit from an unborn base, the root included. */
        const all = await listLandedChanges({ gitPath: REAL_GIT, shadowPath: repository.gitDir, base: { kind: 'unborn', }, current, },);
        expect(all.map((entry,) => [...entry.paths,]),).toEqual([['base.txt',], ['a.txt',], ['base.txt',],],);
      },
    },),
    it({
      name: 'pruning keeps a record while a published transaction may replay over it and removes it afterwards',
      fn: async function testPrune(): Promise<void> {
        await using scratch = await scratchDirectory();
        /** Worktree Git directory and registry. */
        const [gitDir, registry,] = [scratch.path, join(scratch.path, 'cli-git-transactions',),];
        await mkdir(registry, { mode: 0o700, },);
        /** Store identity. */
        const { stamp, } = await captureInOrder({ gitDir, capture: async () => undefined, },);
        /** Landing transactions whose captures become records. */
        const landers = await Promise.all([1, 2,].map(async (index,) => await publishTransaction(join(scratch.path, 'landers',), `lander-${String(index,)}`, 1, stamp.worktreeId,),),);
        // First record: next sequence after landing 2; then two more captures; second record: 4.
        await recordLandedCapture({ gitDir, transactionDirectory: landers[0] ?? '', transactionId: 't1', landedOid: 'c1', },);
        await captureInOrder({ gitDir, capture: async () => undefined, },);
        await captureInOrder({ gitDir, capture: async () => undefined, },);
        await recordLandedCapture({ gitDir, transactionDirectory: landers[1] ?? '', transactionId: 't2', landedOid: 'c2', },);
        expect(await recordLandedCapture({ gitDir, transactionDirectory: join(scratch.path, 'none',), transactionId: 't3', landedOid: 'c3', },),).toBe(false,);
        await writeFile(join(landedRecordDirectory(gitDir,), 'broken.json',), '{',);
        /** Remaining record names. */
        const remaining = async () => (await readdir(landedRecordDirectory(gitDir,),)).toSorted();
        // A published transaction that has not captured keeps everything.
        await publishTransaction(registry, '00000000-0000-4000-8000-000000000001',);
        expect(await pruneLandedCaptures({ gitDir, registryRoot: registry, },),).toBe(0,);
        expect(await remaining(),).toEqual(['broken.json', 'c1.json', 'c2.json',],);
        await rm(join(registry, '00000000-0000-4000-8000-000000000001',), { recursive: true, },);
        // A transaction that read next sequence 3 before its base needs only the record landed at 4 or later.
        await publishTransaction(registry, '00000000-0000-4000-8000-000000000002', 3, stamp.worktreeId,);
        await publishTransaction(registry, '00000000-0000-4000-8000-000000000003', 1, 'another-store',);
        expect(await pruneLandedCaptures({ gitDir, registryRoot: registry, },),).toBe(2,);
        expect(await remaining(),).toEqual(['c2.json',],);
        await rm(join(registry, '00000000-0000-4000-8000-000000000002',), { recursive: true, },);
        await rm(join(registry, '00000000-0000-4000-8000-000000000003',), { recursive: true, },);
        expect(await pruneLandedCaptures({ gitDir, registryRoot: registry, },),).toBe(1,);
        expect(await remaining(),).toEqual([],);
      },
    },),
  ],
},);
