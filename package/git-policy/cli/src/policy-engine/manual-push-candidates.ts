/**
 Manual-push content candidate materialization.
 
 Scans only what a push newly publishes: commits the destination remote does
 not already have, or the pushed tip's final tree when Git knows nothing on
 that remote. Process count is bounded independently of history length.
 
 @module
 */
import {
  ABSENT_GIT_VALUE,
  type PushUpdate,
} from '../api/context-types.ts';
import type { CandidateFile, } from '../api/policy-types.ts';
import { loadBlobBatch, } from './blob-batch.ts';
import {
  commitRangeDeltas,
  type ManualPushCandidateDescriptor,
  recordDescriptor,
  runGitBytes,
  treeCandidates,
} from './manual-push-descriptors.ts';
import {
  peelObjects,
  publishedTips,
  type ResolvedObject,
  trackingCommits,
} from './manual-push-published.ts';
import { mapBounded, } from './map-bounded.ts';
import { ManualPushProbeError, } from './manual-push-probe.ts';

/**
 Maximum simultaneously running per-update Git processes (rev-list or
 ls-tree). Push update count is caller-controlled (`--tags`, `--mirror`), so
 per-update work never fans out beyond this cap.
 */
const UPDATE_LANES = 4;

/**
 Content-bearing update with its peeled local target.
 */
type ContentUpdate = Readonly<{
  /**
   Authoritative update.
   */
  update: PushUpdate;
  /**
   Peeled pushed object.
   */
  content: ResolvedObject;
}>;

/**
 Candidate plan for one update before batched commit deltas are known.
 */
type UpdatePlan = Readonly<{
  /**
   Descriptors known without commit deltas.
   */
  kind: 'descriptors';
  /**
   Complete descriptors.
   */
  descriptors: readonly ManualPushCandidateDescriptor[];
}> | Readonly<{
  /**
   Newly published commit range awaiting batched deltas.
   */
  kind: 'range';
  /**
   Target prefix naming remote and ref.
   */
  targetBase: string;
  /**
   Newly published commits, oldest first.
   */
  commits: readonly string[];
}>;

/**
 Creates manual-push-domain error for failed or malformed Git output.
 
 @param message - safe failure explanation
 
 @returns probe failure
 */
function probeError(message: string,): Error {
  return new ManualPushProbeError(message,);
}

/**
 Lists commits reachable from one pushed tip but not from any published tip.
 
 @param gitPath - resolved real Git executable
 
 @param cwd - effective repository directory
 
 @param tip - pushed commit
 
 @param published - non-empty commits Git knows the destination has
 
 @returns newly published commits, oldest first
 */
async function unpublishedCommits({
  gitPath,
  cwd,
  tip,
  published,
}: Readonly<{
  gitPath: string;
  cwd: string;
  tip: string;
  published: readonly string[];
}>,): Promise<readonly string[]> {
  /**
   Range output; exclusions travel on stdin so ref count never meets argv limits.
   */
  const output = await runGitBytes({
    gitPath,
    cwd,
    args: [
      'rev-list',
      '--reverse',
      '--stdin',
    ],
    input: `${[
      tip,
      ...published.map(function exclude(oid,) {
      return `^${oid}`;
    },),
    ].join('\n',)}\n`,
  },);
  return new TextDecoder().decode(output,)
    .split('\n',)
    .filter(function isOid(oid,) {
      return oid.length > 0;
    },);
}

/**
 Plans one content-bearing update's candidates.
 
 A pushed commit scans each commit its destination lacks. When Git knows no
 commit on that destination, it scans the pushed tip's final tree once
 instead of walking every commit in history.
 
 @param gitPath - resolved real Git executable
 
 @param cwd - effective repository directory
 
 @param contentUpdate - update with peeled target
 
 @param published - known published commits per remote name
 
 @returns candidate plan
 
 @throws ManualPushProbeError for unsupported pushed object types
 */
async function planUpdate({
  gitPath,
  cwd,
  contentUpdate,
  published,
}: Readonly<{
  gitPath: string;
  cwd: string;
  contentUpdate: ContentUpdate;
  published: ReadonlyMap<string, readonly string[]>;
}>,): Promise<UpdatePlan> {
  /**
   Authoritative update and its peeled pushed object.
   */
  const {
    update,
    content,
  } = contentUpdate;
  /**
   Target prefix naming remote and destination ref.
   */
  const targetBase = `manual-push:${update.remoteName}:${update.remoteRef}`;
  /**
   Commits Git knows destination remote already has.
   */
  const knownTips = published.get(update.remoteName,) ?? [];
  if ((content.type === 'tree') || ((content.type === 'commit') && (knownTips.length === 0))) {
    return {
      kind: 'descriptors',
      descriptors: await treeCandidates({
        gitPath,
        cwd,
        treeish: content.oid,
        targetPrefix: `${targetBase}:${content.oid}`,
      },),
    };
  }
  if (content.type === 'commit') {
    return {
      kind: 'range',
      targetBase,
      commits: await unpublishedCommits({
        gitPath,
        cwd,
        tip: content.oid,
        published: knownTips,
      },),
    };
  }
  if (content.type === 'blob') {
    return {
      kind: 'descriptors',
      descriptors: [{
        targetId: `${targetBase}:${content.oid}`,
        path: update.remoteRef,
        revision: content.oid,
        mode: 'regular',
        // A directly pushed blob object publishes its complete content.
        change: 'added',
        content: {
          kind: 'blob',
          oid: content.oid,
        },
      },],
    };
  }
  throw new ManualPushProbeError(`Unsupported pushed object type: ${content.type}`,);
}

/**
 Resolves every content-bearing update to a candidate plan.
 
 Uses one batch-check and one for-each-ref process, then at most
 {@link UPDATE_LANES} concurrent per-update processes.
 
 @param gitPath - resolved real Git executable
 
 @param cwd - effective repository directory
 
 @param updates - authoritative push updates
 
 @returns plans in update order
 */
async function planUpdates({
  gitPath,
  cwd,
  updates,
}: Readonly<{
  gitPath: string;
  cwd: string;
  updates: readonly PushUpdate[];
}>,): Promise<readonly UpdatePlan[]> {
  /**
   Updates that publish content.
   */
  const contentBearing = updates.filter(function hasContent(update,): update is PushUpdate & { readonly localOid: string } {
    return update.localOid !== ABSENT_GIT_VALUE;
  },);
  if (contentBearing.length === 0)
    return [];
  /**
   Peeled local targets and prior destinations, plus remote-tracking commits.
   */
  const [peeled, tracking,] = await Promise.all([
    peelObjects({
      gitPath,
      cwd,
      oids: updates.flatMap(function objectIds(update,): readonly string[] {
        return [
          update.localOid,
          update.remoteOid,
        ].filter(function isOid(oid,): oid is string {
          return oid !== ABSENT_GIT_VALUE;
        },);
      },),
    },),
    trackingCommits({
      gitPath,
      cwd,
      remoteNames: new Set(contentBearing.map(function nameOf(update,) {
        return update.remoteName;
      },),),
    },),
  ],);
  /**
   Known published commits per remote name.
   */
  const published = publishedTips({
    updates,
    peeled,
    tracking,
  },);
  return await mapBounded({
    values: contentBearing,
    concurrency: UPDATE_LANES,
    map: async function planOne({ value: update, },) {
      /**
       Peeled pushed object.
       */
      const content = peeled.get(update.localOid,);
      if (content === undefined)
        throw new ManualPushProbeError(`Pushed object is missing locally: ${update.localOid}`,);
      return await planUpdate({
        gitPath,
        cwd,
        contentUpdate: {
          update,
          content,
        },
        published,
      },);
    },
  },);
}

/**
 Materializes every content-bearing pushed state.
 
 @param gitPath - resolved real Git executable
 
 @param cwd - effective repository directory
 
 @param updates - authoritative push updates
 
 @returns immutable content candidates
 
 @example
 ```ts
 await createManualPushCandidates({ gitPath: '/usr/bin/git', cwd: '/repo', updates: [] });
 ```
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
   Per-update plans in update order.
   */
  const plans = await planUpdates({
    gitPath,
    cwd,
    updates,
  },);
  /**
   Deltas for every planned commit through one diff-tree process.
   */
  const deltas = await commitRangeDeltas({
    gitPath,
    cwd,
    commits: plans.flatMap(function rangeCommits(plan,) {
      return plan.kind === 'range' ? plan.commits : [];
    },),
  },);
  /**
   Candidate groups for every content-bearing update.
   */
  const candidateGroups = plans.map(function planDescriptors(plan,): readonly ManualPushCandidateDescriptor[] {
    if (plan.kind === 'descriptors')
      return plan.descriptors;
    return plan.commits
      .flatMap(function commitDescriptors(commit,) {
      return (deltas.get(commit,) ?? []).map(function toDescriptor(record,) {
        return recordDescriptor({
          record,
          targetPrefix: `${plan.targetBase}:${commit}`,
        },);
      },);
    },);
  },);
  /**
   Ordered descriptors before exact object content is loaded.
   */
  const descriptors = candidateGroups.flat();
  /**
   One batched read for every unique blob across every pushed state.
   */
  const blobBytes = await loadBlobBatch({
    gitPath,
    cwd,
    oids: descriptors.flatMap(function blobOid(descriptor,) {
      return descriptor.content
        .kind
        === 'blob' ? [descriptor.content
          .oid,] : [];
    },),
    createError: probeError,
  },);
  return descriptors.map(
    /**
     Materializes one lazy candidate over batch-owned bytes.
     
     @param descriptor - candidate descriptor
     
     @returns candidate with lazy byte provider
     
     @mutates descriptor through Promise.resolve then getter or callback effects while assimilating descriptor content bytes
     */
    function materializeDescriptor(descriptor,): CandidateFile {
      /**
       Narrowed content source captured by lazy candidate callback.
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
           Exact shared blob view loaded by the single batch subprocess.
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
