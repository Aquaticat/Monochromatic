/**
 * Object-graph walking helpers for the upload-pack code path.
 *
 * `collectReachable` produces the deduplicated OID set that
 * isomorphic-git's `git.packObjects` needs for a fetch/clone response.
 * The exclusion logic mirrors git's classic "want minus have"
 * negotiation: any OID reachable from a `have` is dropped from the pack
 * before the first wanted commit is even visited.
 *
 * Split out of `iso-server.ts` for the max-lines budget; lives in this
 * file because none of the callers in the route layer ever need to
 * touch the walk directly.
 */

import nodeFs from 'node:fs';

import * as git from 'isomorphic-git';

/**
 * Empty set reused as the default `excluded` argument to {@link markReachable}.
 */
const EMPTY_SET: ReadonlySet<string> = new Set<string>();

/**
 * Visits every commit reachable from `wants` (excluding ancestors of
 * `haves`) and collects every commit, tree, and blob OID along the way.
 *
 * @param row - inputs
 *
 * @returns deduplicated OIDs forming the packfile contents
 *
 * @example
 * ```ts
 * const oids = await collectReachable({ gitdir, wants: ['abc...'], haves: [] });
 * ```
 */
export async function collectReachable(row: {
  readonly gitdir: string;
  readonly wants: readonly string[];
  readonly haves: readonly string[];
},): Promise<string[]> {
  /**
   * Collected OIDs that will be packed for the client.
   */
  const visited = new Set<string>();
  /**
   * OIDs the client already has; walked first so we can prune below them.
   */
  const excluded = new Set<string>();
  // Mark every object reachable from haves as excluded.
  for (const haveOid of row.haves) {
    // oxlint-disable-next-line no-await-in-loop -- exclusion walk is best done one commit-tree at a time
    await markReachable({
      gitdir: row.gitdir,
      oid: haveOid,
      bag: excluded,
      excluded: EMPTY_SET,
    },);
  }
  for (const wantOid of row.wants) {
    // oxlint-disable-next-line no-await-in-loop -- per-want walks share state through `visited`/`excluded`; serial is simpler
    await markReachable({
      gitdir: row.gitdir,
      oid: wantOid,
      bag: visited,
      excluded,
    },);
  }
  return [...visited,];
}

/**
 * Marks every commit, tree, and blob reachable from `oid` into `bag`.
 * Stops at any oid already present in `excluded`.
 *
 * @param row - inputs
 *
 * @example
 * ```ts
 * await markReachable({ gitdir, oid, bag: visited, excluded });
 * ```
 */
async function markReachable(row: {
  readonly gitdir: string;
  readonly oid: string;
  readonly bag: Set<string>;
  readonly excluded: ReadonlySet<string>;
},): Promise<void> {
  /**
   * BFS frontier; pop one, push its parents.
   */
  const queue: string[] = [row.oid,];
  while (queue.length
    > 0) {
    /**
     * Current frontier OID; the empty-queue branch above guards `undefined`.
     */
    const oid = queue.shift();
    if (oid === undefined)
      break;
    if (row.bag
      .has(oid,)
      || row
      .excluded
      .has(oid,))
      continue;
    row.bag
      .add(oid,);
    /**
     * Resolved commit object, or `undefined` when the OID is a tag/tree/blob.
     */
    let commit: Awaited<ReturnType<typeof git.readCommit>> | undefined = undefined;
    try {
      // oxlint-disable-next-line no-await-in-loop -- BFS via mutable queue; serial reads are intentional
      commit = await git.readCommit({
        fs: nodeFs,
        gitdir: row.gitdir,
        oid,
      },);
    }
    catch {
      // Not a commit; assume it's already covered as a tree or blob via earlier walk.
      continue;
    }
    for (const parent of commit.commit
      .parent)
      queue.push(parent,);
    // oxlint-disable-next-line no-await-in-loop -- single tree walk per commit; cheaper than parallelizing
    await markTree({
      gitdir: row.gitdir,
      oid: commit.commit
        .tree,
      bag: row.bag,
      excluded: row.excluded,
    },);
  }
}

/**
 * Recursively marks every tree + blob descendant of `oid`. Sub-modules
 * (entries with type `'commit'`) are skipped; their objects belong to
 * a different repo.
 *
 * @param row - inputs
 *
 * @example
 * ```ts
 * await markTree({ gitdir, oid: treeOid, bag, excluded });
 * ```
 */
async function markTree(row: {
  readonly gitdir: string;
  readonly oid: string;
  readonly bag: Set<string>;
  readonly excluded: ReadonlySet<string>;
},): Promise<void> {
  if (row.bag
    .has(row.oid,)
    || row
    .excluded
    .has(row.oid,))
    return;
  row.bag
    .add(row.oid,);
  /**
   * Resolved tree object; entries drive the per-child branch below.
   */
  const tree = await git.readTree({
    fs: nodeFs,
    gitdir: row.gitdir,
    oid: row.oid,
  },);
  for (const entry of tree.tree) {
    if (entry.type
      === 'blob') {
      if ((!row.bag
        .has(entry.oid,)) && (!row.excluded
          .has(entry.oid,)))
        row.bag
          .add(entry.oid,);
    }
    else if (entry.type
      === 'tree') {
      // oxlint-disable-next-line no-await-in-loop -- recursion via shared state
      await markTree({
        gitdir: row.gitdir,
        oid: entry.oid,
        bag: row.bag,
        excluded: row.excluded,
      },);
    }
    // Submodule entries (`type === 'commit'`) live in another repo; skip.
  }
}
