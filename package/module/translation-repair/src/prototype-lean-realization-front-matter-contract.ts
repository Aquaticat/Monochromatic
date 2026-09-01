// PROTOTYPE ONLY: Candidate L canonical front-matter authority policy.

import { hashContent, } from './document-node.ts';

/**
 * Candidate L front-matter semantic authority.
 */
export type LeanFrontMatterAuthority = 'description' | 'identity' | 'location';

/**
 * Shared scalar grammar required by every Candidate L front-matter path.
 */
type LeanScalarGrammar = {
  readonly nonempty: true;
  readonly singleLine: true;
};

/**
 * One canonical path-specific authority and executable grammar contract.
 */
export type LeanFrontMatterContract =
  | {
    readonly path: readonly string[];
    readonly kind: 'alias';
    readonly authority: 'identity';
    readonly grammar: LeanScalarGrammar & {
      readonly sourceDelimiter: ',';
      readonly targetDelimiter: ', ';
      readonly memberCount: 'source-exact';
      readonly memberOrder: 'source-exact';
      readonly protectedCasedMember: 'exact-at-position';
    };
  }
  | {
    readonly path: readonly string[];
    readonly kind: 'name';
    readonly authority: 'identity';
    readonly grammar: LeanScalarGrammar & {
      readonly equalsAliasMember: true;
    };
  }
  | {
    readonly path: readonly string[];
    readonly kind: 'location';
    readonly authority: 'location';
    readonly grammar: LeanScalarGrammar;
  }
  | {
    readonly path: readonly string[];
    readonly kind: 'description';
    readonly authority: 'description';
    readonly grammar: LeanScalarGrammar;
  };

/**
 * Canonical Candidate L path order, authority, and grammar policy.
 */
export const LEAN_FRONT_MATTER_CONTRACTS: readonly LeanFrontMatterContract[] = [
  {
    path: ['name',],
    kind: 'name',
    authority: 'identity',
    grammar: {
      nonempty: true,
      singleLine: true,
      equalsAliasMember: true,
    },
  },
  {
    path: [
      'info',
      'alias',
    ],
    kind: 'alias',
    authority: 'identity',
    grammar: {
      nonempty: true,
      singleLine: true,
      sourceDelimiter: ',',
      targetDelimiter: ', ',
      memberCount: 'source-exact',
      memberOrder: 'source-exact',
      protectedCasedMember: 'exact-at-position',
    },
  },
  {
    path: [
      'info',
      'location',
    ],
    kind: 'location',
    authority: 'location',
    grammar: {
      nonempty: true,
      singleLine: true,
    },
  },
  {
    path: ['desc',],
    kind: 'description',
    authority: 'description',
    grammar: {
      nonempty: true,
      singleLine: true,
    },
  },
];

/**
 * Canonical path-specific authority and serialization policy identity.
 */
export const LEAN_FRONT_MATTER_AUTHORITY_DIGEST: string = hashContent({
  content: JSON.stringify({
    contracts: LEAN_FRONT_MATTER_CONTRACTS,
    yaml: 'runtime-serialized-source-shape',
  },),
});

/**
 * Resolves one canonical path contract.
 *
 * @returns Exact contract or throws
 *
 * @example
 * ```ts
 * const contract = leanFrontMatterContract({ path: ['name'], });
 * ```
 */
export function leanFrontMatterContract({
  path,
}: {
  readonly path: readonly string[];
}): LeanFrontMatterContract {
  /**
   * Existing contract for exact canonical path.
   */
  const contract = LEAN_FRONT_MATTER_CONTRACTS.find(function same(value,) {
    return JSON.stringify(value.path,) === JSON.stringify(path,);
  },);
  if (contract === undefined)
    throw new Error('lean realization front matter contract is absent');
  return contract;
}

/**
 * Resolves one unique contract by semantic kind.
 *
 * @param kind - Closed path role
 *
 * @returns Exact narrowed contract or throws
 *
 * @example
 * ```ts
 * const alias = leanFrontMatterContractOfKind('alias',);
 * ```
 */
export function leanFrontMatterContractOfKind<const KindT extends LeanFrontMatterContract['kind'],>(
  kind: KindT,
): Extract<LeanFrontMatterContract, { readonly kind: KindT }> {
  /**
   * Every contract carrying requested semantic kind.
   */
  const found = LEAN_FRONT_MATTER_CONTRACTS.filter(function same(
    value,
  ): value is Extract<LeanFrontMatterContract, { readonly kind: KindT }> {
    return value.kind === kind;
  },);
  /**
   * Unique contract when canonical table is valid.
   */
  const [contract,] = found;
  if ((found.length !== 1) || (contract === undefined))
    throw new Error('lean realization front matter kind contract differs');
  return contract;
}
