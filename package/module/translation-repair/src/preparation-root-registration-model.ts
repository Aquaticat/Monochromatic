import type { BlockPairingQuestion, } from './block-pairing-question.ts';
import type { PreparationDefinitionDomain, } from './preparation-definition-model.ts';
import type { PreparationReceiptQuestion, } from './preparation-receipt-model.ts';
import type { PreparationRootNode, } from './preparation-root-population-model.ts';

//region Initial correspondence scope without acquisition authority

/**
 * Parent membership in the frozen writer pool and deterministic definition closure remains distinct.
 *
 * @example
 * ```ts
 * const role: PreparationRootParentRole = 'footnote-definitions';
 * ```
 */
export type PreparationRootParentRole = 'writer-parent' | 'footnote-definitions';

/**
 * Complete current parent identity shared by structural and questioned preparation records.
 *
 * @example
 * ```ts
 * const identity: PreparationRootParentIdentity = { parentId, entryId, roles, sourceHash, targetHash, pairIndex, sourceIndex, targetIndex, definitionDomain };
 * ```
 */
export type PreparationRootParentIdentity = {
  /** Initial canonical parent identity; later eligibility changes must not redraw it. */
  readonly parentId: string;
  /** Complete entry owning source/context authority. */
  readonly entryId: string;
  /** Definition closure does not grant writer authority to an added dependency. */
  readonly roles: readonly PreparationRootParentRole[];
  /** Complete current original identity. */
  readonly sourceHash: string;
  /** Complete current normalized incumbent identity. */
  readonly targetHash: string;
  /** Combined deterministic parent position. */
  readonly pairIndex: number;
  /** Source-side section identity. */
  readonly sourceIndex: number;
  /** Target-side section or insertion-anchor identity. */
  readonly targetIndex: number;
  /** Ordered definition-node identities are not relation endorsements. */
  readonly definitionDomain: PreparationDefinitionDomain;
};

/**
 * Only queried records contain substantive model questions; zero-question records cannot manufacture ballots.
 *
 * @example
 * ```ts
 * if (registration.dispatch === 'queried') inspect(registration.question);
 * ```
 */
export type PreparationRootRegistration = PreparationRootParentIdentity & ({
  /** Native preparation requires a block correspondence question. */
  readonly dispatch: 'queried';
  /** Actual shared native block numbering, messages and schema. */
  readonly question: PreparationReceiptQuestion;
  /** Historical native key remains separate from current plan/receipt authority. */
  readonly questionKey: string;
  /** Exact protocol/question digest for initial same-payload alias accounting. */
  readonly questionDigest: string;
  /** Current interpretation metadata does not alter substantive messages. */
  readonly freeOrder: BlockPairingQuestion['freeOrder'];
} | {
  /** Existing empty-side and singleton paths are structural records, not acquired evidence. */
  readonly dispatch: 'empty' | 'implicit';
});

/**
 * Unaligned definition nodes are explicit namespace inventory, not an instruction to expand correspondence scope.
 *
 * @example
 * ```ts
 * const namespace: PreparationRootUnalignedDefinitions = { scope: 'unaligned-definition-namespace', entryId, source, target };
 * ```
 */
export type PreparationRootUnalignedDefinitions = {
  /** Neither pairing authority nor automatic prompt context follows from these nodes. */
  readonly scope: 'unaligned-definition-namespace';
  /** Complete document pair owning the unaligned inventory. */
  readonly entryId: string;
  /** Source-only namespace evidence can remain outside all registered parent questions. */
  readonly source: readonly PreparationRootNode[];
  /** Target namespace evidence is retained independently, including absence. */
  readonly target: readonly PreparationRootNode[];
};

/**
 * Initial identical questions can share only explicitly registered same-attempt payload lineage later.
 *
 * @example
 * ```ts
 * const aliases: PreparationRootQuestionAliases = { questionDigest, parentIds };
 * ```
 */
export type PreparationRootQuestionAliases = {
  /** Identical native question/protocol bytes, not shared occurrence qualification. */
  readonly questionDigest: string;
  /** Ordered current occurrences still require their own receipt interpretation. */
  readonly parentIds: readonly string[];
};

//endregion Initial correspondence scope without acquisition authority
