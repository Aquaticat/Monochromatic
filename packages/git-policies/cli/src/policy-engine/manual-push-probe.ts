/**
 * Authoritative manual-push update facts.
 *
 * @module
 */
import nanoSpawn from 'nano-spawn';
import {
  ABSENT_GIT_VALUE,
  type PushUpdate,
} from '../api/context-types.ts';
import { captureProbedPushUpdates, } from './manual-push-hook.ts';
import {
  isZeroOid,
  ManualPushProbeError,
  type ProbedPushUpdate,
} from './manual-push-probe-types.ts';

/**
 * Parses authoritative `git ls-remote --refs` output.
 *
 * @param output - exact command stdout
 *
 * @returns remote ref to object-ID map
 */
function parseRemoteRefs(output: string,): ReadonlyMap<string, string> {
  return new Map(output.split('\n',)
    .filter(function isRecord(line,) {
      return line.length > 0;
    },)
    .map(function parseRecord(line,): readonly [
      string,
      string
    ] {
      /**
       * Tab separating object ID from fully qualified ref.
       */
      const separator = line.indexOf('\t',);
      if (separator === (-1))
        throw new ManualPushProbeError(`Malformed ls-remote record: ${line}`,);
      return [
        line.slice(separator + 1,),
        line.slice(
          0,
          separator,
        ),
      ];
    },),);
}

/**
 * Resolves one destination's authoritative remote object IDs.
 *
 * @param gitPath - resolved real Git executable
 *
 * @param cwd - effective repository directory
 *
 * @param remoteLocation - destination remote location
 *
 * @param updates - negotiated updates for destination
 *
 * @returns public push updates
 */
async function resolveRemoteGroup({
  gitPath,
  cwd,
  remoteLocation,
  updates,
}: Readonly<{
  gitPath: string;
  cwd: string;
  remoteLocation: string;
  updates: readonly ProbedPushUpdate[];
}>,): Promise<readonly PushUpdate[]> {
  /**
   * Authoritative remote reference query.
   */
  const result = await nanoSpawn(
    gitPath,
    [
      'ls-remote',
      '--refs',
      remoteLocation,
      ...updates.map(function remoteRef(update,) {
        return update.remoteRef;
      },),
    ],
    { cwd, },
  );
  /**
   * Authoritative remote references by fully qualified name.
   */
  const remoteRefs = parseRemoteRefs(result.stdout,);
  return updates.map(function publicUpdate(update,): PushUpdate {
    /**
     * Authoritative destination value after dry-run negotiation.
     */
    const authoritativeOid = remoteRefs.get(update.remoteRef,);
    /**
     * Whether push negotiation observed destination absence.
     */
    const advertisedAbsent = isZeroOid(update.advertisedRemoteOid,);
    if ((authoritativeOid === undefined) !== advertisedAbsent)
      throw new ManualPushProbeError(`Remote ref changed during manual-push discovery: ${update.remoteRef}`,);
    if ((authoritativeOid !== undefined) && (authoritativeOid !== update.advertisedRemoteOid))
      throw new ManualPushProbeError(`Remote ref changed during manual-push discovery: ${update.remoteRef}`,);
    return {
      localOid: isZeroOid(update.localOid,) ? ABSENT_GIT_VALUE : update.localOid,
      remoteOid: authoritativeOid ?? ABSENT_GIT_VALUE,
      remoteName: update.remoteName,
      remoteRef: update.remoteRef,
    };
  },);
}

/**
 * Resolves authoritative remote object IDs and validates negotiation freshness.
 *
 * @param gitPath - resolved real Git executable
 *
 * @param cwd - effective repository directory
 *
 * @param updates - Git-negotiated destination updates
 *
 * @returns public push updates
 */
async function resolveRemoteOids({
  gitPath,
  cwd,
  updates,
}: Readonly<{
  gitPath: string;
  cwd: string;
  updates: readonly ProbedPushUpdate[];
}>,): Promise<readonly PushUpdate[]> {
  /**
   * Updates grouped by exact destination location.
   */
  const byLocation = new Map<string, ProbedPushUpdate[]>();
  for (const update of updates) {
    /**
     * Existing updates for current exact destination.
     */
    const locationUpdates = byLocation.get(update.remoteLocation,);
    if (locationUpdates === undefined) {
      byLocation.set(
        update.remoteLocation,
        [update,],
      );
      continue;
    }
    locationUpdates.push(update,);
  }
  /**
   * Concurrent authority queries, one per destination.
   */
  const resolvedGroups = await Promise.all([...byLocation.entries(),]
    .map(function resolveLocation([remoteLocation, locationUpdates,],) {
      return resolveRemoteGroup({
        gitPath,
        cwd,
        remoteLocation,
        updates: locationUpdates,
      },);
    },),);
  return resolvedGroups.flat();
}

/**
 * Discovers exact updates Git would push without updating remote refs.
 *
 * @param gitPath - resolved real Git executable
 *
 * @param cwd - effective repository directory
 *
 * @param args - transformed push arguments
 *
 * @returns authoritative push updates
 *
 * @example
 * ```ts
 * await probeManualPushUpdates({ gitPath: '/usr/bin/git', cwd: '/repo', args: ['push', 'origin', 'main'] });
 * ```
 */
export async function probeManualPushUpdates({
  gitPath,
  cwd,
  args,
}: Readonly<{
  gitPath: string;
  cwd: string;
  args: readonly string[];
}>,): Promise<readonly PushUpdate[]> {
  /**
   * Git-resolved mappings from private dry-run hook.
   */
  const updates = await captureProbedPushUpdates({
    gitPath,
    cwd,
    args,
  },);
  return await resolveRemoteOids({
    gitPath,
    cwd,
    updates,
  },);
}

export { ManualPushProbeError, } from './manual-push-probe-types.ts';
