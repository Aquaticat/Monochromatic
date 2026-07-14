// Generated from `packages/git-policies/forbidden-strings/src/materialize-candidates.ts` by file-enforcer; edit canonical source owner.
/**
 * Plugin-owned scanner candidate materialization.
 *
 * @module
 */
import {
  mkdtemp,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';
import type { CandidateFile, } from '../../api/index.ts';

/**
 * Maximum simultaneous candidate reads and temporary-file writes.
 */
const MATERIALIZATION_CONCURRENCY = 64;

/**
 * Returns scanner-equivalent candidate identity.
 *
 * @param candidate - exact policy candidate
 *
 * @returns stable content and finding-path identity
 */
function scannerCandidateKey(candidate: CandidateFile,): string {
  /**
   * Immutable revision identity when Git owns bytes,
   * otherwise invocation-local target identity.
   */
  const contentIdentity = (typeof candidate.revision) === 'string'
    ? `revision:${candidate.revision}`
    : `target:${candidate.targetId}`;
  return `${contentIdentity}\0${candidate.path}\0${candidate.mode}`;
}

/**
 * Removes repeated historical states that produce identical scanner findings.
 *
 * @param candidates - content-bearing candidates in encounter order
 *
 * @returns first scanner-equivalent candidate for each identity
 */
function uniqueScannerCandidates(
  candidates: readonly CandidateFile[],
): readonly CandidateFile[] {
  /**
   * Identities already retained for scanner input.
   */
  const seen = new Set<string>();
  return candidates.filter(function firstScannerIdentity(candidate,): boolean {
    /**
     * Content plus reported-path identity.
     */
    const key = scannerCandidateKey(candidate,);
    if (seen.has(key,))
      return false;
    seen.add(key,);
    return true;
  },);
}

/**
 * Plugin-owned disposable scanner files.
 */
export type MaterializedCandidates = Readonly<{
  /**
   * Materialized file paths in scanner argument order.
   */
  paths: readonly string[];
  /**
   * Exact scanner path to policy candidate lookup.
   */
  candidatesByPath: ReadonlyMap<string, CandidateFile>;
  /**
   * Removes plugin-owned files.
   */
  [Symbol.asyncDispose]: () => Promise<void>;
}>;

/**
 * Candidate paired with plugin-owned temporary path.
 */
type IndexedCandidate = Readonly<{
  candidate: CandidateFile;
  path: string;
}>;

/**
 * Materializes exact non-deleted candidate bytes under syntax-free names.
 *
 * @param candidates - exact lazy Git candidates
 *
 * @returns disposable scanner inputs
 *
 * @example
 * ```ts
 * await using inputs = await materializeCandidates([]);
 * ```
 */
export async function materializeCandidates(
  candidates: readonly CandidateFile[],
): Promise<MaterializedCandidates> {
  /**
   * Private plugin-owned temporary directory.
   */
  const directory = await mkdtemp(join(
    tmpdir(),
    'cli-git-forbidden-strings-',
  ),);
  /**
   * Content-bearing candidate states.
   */
  const contentCandidates = uniqueScannerCandidates(candidates.filter(function hasContent(candidate,): boolean {
    return candidate.change !== 'deleted';
  },),);
  /**
   * Stable plugin-owned paths independent of repository path grammar.
   */
  const paths = contentCandidates.map(function scannerPath(
    _candidate,
    index,
  ): string {
    return join(
      directory,
      `candidate-${String(index,)}`,
    );
  },);
  /**
   * Candidate and generated path pairs before bounded lane assignment.
   */
  const indexedCandidates = contentCandidates.map(function indexCandidate(
    candidate,
    index,
  ): IndexedCandidate {
    return {
      candidate,
      path: paths[index] ?? '',
    };
  },);
  /**
   * Active lane count never exceeds candidate count or fixed process-safe cap.
   */
  const laneCount = Math.min(
    MATERIALIZATION_CONCURRENCY,
    indexedCandidates.length,
  );
  /**
   * Deterministic independent lanes avoid an unbounded `Promise.all` fan-out.
   */
  const lanes = Array.from(
    { length: laneCount, },
    function createLane(
      _unused,
      laneIndex,
    ) {
      return indexedCandidates.filter(function assignedToLane(
        _candidate,
        candidateIndex,
      ): boolean {
        return (candidateIndex % laneCount) === laneIndex;
      },);
    },
  );
  await Promise.all(lanes.map(async function writeLane(
    lane: readonly IndexedCandidate[],
  ): Promise<void> {
    /* oxlint-disable no-await-in-loop -- Each bounded lane deliberately sequences process-backed reads and temporary writes to cap process and file-descriptor pressure. */
    for (const entry of lane) {
      /**
       * Exact candidate bytes loaded only when current bounded lane reaches entry.
       */
      const bytes = await entry.candidate
        .bytes();
      await writeFile(
        entry.path,
        bytes,
      );
    }
    /* oxlint-enable no-await-in-loop */
  },),);
  return {
    paths,
    candidatesByPath: new Map(paths.map(function mapCandidate(
      path,
      index,
    ): readonly [
      string,
      CandidateFile
    ] {
      /**
       * Candidate aligned with generated path.
       */
      const candidate = contentCandidates[index];
      if (candidate === undefined)
        throw new Error('Candidate materialization index was not aligned.',);
      return [
        path,
        candidate,
      ];
    },),),
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(
        directory,
        {
          recursive: true,
          force: true,
        },
      );
    },
  };
}
