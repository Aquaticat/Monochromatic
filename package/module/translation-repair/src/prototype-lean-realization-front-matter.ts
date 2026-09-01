// PROTOTYPE ONLY: Candidate L path-owned front-matter compilation.

import { stringify as stringifyYaml, } from 'yaml';

import { splitFrontMatter, } from './front-matter.ts';
import {
  LEAN_FRONT_MATTER_CONTRACTS,
  leanFrontMatterContract,
  leanFrontMatterContractOfKind,
  type LeanFrontMatterContract,
} from './prototype-lean-realization-front-matter-contract.ts';
import type { ReviewUnitPlan, } from './prototype-review-unit-plan.ts';
import type { SlotDocumentResponse, } from './prototype-slot-model.ts';

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
 * One immutable source-to-candidate alias position.
 */
type AliasMemberPair = {
  readonly sourceMember: string;
  readonly targetMember: string;
};

/**
 * Canonicalizes and verifies ordered alias grammar.
 *
 * @returns Candidate alias members joined by runtime delimiter
 */
function canonicalAlias({
  source,
  target,
  grammar,
}: {
  readonly source: string;
  readonly target: string;
  readonly grammar: Extract<LeanFrontMatterContract, { readonly kind: 'alias' }>['grammar'];
}): string {
  /**
   * Source members defining count, order, and protected tokens.
   */
  const sourceMembers = source.split(grammar.sourceDelimiter,)
    .map(function trim(value,) { return value.trim(); });
  /**
   * Candidate members normalized without changing order.
   */
  const targetMembers = target.split(grammar.sourceDelimiter,)
    .map(function trim(value,) { return value.trim(); });
  if (((grammar.memberCount === 'source-exact')
    && (sourceMembers.length !== targetMembers.length))
    || targetMembers.some(function empty(value,) { return value === ''; }))
    throw new Error('lean realization alias member count or value differs');
  /**
   * Positional source-to-candidate pairs executing member-order policy.
   */
  const positionalMembers = grammar.memberOrder === 'source-exact'
    ? sourceMembers.map(function pair(
      sourceMember,
      index,
    ): AliasMemberPair {
      /**
       * Candidate member proven present by exact cardinality.
       */
      const targetMember = targetMembers[index];
      if (targetMember === undefined)
        throw new Error('lean realization positional alias member is absent');
      return {
        sourceMember,
        targetMember,
      };
    },)
    : [];
  if ((grammar.protectedCasedMember === 'exact-at-position')
    && positionalMembers.some(function protectedMember(pair,) {
      return hasCasedIdentityLetter(pair.sourceMember,)
        && (pair.targetMember !== pair.sourceMember);
    },))
    throw new Error('lean realization protected alias member differs');
  return positionalMembers.map(function candidateMember(pair,) {
    return pair.targetMember;
  },)
    .join(grammar.targetDelimiter,);
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
    /**
     * Manifest-bound path contract for current scalar.
     */
    const contract = leanFrontMatterContract({ path: subject.path, });
    if ((raw === undefined)
      || (contract.grammar
        .nonempty
        && (raw.trim() === ''))
      || (contract.grammar
        .singleLine
        && (raw.includes('\n') || raw.includes('\r'))))
      throw new Error(`lean realization front matter ${subject.targetSlotKey} differs`);
    /**
     * Source scalar controlling path-specific grammar.
     */
    const source = stringAt({
      root: sourceData,
      path: subject.path,
    });
    /**
     * Runtime-normalized candidate scalar.
     */
    const value = contract.kind === 'alias'
      ? canonicalAlias({
        source,
        target: raw,
        grammar: contract.grammar,
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
   * Canonical name policy.
   */
  const nameContract = leanFrontMatterContractOfKind('name',);
  /**
   * Canonical alias policy.
   */
  const aliasContract = leanFrontMatterContractOfKind('alias',);
  /**
   * Candidate display identity.
   */
  const name = stringAt({
    root: candidateData,
    path: nameContract.path,
  });
  /**
   * Ordered normalized candidate aliases.
   */
  const aliases = stringAt({
    root: candidateData,
    path: aliasContract.path,
  })
    .split(aliasContract.grammar
      .targetDelimiter,);
  if (nameContract.grammar
    .equalsAliasMember
    && (!aliases.includes(name,)))
    throw new Error('lean realization name is absent from aliases');
  return {
    frontMatter: `---\n${stringifyYaml(
      candidateData,
      { indent: 4, }
    )}---\n\n`,
    slots,
  };
}
