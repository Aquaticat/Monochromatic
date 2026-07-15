/**
 * Manual-push content candidate materialization.
 *
 * @module
 */
import nanoSpawn from 'nano-spawn';
import {
  ABSENT_GIT_VALUE,
  type PushUpdate,
} from '../api/context-types.ts';
import type { CandidateFile, } from '../api/policy-types.ts';
import { loadManualPushBlobs, } from './manual-push-blob-batch.ts';
import {
  commitDeltaCandidates,
  type ManualPushCandidateDescriptor,
  treeCandidates,
} from './manual-push-descriptors.ts';
import { ManualPushProbeError, } from './manual-push-probe.ts';

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
  /**
   * Peeled object identity when local object is annotated tag.
   */
  const peeled = await nanoSpawn(
    gitPath,
    [
      'rev-parse',
      '--verify',
      `${oid}^{}`,
    ],
    { cwd, },
  );
  /**
   * Peeled object ID.
   */
  const peeledOid = peeled.stdout;
  /**
   * Git object type.
   */
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
  /**
   * Range exclusions from authoritative prior destination.
   */
  const exclusions = update.remoteOid === ABSENT_GIT_VALUE
    ? []
    : [`^${update.remoteOid}`,];
  /**
   * Newly reachable commits in oldest-first order.
   */
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
    ...result.stdout
      .split('\n',)
      .filter(function isOid(oid,) {
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
  /**
   * Candidate groups for every content-bearing update.
   */
  const candidateGroups = await Promise.all(updates
    .filter(function hasContent(update,): update is PushUpdate & { readonly localOid: string } {
      return update.localOid !== ABSENT_GIT_VALUE;
    },)
    .map(async function updateCandidates(update,) {
      /**
       * Peeled local target.
       */
      const content = await resolveContentObject({
        gitPath,
        cwd,
        oid: update.localOid,
      },);
      if (content.type === 'commit') {
        /**
         * Every newly reachable commit plus final target state.
         */
        const commits = await pushedCommits({
          gitPath,
          cwd,
          update: {
            ...update,
            localOid: content.oid,
          },
        },);
        return (await Promise.all(commits.map(function commitCandidates(commit,) {
          return commitDeltaCandidates({
            gitPath,
            cwd,
            commitOid: commit,
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
          // A directly pushed blob object publishes its complete content.
          change: 'added',
          content: {
            kind: 'blob',
            oid: content.oid,
          },
        },] satisfies readonly ManualPushCandidateDescriptor[];
      }
      throw new ManualPushProbeError(`Unsupported pushed object type: ${content.type}`,);
    },),);
  /**
   * Ordered descriptors before exact object content is loaded.
   */
  const descriptors = candidateGroups.flat();
  /**
   * One batched read for every unique blob across every pushed state.
   */
  const blobBytes = await loadManualPushBlobs({
    gitPath,
    cwd,
    oids: descriptors.flatMap(function blobOid(descriptor,) {
      return descriptor.content
        .kind
        === 'blob' ? [descriptor.content
          .oid,] : [];
    },),
  },);
  return descriptors.map(
    /**
     * Materializes one lazy candidate over batch-owned bytes.
     *
     * @param descriptor - candidate descriptor
     *
     * @returns candidate with lazy byte provider
     *
     * @mutates descriptor through Promise.resolve thenable assimilation of descriptor content bytes
     */
    function materializeDescriptor(descriptor,): CandidateFile {
      /**
       * Narrowed content source captured by lazy candidate callback.
       */
      const { content, } = descriptor;
      return {
        targetId: descriptor.targetId,
        path: descriptor.path,
        revision: descriptor.revision,
        mode: descriptor.mode,
        change: descriptor.change,
        bytes(): Promise<Uint8Array> {
          if (content.kind === 'inline')
            return Promise.resolve(content.bytes,);
          /**
           * Exact shared blob view loaded by the single batch subprocess.
           */
          const bytes = blobBytes.get(content.oid,);
          if (bytes === undefined)
            throw new ManualPushProbeError(`Git blob batch omitted requested object ${content.oid}.`,);
          return Promise.resolve(bytes,);
        },
      };
    },
  );
}
