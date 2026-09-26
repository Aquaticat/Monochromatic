/**
 Capture-order decisions for the shared paths of one replay.

 Reads the transaction's `captured.json`;
 when it names none of the shared paths,
 or the transaction has none,
 every path is unordered and no process runs.
 Otherwise the first-parent history since the preparation base is listed once
 (`commit-capture-order-history.ts`, two processes)
 and each listed commit's landed-capture record is read,
 and each shared path is decided by `decideCaptureOrder`.

 @module
 */
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  type CaptureOrderDecision,
  captureView,
  decideCaptureOrder,
} from './commit-capture-order-decision.ts';
import { listLandedChanges, } from './commit-capture-order-history.ts';
import {
  CAPTURED_ABSENT,
  readCapturedRecord,
} from './commit-capture-order-journal.ts';
import { readLandedCaptures, } from './commit-capture-order-records.ts';
import type { PreparationBase, } from './commit-transaction-capture.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Decides every shared path of one replay.

 @param gitPath - real Git executable

 @param shadowPath - shadow repository

 @param gitDir - absolute Git directory of the owning worktree

 @param transactionDirectory - replaying transaction's directory, holding its `captured.json`

 @param base - preparation base

 @param current - target that won

 @param paths - shared paths, Latin-1 decoded

 @returns decision per path; a path missing from the map is unordered

 @throws {@link CaptureOrderRecordError} when `captured.json` is malformed

 @example
 ```ts
 await decideSharedPaths({ gitPath: '/usr/bin/git', shadowPath, gitDir, transactionDirectory, base, current, paths: ['a.txt'] });
 ```
 */
export async function decideSharedPaths({
  gitPath,
  shadowPath,
  gitDir,
  transactionDirectory,
  base,
  current,
  paths,
}: Readonly<{
  gitPath: string;
  shadowPath: string;
  gitDir: string;
  transactionDirectory: string;
  base: PreparationBase;
  current: string;
  paths: readonly string[];
}>,): Promise<ReadonlyMap<string, CaptureOrderDecision>> {
  /**
   Tagged decision logger.
   */
  const rl = tagged({
    tag: decideSharedPaths.name,
    l,
  },);
  /**
   This transaction's capture.
   */
  const captured = await readCapturedRecord(transactionDirectory,);
  if (captured === CAPTURED_ABSENT) {
    rl.debug('the transaction has no capture-order record; every shared path is unordered',);
    return new Map();
  }
  /**
   Own capture as a set.
   */
  const own = captureView({
    stamp: captured,
    worktreePaths: captured.worktreePaths,
  },);
  /**
   Shared paths this capture read from the worktree.
   */
  const candidates = paths.filter(function capturedFromWorktree(path,): boolean {
    return own.paths
      .has(path,);
  },);
  if (candidates.length === 0)
    return new Map();
  /**
   Commits landed since the base with their changed paths.
   */
  const history = await listLandedChanges({
    gitPath,
    shadowPath,
    base,
    current,
  },);
  /**
   Landed captures of those commits.
   */
  const records = await readLandedCaptures({
    gitDir,
    commits: history.map(function commitOf(change,): string {
      return change.commit;
    },),
  },);
  /**
   Records as views.
   */
  const landed = new Map([...records,].map(function viewOf([commit, record,],) {
    return [
      commit,
      captureView({
        stamp: record,
        worktreePaths: record.worktreePaths,
      },),
    ] as const;
  },),);
  /**
   Decision per candidate.
   */
  const decisions = new Map(candidates.map(function decide(path,) {
    return [
      path,
      decideCaptureOrder({
        path,
        captured: own,
        history,
        landed,
      },),
    ] as const;
  },),);
  rl.debug(`capture ${String(captured.sequence,)} decided ${JSON.stringify([...decisions,],)}`,);
  return decisions;
}
