// PROTOTYPE ONLY: Candidate L path-owned front-matter compilation.

import { stringify as stringifyYaml, } from 'yaml';

import { hashContent, } from './document-node.ts';
import { splitFrontMatter, } from './front-matter.ts';
import type { ReviewUnitPlan, } from './prototype-review-unit-plan.ts';
import type { SlotDocumentResponse, } from './prototype-slot-model.ts';

/**
 * Candidate L front-matter semantic authority.
 */
export type LeanFrontMatterAuthority = 'description' | 'identity' | 'location';

/**
 * One canonical path-specific authority and grammar contract.
 */
export type LeanFrontMatterContract = {
  readonly path: readonly string[];
  readonly kind: 'alias' | 'description' | 'location' | 'name';
  readonly authority: LeanFrontMatterAuthority;
  readonly grammar: string;
};

/**
 * Canonical Candidate L path order, authority, and grammar policy.
 */
export const LEAN_FRONT_MATTER_CONTRACTS: readonly LeanFrontMatterContract[] = [
  {
    path: ['name',],
    kind: 'name',
    authority: 'identity',
    grammar: 'single-line-nonempty-and-equal-to-candidate-alias-member',
  },
  {
    path: [
      'info',
      'alias',
    ],
    kind: 'alias',
    authority: 'identity',
    grammar: 'source-member-count-and-order-cased-members-exact-canonical-comma-space',
  },
  {
    path: [
      'info',
      'location',
    ],
    kind: 'location',
    authority: 'location',
    grammar: 'single-line-nonempty',
  },
  {
    path: ['desc',],
    kind: 'description',
    authority: 'description',
    grammar: 'single-line-nonempty',
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
 * @returns Exact contract or throws
 */
function contractOfKind(
  kind: LeanFrontMatterContract['kind'],
): LeanFrontMatterContract {
  /**
   * Every contract carrying requested semantic kind.
   */
  const found = LEAN_FRONT_MATTER_CONTRACTS.filter(function same(value,) {
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

/**
 * Parsed immutable YAML object.
 */
type FrontMatterRecord = Readonly<Record<string, unknown>>;

/**
 * Refuses a value outside YAML object boundary.
 *
 * @param value - Parsed YAML value
 *
 * @returns Nothing after successful narrowing
 */
function assertRecord(value: unknown,): asserts value is FrontMatterRecord {
  if (((typeof value) !== 'object') || (value === null)
    || Array.isArray(value,))
    throw new Error('lean realization front matter record differs');
}

/**
 * Narrows one parsed YAML object.
 *
 * @param value - Parsed YAML value
 *
 * @returns Immutable object value
 */
function recordValue(value: unknown,): FrontMatterRecord {
  assertRecord(value,);
  return value;
}

/**
 * Reads one nested source scalar.
 *
 * @returns Exact string at path
 */
function stringAt({
  root,
  path,
}: {
  readonly root: FrontMatterRecord;
  readonly path: readonly string[];
}): string {
  /**
   * Parent object containing scalar.
   */
  const parent = path.slice(
    0,
    -1,
  )
    .reduce<FrontMatterRecord>(
    function descend(
      current: FrontMatterRecord,
      key,
    ) {
      return recordValue(current[key],);
    },
    root,
  );
  /**
   * Final scalar key.
   */
  const key = path.at(-1,);
  /**
   * Untrusted scalar value.
   */
  const value = key === undefined ? undefined : parent[key];
  if ((typeof value) !== 'string')
    throw new Error('lean realization front matter scalar differs');
  return value;
}

/**
 * Returns immutable object with one nested scalar replaced.
 *
 * @returns Fresh object retaining all other YAML values
 */
function withString({
  root,
  path,
  value,
}: {
  readonly root: FrontMatterRecord;
  readonly path: readonly string[];
  readonly value: string;
}): FrontMatterRecord {
  /**
   * Current path head.
   */
  const [key,] = path;
  if (key === undefined)
    throw new Error('lean realization front matter write path is empty');
  if (path.length === 1) {
    if ((typeof root[key]) !== 'string')
      throw new Error('lean realization front matter write scalar differs');
    return {
      ...root,
      [key]: value,
    };
  }
  return {
    ...root,
    [key]: withString({
      root: recordValue(root[key],),
      path: path.slice(1,),
      value,
    }),
  };
}

/**
 * Whether text contains one cased identity letter.
 *
 * @param text - Alias member
 *
 * @returns Whether member carries protected Latin identity
 */
function hasCasedIdentityLetter(text: string,): boolean {
  return text.toLocaleLowerCase('en-US',) !== text.toLocaleUpperCase('en-US',);
}

/**
 * Canonicalizes and verifies ordered alias grammar.
 *
 * @returns Candidate alias members joined by runtime delimiter
 */
function canonicalAlias({
  source,
  target,
}: {
  readonly source: string;
  readonly target: string;
}): string {
  /**
   * Source members defining count, order, and protected tokens.
   */
  const sourceMembers = source.split(',')
    .map(function trim(value,) { return value.trim(); });
  /**
   * Candidate members normalized without changing order.
   */
  const targetMembers = target.split(',')
    .map(function trim(value,) { return value.trim(); });
  if ((sourceMembers.length !== targetMembers.length)
    || targetMembers.some(function empty(value,) { return value === ''; })
    || sourceMembers.some(function protectedMember(
      value,
      index,
    ) {
      return hasCasedIdentityLetter(value,) && (targetMembers[index] !== value);
    },))
    throw new Error('lean realization alias grammar differs');
  return targetMembers.join(', ',);
}

/**
 * Compiles exact candidate front matter from four model values.
 *
 * @returns Runtime YAML and normalized synthetic target slots
 *
 * @example
 * ```ts
 * const compiled = compileLeanFrontMatter({ sourceText, response, reviewPlan, });
 * ```
 */
export function compileLeanFrontMatter({
  sourceText,
  response,
  reviewPlan,
}: {
  readonly sourceText: string;
  readonly response: SlotDocumentResponse;
  readonly reviewPlan: ReviewUnitPlan;
}): {
  readonly frontMatter: string;
  readonly slots: Readonly<Record<string, string>>;
} {
  /**
   * Canonical source paths represented by review subjects.
   */
  const paths = reviewPlan.frontMatterSubjects
    .map(function path(subject,) { return subject.path; });
  /**
   * Manifest-bound paths derived from canonical authority table.
   */
  const expectedPaths = LEAN_FRONT_MATTER_CONTRACTS.map(function path(contract,) {
    return contract.path;
  },);
  if (JSON.stringify(paths,) !== JSON.stringify(expectedPaths,))
    throw new Error('lean realization front matter path set differs');
  /**
   * Parsed source-authority front matter.
   */
  const sourceData = recordValue(splitFrontMatter({ text: sourceText, })
    .frontMatter
    ?.data,);
  /**
   * Normalized candidate values by synthetic target slot.
   */
  const slots = Object.fromEntries(reviewPlan.frontMatterSubjects
    .map(function compile(subject,) {
    /**
     * Raw model value for current path.
     */
    const raw = response.slots[subject.targetSlotKey];
    if ((raw === undefined) || (raw.trim() === '')
      || raw.includes('\n')
      || raw.includes('\r'))
      throw new Error(`lean realization front matter ${subject.targetSlotKey} differs`);
    /**
     * Source scalar controlling path-specific grammar.
     */
    const source = stringAt({
      root: sourceData,
      path: subject.path,
    });
    /**
     * Manifest-bound path contract for current scalar.
     */
    const contract = leanFrontMatterContract({ path: subject.path, });
    /**
     * Runtime-normalized candidate scalar.
     */
    const value = contract.kind === 'alias'
      ? canonicalAlias({
        source,
        target: raw,
      })
      : raw.trim();
    return [
      subject.targetSlotKey,
      value,
    ];
  },),);
  /**
   * Candidate YAML data after immutable path replacements.
   */
  const candidateData = reviewPlan.frontMatterSubjects
    .reduce<FrontMatterRecord>(
    function replace(
      current: FrontMatterRecord,
      subject,
    ) {
      /**
       * Normalized value for current subject.
       */
      const value = slots[subject.targetSlotKey];
      if (value === undefined)
        throw new Error('lean realization normalized front matter value is absent');
      return withString({
        root: current,
        path: subject.path,
        value,
      });
    },
    sourceData,
  );
  /**
   * Candidate display identity.
   */
  const name = stringAt({
    root: candidateData,
    path: contractOfKind('name',)
      .path,
  });
  /**
   * Ordered normalized candidate aliases.
   */
  const aliases = stringAt({
    root: candidateData,
    path: contractOfKind('alias',)
      .path,
  })
    .split(', ',);
  if (!aliases.includes(name,))
    throw new Error('lean realization name is absent from aliases');
  return {
    frontMatter: `---\n${stringifyYaml(
      candidateData,
      { indent: 4, }
    )}---\n\n`,
    slots,
  };
}
