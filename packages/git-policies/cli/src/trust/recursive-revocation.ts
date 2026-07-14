/**
 * Recursive trust revocation planning and transaction. @module
 */
import type { TrustIdentity, } from './types.ts';
import {
  listTrustRecords,
  trustIdentityKey,
  type TrustCatalogEntry,
} from './registry-catalog.ts';
import { acquireRecursiveRegistryLock, } from './registry-recursive-lock.ts';
import {
  applyProvenanceTransaction,
  recoverProvenanceTransactions,
  type ProvenanceOperation,
} from './registry-transaction.ts';

/**
 * Recursive untrust result.
 */
export type RecursiveUntrustResult = Readonly<{
  /**
   * Whether exact target record existed.
   */
  removed: boolean;
  /**
   * Canonical recursive roots revoked by cascade.
   */
  affectedRoots: readonly string[];
}>;

/**
 * Expands nested recursive-root cascade through provenance graph.
 *
 * @param targets - exact target records
 *
 * @param entriesByKey - installed records by identity
 *
 * @returns identities whose authority must be removed
 */
function cascadeRootKeys({
  targets,
  entriesByKey,
}: Readonly<{
  targets: readonly TrustCatalogEntry[];
  entriesByKey: ReadonlyMap<string, TrustCatalogEntry>;
}>,): ReadonlySet<string> {
  /**
   * Mutable structural graph work state.
   */
  const revoked = new Set<string>(targets.map(function targetKey(target,) {
    return trustIdentityKey(target.record
      .identity,);
  },),);
  /**
   * Bounded provenance graph work stack.
   */
  const pending = targets.flatMap(function recursiveAuthorizers(target,) {
    return target.record
      .recursiveChildren ? target.record
        .authorizingRoots : [];
  },);
  while (pending.length > 0) {
    /**
     * Next outer authorizer.
     */
    const identity = pending.pop();
    if (identity === undefined)
      continue;
    /**
     * Exact authorizer key.
     */
    const key = trustIdentityKey(identity,);
    if (revoked.has(key,))
      continue;
    /**
     * Installed recursive outer root.
     */
    const outer = entriesByKey.get(key,);
    if ((outer === undefined) || (!outer.record
      .recursiveChildren))
      continue;
    revoked.add(key,);
    pending.push(...outer.record
      .authorizingRoots,);
  }
  return revoked;
}

/**
 * Computes final provenance operations after root cascade.
 *
 * @param entries - installed catalog
 *
 * @param revokedKeys - identities losing authority
 *
 * @returns only changed record operations
 */
function planOperations({
  entries,
  revokedKeys,
}: Readonly<{
  entries: readonly TrustCatalogEntry[];
  revokedKeys: ReadonlySet<string>;
}>,): readonly ProvenanceOperation[] {
  return entries.flatMap<ProvenanceOperation>(function planEntry(entry,) {
    /**
     * Current record identity key.
     */
    const entryKey = trustIdentityKey(entry.record
      .identity,);
    /**
     * Provenance surviving cascade.
     */
    const retained = entry.record
      .authorizingRoots
      .filter(function retainedAuthorizer(identity,) {
      return !revokedKeys.has(trustIdentityKey(identity,),);
    },);
    /**
     * Legacy empty provenance denotes explicit trust.
     */
    const legacyExplicit = entry.record
      .authorizingRoots
      .length
      === 0;
    /**
     * Whether record itself is one revoked root.
     */
    const revokeRecord = revokedKeys.has(entryKey,);
    if ((revokeRecord && legacyExplicit)
      || ((!legacyExplicit) && (retained.length === 0))) {
      return [{
        identity: entry.record
          .identity,
        action: 'remove',
      },];
    }
    if ((!revokeRecord) && (retained.length
      === entry.record
      .authorizingRoots
      .length))
      return [];
    return [{
      identity: entry.record
        .identity,
      action: 'update',
      authorizingRoots: retained,
    },];
  },);
}

/**
 * Revokes exact target plus inherited and nested recursive authority.
 *
 * @param registryRoot - complete private registry root
 *
 * @param identities - current or recovered target identities
 *
 * @param disclose - prints affected recursive roots before mutation
 *
 * @returns removal and cascade summary
 *
 * @example
 * ```ts
 * await revokeRecursiveTrust({ registryRoot, identities: [identity], disclose: console.error });
 * ```
 */
export async function revokeRecursiveTrust({
  registryRoot,
  identities,
  disclose,
}: {
  readonly registryRoot: string;
  readonly identities: readonly TrustIdentity[];
  readonly disclose: (text: string,) => void;
},): Promise<RecursiveUntrustResult> {
  /**
   * Registry-wide lock serializes revocation against descendant enrollment.
   */
  await using recursiveLock = await acquireRecursiveRegistryLock({ registryRoot, },);
  await recoverProvenanceTransactions({ registryRoot, },);
  /**
   * Every installed record before mutation.
   */
  const entries = await listTrustRecords({ registryRoot, },);
  /**
   * Installed records by exact identity.
   */
  const entriesByKey = new Map(entries.map(function keyedEntry(entry,) {
    return [
      trustIdentityKey(entry.record
        .identity,),
      entry,
    ] as const;
  },),);
  /**
   * Exact current or recovered target entries.
   */
  const targets = identities
    .map(function targetEntry(identity,) {
      return entriesByKey.get(trustIdentityKey(identity,),);
    },)
    .filter(function targetExists(entry,): entry is TrustCatalogEntry {
      return entry !== undefined;
    },);
  if (targets.length === 0)
    return {
      removed: false,
      affectedRoots: [],
    };
  /**
   * Root identities removed directly or by nested cascade.
   */
  const revokedKeys = cascadeRootKeys({
    targets,
    entriesByKey,
  },);
  /**
   * Canonical affected recursive root paths.
   */
  const affectedRootCandidates = [...revokedKeys,]
    .map(function affectedEntry(key,) {
      return entriesByKey.get(key,);
    },)
    .filter(function isRecursiveEntry(entry,): entry is TrustCatalogEntry {
      return (entry !== undefined)
        && entry.record
        .recursiveChildren;
    },)
    .map(function repositoryRoot(entry,) {
      return entry.record
        .repositoryRoot;
    },);
  /**
   * Deterministic unique affected paths across replaced identities.
   */
  const affectedRoots = [...new Set(affectedRootCandidates,)].toSorted();
  if (affectedRoots.length > 0) {
    disclose([
      'cli-git recursive untrust cascade',
      ...affectedRoots.map(function affectedRoot(root,) {
        return `Affected recursive root: ${root}`;
      },),
      'Inherited descendant and sibling authority from these roots will be revoked.',
    ].join('\n',),);
  }
  /**
   * Complete changed provenance plan.
   */
  const operations = planOperations({
    entries,
    revokedKeys,
  },);
  await applyProvenanceTransaction({
    registryRoot,
    operations,
  },);
  return {
    removed: true,
    affectedRoots,
  };
}
