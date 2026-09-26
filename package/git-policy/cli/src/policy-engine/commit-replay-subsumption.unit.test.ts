/**
 Subsumption before replay's merge, on disposable repositories:
 every branch of the rule,
 each followed by the `git merge-tree` replay runs.

 @module
 */
import { execFileSync, } from 'node:child_process';
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
  type LandingRepository,
  REAL_GIT,
} from './commit-landing-fixture.unit.test.ts';

const {
  mergeReplayTree,
  subsumeLandedChanges,
} = internalTestExports;

/**
 One path's entry on one side: file bytes with an optional mode, a submodule commit, or absence.
 */
type Side =
  | Readonly<{ bytes: string | Buffer; mode?: '100644' | '100755'; }>
  | Readonly<{ gitlink: string; }>
  | 'absent';

/**
 Arbitrary submodule commit IDs; a gitlink needs no object.
 */
const SUBMODULE = {
  base: '1111111111111111111111111111111111111111',
  landed: '2222222222222222222222222222222222222222',
  other: '3333333333333333333333333333333333333333',
} as const;

/**
 Writes a commit whose tree is `parent`'s with the given paths replaced, using a private index.

 @param repository - fixture repository

 @param parent - parent commit

 @param files - path changes

 @param name - index file and message name

 @returns new commit
 */
async function commitFiles({
  repository,
  parent,
  files,
  name,
}: Readonly<{
  repository: LandingRepository;
  parent: string;
  files: Readonly<Record<string, Side>>;
  name: string;
}>,): Promise<string> {
  /** Private index environment. */
  const env = { GIT_INDEX_FILE: join(repository.scratch, `${name}.index`,), };
  await git({ repository, args: ['read-tree', parent,], env, },);
  for (const [path, side,] of Object.entries(files,)) {
    if (side === 'absent') {
      // oxlint-disable-next-line no-await-in-loop -- Index edits are ordered.
      await git({ repository, args: ['update-index', '--force-remove', '--', path,], env, },);
      continue;
    }
    /** Object the entry names. */
    const oid = 'gitlink' in side
      ? side.gitlink
      : execFileSync(REAL_GIT, ['hash-object', '-w', '--stdin',], { cwd: repository.path, env: repository.env, input: side.bytes, },).toString('utf8',).trim();
    /** Entry mode. */
    const mode = 'gitlink' in side ? '160000' : (side.mode ?? '100644');
    // oxlint-disable-next-line no-await-in-loop -- Index edits are ordered.
    await git({ repository, args: ['update-index', '--add', '--cacheinfo', `${mode},${oid},${path}`,], env, },);
  }
  /** Tree of the edited index. */
  const tree = await git({ repository, args: ['write-tree',], env, },);
  return await git({ repository, args: ['commit-tree', tree, '-p', parent, '-m', name,], },);
}

/**
 Builds base, landed, and prepared commits, then runs subsumption and the replay merge.

 @param repository - fixture repository

 @param base - base changes on top of the baseline commit

 @param landed - landed changes on top of the base

 @param prepared - prepared changes on top of the base

 @param order - capture-order decision per path; unnamed paths are unordered

 @returns subsumed and landed-kept paths and the merge outcome
 */
async function replay({
  repository,
  base,
  landed,
  prepared,
  order = {},
}: Readonly<{
  repository: LandingRepository;
  base: Readonly<Record<string, Side>>;
  landed: Readonly<Record<string, Side>>;
  prepared: Readonly<Record<string, Side>>;
  order?: Readonly<Record<string, 'prepared' | 'landed' | 'unordered'>>;
}>,): Promise<Readonly<{
  subsumedPaths: readonly string[];
  keptLandedPaths: readonly string[];
  merge: Awaited<ReturnType<typeof mergeReplayTree>>;
}>> {
  /** Base commit. */
  const baseOid = await commitFiles({ repository, parent: await git({ repository, args: ['rev-parse', 'HEAD',], },), files: base, name: 'base', },);
  /** Landed commit. */
  const current = await commitFiles({ repository, parent: baseOid, files: landed, name: 'landed', },);
  /** Prepared commit. */
  const preparedOid = await commitFiles({ repository, parent: baseOid, files: prepared, name: 'prepared', },);
  /** Effective merge base. */
  const subsumption = await subsumeLandedChanges({
    gitPath: REAL_GIT,
    shadowPath: repository.gitDir,
    objectDirectory: join(repository.gitDir, 'objects',),
    cwd: repository.path,
    directory: repository.scratch,
    replay: 1,
    mergeBase: baseOid,
    current,
    prepared: preparedOid,
    orderPaths: async (paths: readonly string[],) => new Map(paths.flatMap((path,) => (order[path] === undefined ? [] : [[path, order[path],] as const,])),),
  },);
  return {
    subsumedPaths: subsumption.subsumedPaths,
    keptLandedPaths: subsumption.keptLandedPaths,
    merge: await mergeReplayTree({
      gitPath: REAL_GIT,
      shadowPath: repository.gitDir,
      mergeBase: subsumption.mergeBase,
      current,
      prepared: preparedOid,
      worktreeRoot: repository.path,
    },),
  };
}

/**
 Reads one entry of a merged tree.

 @param repository - fixture repository

 @param tree - merged tree

 @param path - path

 @returns mode and bytes as `<mode> <text>`
 */
async function entryText({
  repository,
  tree,
  path,
}: Readonly<{
  repository: LandingRepository;
  tree: string;
  path: string;
}>,): Promise<string> {
  /** `ls-tree` line. */
  const listed = await git({ repository, args: ['ls-tree', tree, '--', path,], },);
  return `${listed.split(' ',)[0] ?? ''} ${await git({ repository, args: ['cat-file', 'blob', `${tree}:${path}`,], },)}`;
}

/**
 Twelve numbered lines with some replaced.

 @param replaced - replacement text per line index

 @returns file text
 */
function lines(replaced: Readonly<Record<number, string>> = {},): string {
  return Array.from({ length: 12, }, function line(_unused, index,): string {
    return `${replaced[index] ?? `line ${String(index,)}`}\n`;
  },).join('',);
}

await describe({
  name: 'replay subsumption',
  children: [
    it({
      name: 'prepared bytes that contain the landed edit plus an adjacent one land as they are',
      fn: async function testSubsumedText(): Promise<void> {
        await using repository = await createLandingRepository();
        /** Replay. */
        const outcome = await replay({
          repository,
          base: { 'f.txt': { bytes: lines(), }, },
          landed: { 'f.txt': { bytes: lines({ 5: 'landed', },), }, },
          prepared: { 'f.txt': { bytes: lines({ 5: 'landed', 6: 'mine', },), }, },
        },);
        expect(outcome.subsumedPaths,).toEqual(['f.txt',],);
        expect(outcome.merge.kind,).toBe('merged',);
        expect(await entryText({ repository, tree: outcome.merge.kind === 'merged' ? outcome.merge.treeOid : '', path: 'f.txt', },),).toBe(`100644 ${lines({ 5: 'landed', 6: 'mine', },).trimEnd()}`,);
      },
    },),
    it({
      name: 'a far-apart edit is not subsumed but still merges three-way from the preparation base',
      fn: async function testMergeable(): Promise<void> {
        await using repository = await createLandingRepository();
        /** Replay. */
        const outcome = await replay({
          repository,
          base: { 'f.txt': { bytes: lines(), }, },
          landed: { 'f.txt': { bytes: lines({ 1: 'landed', },), }, },
          prepared: { 'f.txt': { bytes: lines({ 10: 'mine', },), }, },
        },);
        expect(outcome.subsumedPaths,).toEqual([],);
        expect(outcome.merge.kind,).toBe('merged',);
        expect(await entryText({ repository, tree: outcome.merge.kind === 'merged' ? outcome.merge.treeOid : '', path: 'f.txt', },),).toBe(`100644 ${lines({ 1: 'landed', 10: 'mine', },).trimEnd()}`,);
      },
    },),
    it({
      name: 'an adjacent edit without the landed one conflicts',
      fn: async function testConflict(): Promise<void> {
        await using repository = await createLandingRepository();
        /** Replay. */
        const outcome = await replay({
          repository,
          base: { 'f.txt': { bytes: lines(), }, },
          landed: { 'f.txt': { bytes: lines({ 5: 'landed', },), }, },
          prepared: { 'f.txt': { bytes: lines({ 6: 'mine', },), }, },
        },);
        expect(outcome.subsumedPaths,).toEqual([],);
        expect(outcome.merge,).toEqual({ kind: 'conflict', paths: ['f.txt',], },);
      },
    },),
    it({
      name: 'add/add: identical additions and additions that keep every landed line are subsumed, and one that drops a landed line conflicts',
      fn: async function testAddAdd(): Promise<void> {
        await using repository = await createLandingRepository();
        /** Replay. */
        const outcome = await replay({
          repository,
          base: {},
          landed: {
            'same.txt': { bytes: 'same\n', },
            'grown.txt': { bytes: 'a\n', },
            'inserted.txt': { bytes: 'a\nb\nc\n', },
            'rewritten.txt': { bytes: 'a\nb\nc\n', },
          },
          prepared: {
            'same.txt': { bytes: 'same\n', },
            'grown.txt': { bytes: 'a\nb\n', },
            'inserted.txt': { bytes: 'a\nb\nmine\nc\n', },
            'rewritten.txt': { bytes: 'a\nmine\nc\n', },
          },
        },);
        expect(outcome.subsumedPaths,).toEqual(['grown.txt', 'inserted.txt', 'same.txt',],);
        expect(outcome.merge,).toEqual({ kind: 'conflict', paths: ['rewritten.txt',], },);
      },
    },),
    it({
      name: 'delete against modify is never subsumed and conflicts either way round',
      fn: async function testDeleteModify(): Promise<void> {
        await using repository = await createLandingRepository();
        /** Replay. */
        const outcome = await replay({
          repository,
          base: { 'gone.txt': { bytes: lines(), }, 'kept.txt': { bytes: lines(), }, 'both.txt': { bytes: lines(), }, },
          landed: { 'gone.txt': 'absent', 'kept.txt': { bytes: lines({ 3: 'landed', },), }, 'both.txt': 'absent', },
          prepared: { 'gone.txt': { bytes: lines({ 3: 'mine', },), }, 'kept.txt': 'absent', 'both.txt': 'absent', },
        },);
        expect(outcome.subsumedPaths,).toEqual(['both.txt',],);
        expect(outcome.merge,).toEqual({ kind: 'conflict', paths: ['gone.txt', 'kept.txt',], },);
      },
    },),
    it({
      name: 'binary: only an identical landed blob is subsumed, even when the prepared bytes contain the landed lines',
      fn: async function testBinary(): Promise<void> {
        await using repository = await createLandingRepository();
        /** Replay. */
        const outcome = await replay({
          repository,
          base: { 'same.bin': { bytes: Buffer.from('\0base\n',), }, 'grown.bin': { bytes: Buffer.from('\0a\nb\nc\n',), }, },
          landed: { 'same.bin': { bytes: Buffer.from('\0new\n',), }, 'grown.bin': { bytes: Buffer.from('\0a\nB\nc\n',), }, },
          prepared: { 'same.bin': { bytes: Buffer.from('\0new\n',), }, 'grown.bin': { bytes: Buffer.from('\0a\nB\nc\nd\n',), }, },
        },);
        expect(outcome.subsumedPaths,).toEqual(['same.bin',],);
        expect(outcome.merge,).toEqual({ kind: 'conflict', paths: ['grown.bin',], },);
      },
    },),
    it({
      name: 'mode: a landed mode change merges three-way, even when the prepared content subsumes the landed content',
      fn: async function testMode(): Promise<void> {
        await using repository = await createLandingRepository();
        /** Replay. */
        const outcome = await replay({
          repository,
          base: { 'only-mode.sh': { bytes: lines(), }, 'mode-and-text.sh': { bytes: lines(), }, },
          landed: {
            'only-mode.sh': { bytes: lines(), mode: '100755', },
            'mode-and-text.sh': { bytes: lines({ 5: 'landed', },), mode: '100755', },
          },
          prepared: {
            'only-mode.sh': { bytes: lines({ 9: 'mine', },), },
            'mode-and-text.sh': { bytes: lines({ 5: 'landed', 6: 'mine', },), },
          },
        },);
        expect(outcome.subsumedPaths,).toEqual(['mode-and-text.sh', 'only-mode.sh',],);
        expect(outcome.merge.kind,).toBe('merged',);
        /** Merged tree. */
        const tree = outcome.merge.kind === 'merged' ? outcome.merge.treeOid : '';
        expect(await entryText({ repository, tree, path: 'only-mode.sh', },),).toBe(`100755 ${lines({ 9: 'mine', },).trimEnd()}`,);
        expect(await entryText({ repository, tree, path: 'mode-and-text.sh', },),).toBe(`100755 ${lines({ 5: 'landed', 6: 'mine', },).trimEnd()}`,);
      },
    },),
    it({
      name: 'submodule: an identical gitlink is subsumed, and a different one is merged without reading it as a blob',
      fn: async function testSubmodule(): Promise<void> {
        await using repository = await createLandingRepository();
        /** Replay. */
        const outcome = await replay({
          repository,
          base: { same: { gitlink: SUBMODULE.base, }, moved: { gitlink: SUBMODULE.base, }, },
          landed: { same: { gitlink: SUBMODULE.landed, }, moved: { gitlink: SUBMODULE.landed, }, },
          prepared: { same: { gitlink: SUBMODULE.landed, }, moved: { gitlink: SUBMODULE.other, }, },
        },);
        expect(outcome.subsumedPaths,).toEqual(['same',],);
        expect(outcome.merge,).toEqual({ kind: 'conflict', paths: ['moved',], },);
      },
    },),
  ],
},);
