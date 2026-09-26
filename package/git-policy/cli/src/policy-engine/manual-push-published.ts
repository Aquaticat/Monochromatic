/**
 Manual-push object resolution and already-published commit discovery.

 A pushed commit is already published when it is reachable from a commit Git
 knows the destination remote has: that remote's remote-tracking refs, or any
 authoritative prior destination value of an update to the same remote.
 Resolution uses one `cat-file --batch-check` and one `for-each-ref` process
 per evaluation, independent of update count and history length.

 @module
 */
import {
  ABSENT_GIT_VALUE,
  type PushUpdate,
} from '../api/context-types.ts';
import type { GitObjectId, } from '../api/policy-types.ts';
import { runGitBytes, } from './manual-push-descriptors.ts';
import { ManualPushProbeError, } from './manual-push-probe-types.ts';

/**
 Strict decoder for Git metadata output.
 */
const DECODER = new TextDecoder(
  'utf-8',
  { fatal: true, },
);
/**
 Batch-check output suffix for names Git cannot resolve locally.
 */
const MISSING_SUFFIX = ' missing';
/**
 Remote-tracking ref namespace Git's default fetch refspec writes.
 */
const TRACKING_NAMESPACE = 'refs/remotes/';

/**
 Peeled object identity and type.
 */
export type ResolvedObject = Readonly<{
  /**
   Fully peeled object ID.
   */
  oid: GitObjectId;
  /**
   Git object type after peeling.
   */
  type: string;
}>;

/**
 Splits Git line output, dropping the terminal empty line.

 @param bytes - raw stdout

 @returns non-empty lines
 */
function outputLines(bytes: Uint8Array,): readonly string[] {
  return DECODER.decode(bytes,)
    .split('\n',)
    .filter(function isLine(line,) {
      return line.length > 0;
    },);
}

/**
 Peels every requested object through one batch-check process.

 Names absent from the local object database resolve to `undefined`, which
 callers treat as unknown rather than failing: a remote value Git never
 fetched cannot bound a scan, and a missing local value fails later.

 @param gitPath - resolved real Git executable

 @param cwd - effective repository directory

 @param oids - object IDs to peel

 @returns peeled object per requested ID, `undefined` when missing

 @throws ManualPushProbeError when Git fails or output is malformed

 @example
 ```ts
 await peelObjects({ gitPath: '/usr/bin/git', cwd: '/repo', oids: ['abc'] });
 ```
 */
export async function peelObjects({
  gitPath,
  cwd,
  oids,
}: Readonly<{
  gitPath: string;
  cwd: string;
  oids: readonly GitObjectId[];
}>,): Promise<ReadonlyMap<GitObjectId, ResolvedObject | undefined>> {
  /**
   Unique request order.
   */
  const requested = [...new Set(oids,),];
  if (requested.length === 0)
    return new Map();
  /**
   One output line per requested name, in request order.
   */
  const lines = outputLines(await runGitBytes({
    gitPath,
    cwd,
    args: [
      'cat-file',
      '--batch-check=%(objectname) %(objecttype)',
    ],
    input: `${requested.map(function peeledName(oid,) {
      return `${oid}^{}`;
    },).join('\n',)}\n`,
  },),);
  if (lines.length !== requested.length)
    throw new ManualPushProbeError('Git object batch-check returned an unexpected record count.',);
  return new Map(requested.map(function pairLine(oid, index,): readonly [
    GitObjectId,
    ResolvedObject | undefined
  ] {
    /**
     Output line for current request.
     */
    const line = lines[index] ?? '';
    if (line === `${oid}^{}${MISSING_SUFFIX}`)
      return [oid, undefined,];
    /**
     Peeled object ID and type fields.
     */
    const [peeledOid, type, extra,] = line.split(' ',);
    if ((peeledOid === undefined) || (type === undefined)
      || (extra !== undefined))
      throw new ManualPushProbeError(`Git object batch-check returned malformed record: ${line}`,);
    return [oid, { oid: peeledOid, type, },];
  },),);
}

/**
 Lists commits at every remote-tracking ref, grouped by remote name.

 Uses one `for-each-ref` process and literal prefix matching, so remote names
 are never interpreted as glob patterns.

 @param gitPath - resolved real Git executable

 @param cwd - effective repository directory

 @param remoteNames - destination remote names of interest

 @returns tracking commits per requested remote name

 @throws ManualPushProbeError when Git fails or output is malformed

 @example
 ```ts
 await trackingCommits({ gitPath: '/usr/bin/git', cwd: '/repo', remoteNames: ['origin'] });
 ```
 */
export async function trackingCommits({
  gitPath,
  cwd,
  remoteNames,
}: Readonly<{
  gitPath: string;
  cwd: string;
  remoteNames: ReadonlySet<string>;
}>,): Promise<ReadonlyMap<string, readonly GitObjectId[]>> {
  if (remoteNames.size === 0)
    return new Map();
  /**
   Object ID, type, and name of every remote-tracking ref.
   */
  const refs = outputLines(await runGitBytes({
    gitPath,
    cwd,
    args: [
      'for-each-ref',
      '--format=%(objectname) %(objecttype) %(refname)',
      TRACKING_NAMESPACE,
    ],
  },),).map(function parseRef(line,) {
    /**
     Space-delimited fields; ref names cannot contain spaces.
     */
    const [oid, type, refName, extra,] = line.split(' ',);
    if ((oid === undefined) || (type === undefined)
      || (refName === undefined)
      || (extra !== undefined))
      throw new ManualPushProbeError(`Git for-each-ref returned malformed record: ${line}`,);
    return { oid, type, refName, };
  },);
  return new Map([...remoteNames,].map(function commitsFor(remoteName,): readonly [
    string,
    readonly GitObjectId[]
  ] {
    /**
     Literal namespace owned by current remote.
     */
    const prefix = `${TRACKING_NAMESPACE}${remoteName}/`;
    return [
      remoteName,
      refs.filter(function isRemoteCommit(ref,) {
        return (ref.type === 'commit') && ref.refName.startsWith(prefix,);
      },).map(function oidOf(ref,) {
        return ref.oid;
      },),
    ];
  },),);
}

/**
 Collects commits Git knows each destination remote already has.

 @param updates - every authoritative update, deletions included

 @param peeled - peeled objects keyed by requested object ID

 @param tracking - remote-tracking commits per remote name

 @returns unique published commit tips per remote name

 @example
 ```ts
 publishedTips({ updates: [], peeled: new Map(), tracking: new Map() });
 ```
 */
export function publishedTips({
  updates,
  peeled,
  tracking,
}: Readonly<{
  updates: readonly PushUpdate[];
  peeled: ReadonlyMap<GitObjectId, ResolvedObject | undefined>;
  tracking: ReadonlyMap<string, readonly GitObjectId[]>;
}>,): ReadonlyMap<string, readonly GitObjectId[]> {
  /**
   Remote names in first-seen order.
   */
  const remoteNames = [...new Set(updates.map(function nameOf(update,) {
    return update.remoteName;
  },),),];
  return new Map(remoteNames.map(function tipsFor(remoteName,): readonly [
    string,
    readonly GitObjectId[]
  ] {
    /**
     Locally present prior destination commits for current remote.
     */
    const priorCommits = updates.flatMap(function priorCommit(update,): readonly GitObjectId[] {
      if ((update.remoteName !== remoteName) || (update.remoteOid === ABSENT_GIT_VALUE))
        return [];
      /**
       Peeled prior destination, absent when never fetched.
       */
      const prior = peeled.get(update.remoteOid,);
      return prior?.type === 'commit' ? [prior.oid,] : [];
    },);
    return [
      remoteName,
      [...new Set([
        ...(tracking.get(remoteName,) ?? []),
        ...priorCommits,
      ],),],
    ];
  },),);
}
