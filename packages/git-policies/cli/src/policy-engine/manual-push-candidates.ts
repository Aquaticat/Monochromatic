/**
 * Manual-push content candidate materialization.
 *
 * @module
 */
import { spawn, } from 'node:child_process';
import { once, } from 'node:events';
import {
  arrayBuffer,
  text,
} from 'node:stream/consumers';
import nanoSpawn from 'nano-spawn';
import {
  ABSENT_GIT_VALUE,
  type PushUpdate,
} from '../api/context-types.ts';
import type {
  CandidateFile,
  CandidateFileMode,
} from '../api/policy-types.ts';
import { ManualPushProbeError, } from './manual-push-probe.ts';

/** Git tree modes mapped to policy modes. */
const TREE_MODES: Readonly<Record<string, CandidateFileMode>> = {
  '100644': 'regular',
  '100755': 'executable',
  '120000': 'symlink',
  '160000': 'submodule',
};
/** Strict decoder for Git metadata and paths. */
const DECODER = new TextDecoder('utf-8', { fatal: true, },);

/**
 * Runs real Git and returns exact stdout bytes.
 *
 * @param gitPath - resolved real Git executable
 *
 * @param cwd - effective repository directory
 *
 * @param args - exact Git arguments
 *
 * @returns exact stdout bytes
 */
async function runGitBytes({
  gitPath,
  cwd,
  args,
}: Readonly<{
  gitPath: string;
  cwd: string;
  args: readonly string[];
}>,): Promise<Uint8Array> {
  /** Child process with binary stdout. */
  const child = spawn(
    gitPath,
    [...args,],
    {
      cwd,
      stdio: [
        'ignore',
        'pipe',
        'pipe',
      ],
    },
  );
  /** Concurrent output consumers. */
  const output = Promise.all([
    arrayBuffer(child.stdout,),
    text(child.stderr,),
  ],);
  await once(child, 'close',);
  /** Settled stdout and stderr. */
  const [stdout, stderr,] = await output;
  if (child.exitCode !== 0)
    throw new ManualPushProbeError(`git ${args.join(' ',)} failed: ${stderr.trim()}`,);
  return new Uint8Array(stdout,);
}

/**
 * Resolves object type, peeling annotated tags.
 *
 * @param gitPath - resolved real Git executable
 *
 * @param cwd - effective repository directory
 *
 * @param oid - pushed local object ID
 *
 * @returns peeled object ID and type
 */
async function resolveContentObject({
  gitPath,
  cwd,
  oid,
}: Readonly<{
  gitPath: string;
  cwd: string;
  oid: string;
}>,): Promise<Readonly<{
  oid: string;
  type: string;
}>> {
  /** Peeled object identity when local object is annotated tag. */
  const peeled = await nanoSpawn(
    gitPath,
    [
      'rev-parse',
      '--verify',
      `${oid}^{}`,
    ],
    { cwd, },
  );
  /** Peeled object ID. */
  const peeledOid = peeled.stdout;
  /** Git object type. */
  const objectType = (await nanoSpawn(
    gitPath,
    [
      'cat-file',
      '-t',
      peeledOid,
    ],
    { cwd, },
  )).stdout;
  return {
    oid: peeledOid,
    type: objectType,
  };
}

/**
 * Parses complete recursive tree into immutable candidates.
 *
 * @param gitPath - resolved real Git executable
 *
 * @param cwd - effective repository directory
 *
 * @param treeish - commit or tree object
 *
 * @param targetPrefix - invocation-local target prefix
 *
 * @returns complete tree candidates
 */
async function treeCandidates({
  gitPath,
  cwd,
  treeish,
  targetPrefix,
}: Readonly<{
  gitPath: string;
  cwd: string;
  treeish: string;
  targetPrefix: string;
}>,): Promise<readonly CandidateFile[]> {
  /** NUL-delimited recursive tree records. */
  const records = DECODER.decode(await runGitBytes({
    gitPath,
    cwd,
    args: [
      'ls-tree',
      '--full-tree',
      '-r',
      '-z',
      treeish,
    ],
  },),).split('\0',)
    .filter(function isRecord(record,) {
      return record.length > 0;
    },);
  return records.map(function toCandidate(record,): CandidateFile {
    /** Metadata and path separator. */
    const pathSeparator = record.indexOf('\t',);
    if (pathSeparator === (-1))
      throw new ManualPushProbeError('Manual-push tree entry lacks path separator.',);
    /** Space-delimited tree metadata. */
    const metadata = record.slice(0, pathSeparator,).split(' ',);
    /** Required Git tree fields. */
    const [modeText, objectType, objectOid,] = metadata;
    if ((modeText === undefined) || (objectType === undefined) || (objectOid === undefined))
      throw new ManualPushProbeError('Manual-push tree metadata is incomplete.',);
    /** Policy mode. */
    const mode = TREE_MODES[modeText];
    if (mode === undefined)
      throw new ManualPushProbeError(`Unsupported manual-push tree mode: ${modeText}`,);
    if ((objectType !== 'blob') && (objectType !== 'commit'))
      throw new ManualPushProbeError(`Unsupported manual-push object type: ${objectType}`,);
    /** Repository-relative path. */
    const path = record.slice(pathSeparator + 1,);
    return {
      targetId: `${targetPrefix}:${objectOid}:${path}`,
      path,
      revision: objectOid,
      mode,
      change: 'unchanged',
      bytes: function loadPushedBytes(): Promise<Uint8Array> {
        if (mode === 'submodule')
          return Promise.resolve(new TextEncoder().encode(objectOid,),);
        return runGitBytes({
          gitPath,
          cwd,
          args: [
            'cat-file',
            'blob',
            objectOid,
          ],
        },);
      },
    };
  },);
}

/**
 * Resolves commits newly reachable by one update and always includes final target state.
 *
 * @param gitPath - resolved real Git executable
 *
 * @param cwd - effective repository directory
 *
 * @param update - content-bearing update
 *
 * @returns complete pushed commit identities
 */
async function pushedCommits({
  gitPath,
  cwd,
  update,
}: Readonly<{
  gitPath: string;
  cwd: string;
  update: PushUpdate & { readonly localOid: string };
}>,): Promise<readonly string[]> {
  /** Range exclusions from authoritative prior destination. */
  const exclusions = update.remoteOid === ABSENT_GIT_VALUE
    ? []
    : [`^${update.remoteOid}`,];
  /** Newly reachable commits in oldest-first order. */
  const result = await nanoSpawn(
    gitPath,
    [
      'rev-list',
      '--reverse',
      update.localOid,
      ...exclusions,
    ],
    { cwd, },
  );
  return [...new Set([
    ...result.stdout.split('\n',).filter(function isOid(oid,) {
      return oid.length > 0;
    },),
    update.localOid,
  ],),];
}

/**
 * Materializes every content-bearing pushed state.
 *
 * @param gitPath - resolved real Git executable
 *
 * @param cwd - effective repository directory
 *
 * @param updates - authoritative push updates
 *
 * @returns immutable content candidates
 *
 * @example
 * ```ts
 * await createManualPushCandidates({ gitPath: '/usr/bin/git', cwd: '/repo', updates: [] });
 * ```
 */
export async function createManualPushCandidates({
  gitPath,
  cwd,
  updates,
}: Readonly<{
  gitPath: string;
  cwd: string;
  updates: readonly PushUpdate[];
}>,): Promise<readonly CandidateFile[]> {
  const candidateGroups = await Promise.all(updates
    .filter(function hasContent(update,): update is PushUpdate & { readonly localOid: string } {
      return update.localOid !== ABSENT_GIT_VALUE;
    },)
    .map(async function updateCandidates(update,) {
      /** Peeled local target. */
      const content = await resolveContentObject({
        gitPath,
        cwd,
        oid: update.localOid,
      },);
      if (content.type === 'commit') {
        /** Every newly reachable commit plus final target state. */
        const commits = await pushedCommits({
          gitPath,
          cwd,
          update: {
            ...update,
            localOid: content.oid,
          },
        },);
        return (await Promise.all(commits.map(function commitCandidates(commit,) {
          return treeCandidates({
            gitPath,
            cwd,
            treeish: commit,
            targetPrefix: `manual-push:${update.remoteName}:${update.remoteRef}:${commit}`,
          },);
        },))).flat();
      }
      if (content.type === 'tree') {
        return await treeCandidates({
          gitPath,
          cwd,
          treeish: content.oid,
          targetPrefix: `manual-push:${update.remoteName}:${update.remoteRef}:${content.oid}`,
        },);
      }
      if (content.type === 'blob') {
        return [{
          targetId: `manual-push:${update.remoteName}:${update.remoteRef}:${content.oid}`,
          path: update.remoteRef,
          revision: content.oid,
          mode: 'regular',
          change: 'unchanged',
          bytes: function loadPushedBlob(): Promise<Uint8Array> {
            return runGitBytes({
              gitPath,
              cwd,
              args: [
                'cat-file',
                'blob',
                content.oid,
              ],
            },);
          },
        },] satisfies readonly CandidateFile[];
      }
      throw new ManualPushProbeError(`Unsupported pushed object type: ${content.type}`,);
    },),);
  return candidateGroups.flat();
}
