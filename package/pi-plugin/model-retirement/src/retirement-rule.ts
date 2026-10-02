/**
 Retirement rule deciding which catalog entries a newer sibling supersedes.

 The rule abstains whenever id text cannot order two entries, because decision 4
 in `doc/planning/pi-model-retirement.md` removed every runtime override: a false
 positive is recoverable only by rebuilding the package, while a false negative
 costs one extra row in the picker.

 @module
 */

import {
  isDateShapedRaw,
  parseModelId,
  type ModelIdParse,
} from './id-tokens.ts';

//region Constants

/**
 Digit-length gap between two version components that marks them as belonging to
 different numbering schemes.

 A month-day pair such as `02-15` meets an 8-digit snapshot such as `20260420` in
 `qwen3.5-plus`, and comparing them numerically would order a date against a month.
 */
const INCOMMENSURABLE_DIGIT_GAP = 2;

//endregion Constants

//region Types

/**
 One catalog entry the rule can order.

 `api` is part of the identity because three ids in pi's bundled catalog are served
 under two APIs by the same provider, and an entry must never retire its own sibling
 route.
 */
export type CatalogEntry = {
  /**
   Provider id owning the entry.
   */
  readonly provider: string;
  /**
   API type the entry is served under.
   */
  readonly api: string;
  /**
   Model id exactly as the catalog carries it.
   */
  readonly modelId: string;
};

/**
 One retirement the rule decided.
 */
export type Retirement = {
  /**
   Provider id owning both entries.
   */
  readonly provider: string;
  /**
   API type both entries are served under.
   */
  readonly api: string;
  /**
   Id the picker stops offering.
   */
  readonly retiredId: string;
  /**
   Id that supersedes it.
   */
  readonly keeperId: string;
};

/**
 Why the rule declined to retire entries it saw.
 */
export type AbstentionCounts = {
  /**
   Pairs where keeper selection inside a family could not order two candidates.
   */
  readonly keeperAmbiguity: number;
  /**
   Pairs whose version evidence the ordering rules leave unordered.
   */
  readonly unorderedPair: number;
  /**
   Pairs where the candidate loser orders newer than the chosen keeper.
   */
  readonly loserNewerThanKeeper: number;
  /**
   Entries carrying no version token, which are never retired.
   */
  readonly versionlessProtected: number;
  /**
   Entries repeating an identity already present in the same family.
   */
  readonly duplicateIdentity: number;
};

/**
 Outcome of one rule pass over a catalog.
 */
export type RetirementDecision = {
  /**
   Retirements in catalog order.
   */
  readonly retirements: readonly Retirement[];
  /**
   Declined retirements grouped by reason.
   */
  readonly abstentions: AbstentionCounts;
};

/**
 Recency comparison outcome between two parses.
 */
type Recency = 'left' | 'right' | undefined;

/**
 Mutable abstention tally accumulated during one pass.
 */
type AbstentionTally = {
  keeperAmbiguity: number;
  unorderedPair: number;
  loserNewerThanKeeper: number;
  versionlessProtected: number;
  duplicateIdentity: number;
};

//endregion Types

//region Ordering

/**
 Compare two version components for scheme compatibility.

 @param leftRaw - raw text of the left component, leading zeros intact

 @param rightRaw - raw text of the right component

 @returns whether the two components use numbering schemes far enough apart that
 ordering them would compare a date against a version

 @example
 ```typescript
 isCommensurable({ leftRaw: '2', rightRaw: '20260420' }); // false
 ```
 */
function isCommensurable(
  {
    leftRaw,
    rightRaw,
  }: {
    readonly leftRaw: string;
    readonly rightRaw: string;
  },
): boolean {
  /**
   Digit-count difference between the two raw components.
   */
  const gap = Math.abs(leftRaw.length - rightRaw.length);
  return gap < INCOMMENSURABLE_DIGIT_GAP;
}

/**
 Compare two date sequences of equal length.

 @param leftDates - raw date components of the left parse

 @param rightDates - raw date components of the right parse

 @returns which side is more recent, or `undefined` when every component matches

 @example
 ```typescript
 compareDateSequences({ leftDates: ['2407'], rightDates: ['2512'] }); // 'right'
 ```
 */
function compareDateSequences(
  {
    leftDates,
    rightDates,
  }: {
    readonly leftDates: readonly string[];
    readonly rightDates: readonly string[];
  },
): Recency {
  for (let index = 0; index < leftDates.length; index += 1) {
    /**
     Left component at the current position.
     */
    const left = Number.parseInt(leftDates[index] as string, 10,);
    /**
     Right component at the current position.
     */
    const right = Number.parseInt(rightDates[index] as string, 10,);
    if (left === right)
      continue;
    return left > right ? 'left' : 'right';
  }
  return undefined;
}

/**
 Decide which of two same-length version vectors carries the dates.

 @param left - parse of the left entry

 @param right - parse of the right entry

 @returns which side is more recent, or `undefined` when both carry the same dates

 @example
 ```typescript
 compareEqualLengthDates({ left: parseModelId('deepseek-v4-pro'), right: parseModelId('deepseek-v4-pro-0813') }); // 'left'
 ```
 */
function compareEqualLengthDates(
  {
    left,
    right,
  }: {
    readonly left: ModelIdParse;
    readonly right: ModelIdParse;
  },
): Recency {
  if (left.dateRaws.length === right.dateRaws.length
    && left.dateRaws.every(function matchesSameDate(raw, index) {
      return raw === right.dateRaws[index];
    },))
    return undefined;
  if (left.dateRaws.length === 0)
    return 'left';
  if (right.dateRaws.length === 0)
    return 'right';
  if (left.dateRaws.length !== right.dateRaws.length)
    return undefined;
  return compareDateSequences({
    leftDates: left.dateRaws,
    rightDates: right.dateRaws,
  },);
}

/**
 Decide a prefix case, where one version vector continues the other.

 Extra components that are all dates mark a pinned snapshot, which loses to the
 rolling alias. Extra components that are all versions mark a point release, which
 beats its own base version. A mix of the two leaves the pair unordered.

 @param shorter - parse carrying the prefix

 @param longer - parse continuing that prefix

 @returns which side is more recent, or `undefined` when the extras mix schemes

 @example
 ```typescript
 comparePrefix({ shorter: parseModelId('claude-opus-5'), longer: parseModelId('claude-opus-5-5') }); // 'longer'
 ```
 */
function comparePrefix(
  {
    shorter,
    longer,
  }: {
    readonly shorter: ModelIdParse;
    readonly longer: ModelIdParse;
  },
): 'shorter' | 'longer' | undefined {
  /**
   Raw components the longer parse carries past the shared prefix.
   */
  const extras = longer.versionRaws.slice(shorter.versionRaws.length,);
  /**
   Date classification of every extra component.
   */
  const shapes = extras.map(function classifyExtra(raw,) {
    return isDateShapedRaw(raw,);
  },);
  if (shapes.every(function everyExtraIsDate(shape,) {
    return shape;
  },))
    return 'shorter';
  if (shapes.every(function noExtraIsDate(shape,) {
    return !shape;
  },))
    return 'longer';
  return undefined;
}

/**
 Order two parses by recency.

 @param left - parse of the left entry

 @param right - parse of the right entry

 @returns `'left'` when the left entry is newer, `'right'` when the right entry is
 newer, and `undefined` when the id text cannot order them

 @example
 ```typescript
 compareRecency({ left: parseModelId('glm-5.2'), right: parseModelId('glm-5.3') }); // 'right'
 ```
 */
export function compareRecency(
  {
    left,
    right,
  }: {
    readonly left: ModelIdParse;
    readonly right: ModelIdParse;
  },
): Recency {
  if (left.nameShape !== right.nameShape)
    return undefined;
  if (left.versionParts.length === 0 || right.versionParts.length === 0)
    return undefined;
  /**
   Count of positions both vectors cover.
   */
  const shared = Math.min(left.versionParts.length, right.versionParts.length,);
  for (let index = 0; index < shared; index += 1) {
    /**
     Left component at the current position.
     */
    const leftPart = left.versionParts[index] as number;
    /**
     Right component at the current position.
     */
    const rightPart = right.versionParts[index] as number;
    if (leftPart === rightPart)
      continue;
    if (!isCommensurable({
      leftRaw: left.versionRaws[index] as string,
      rightRaw: right.versionRaws[index] as string,
    },))
      return undefined;
    return leftPart > rightPart ? 'left' : 'right';
  }
  if (left.versionParts.length === right.versionParts.length)
    return compareEqualLengthDates({ left, right, },);
  /**
   Prefix comparison result, expressed in caller terms.
   */
  const prefixOutcome = left.versionParts.length < right.versionParts.length
    ? comparePrefix({ shorter: left, longer: right, },)
    : comparePrefix({ shorter: right, longer: left, },);
  if (prefixOutcome === undefined)
    return undefined;
  /**
   Whether the newer side of the prefix comparison is the left parse.
   */
  const shorterIsLeft = left.versionParts.length < right.versionParts.length;
  if (prefixOutcome === 'shorter')
    return shorterIsLeft ? 'left' : 'right';
  return shorterIsLeft ? 'right' : 'left';
}

//endregion Ordering

//region Decision

/**
 Build the family key that groups entries the rule may compare.

 @param entry - catalog entry under consideration

 @param parse - age evidence extracted from that entry's id

 @returns key unique to one provider, one API, and one name shape

 @example
 ```typescript
 familyKey({ entry: { provider: 'hyper', api: 'openai-completions', modelId: 'glm-5.2' }, parse: parseModelId('glm-5.2') });
 ```
 */
function familyKey(
  {
    entry,
    parse,
  }: {
    readonly entry: CatalogEntry;
    readonly parse: ModelIdParse;
  },
): string {
  return JSON.stringify([entry.provider, entry.api, parse.nameShape],);
}

/**
 Choose the newest candidate inside one family.

 @param candidates - family members carrying version evidence, in catalog order

 @param tally - abstention tally to charge keeper ambiguity to

 @returns the keeper, or `undefined` when the family holds fewer than two candidates

 @example
 ```typescript
 chooseKeeper({ candidates: familyMembers, tally });
 ```
 */
function chooseKeeper(
  {
    candidates,
    tally,
  }: {
    readonly candidates: readonly { readonly entry: CatalogEntry; readonly parse: ModelIdParse; }[];
    readonly tally: AbstentionTally;
  },
): { readonly entry: CatalogEntry; readonly parse: ModelIdParse; } | undefined {
  if (candidates.length < 2)
    return undefined;
  /**
   Newest candidate seen so far.
   */
  let keeper = candidates[0] as { readonly entry: CatalogEntry; readonly parse: ModelIdParse; };
  for (let index = 1; index < candidates.length; index += 1) {
    /**
     Candidate being compared against the current keeper.
     */
    const candidate = candidates[index] as { readonly entry: CatalogEntry; readonly parse: ModelIdParse; };
    /**
     Recency comparison between keeper and candidate.
     */
    const outcome = compareRecency({ left: keeper.parse, right: candidate.parse, },);
    if (outcome === undefined) {
      tally.keeperAmbiguity += 1;
      continue;
    }
    if (outcome === 'right')
      keeper = candidate;
  }
  return keeper;
}

/**
 Decide every retirement in one catalog.

 @param entries - catalog entries in the order the registry reports them

 @returns retirements plus the abstention tally explaining what the rule declined

 @example
 ```typescript
 decideRetirements({ entries: [{ provider: 'hyper', api: 'openai-completions', modelId: 'glm-5.2' }] });
 ```
 */
export function decideRetirements(
  {
    entries,
  }: {
    readonly entries: readonly CatalogEntry[];
  },
): RetirementDecision {
  /**
   Family members grouped by provider, API, and name shape.
   */
  const families = new Map<string, { readonly entry: CatalogEntry; readonly parse: ModelIdParse; }[]>();
  /**
   Abstention tally for this pass.
   */
  const tally: AbstentionTally = {
    keeperAmbiguity: 0,
    unorderedPair: 0,
    loserNewerThanKeeper: 0,
    versionlessProtected: 0,
    duplicateIdentity: 0,
  };
  for (const entry of entries) {
    /**
     Age evidence for the current entry.
     */
    const parse = parseModelId(entry.modelId,);
    /**
     Family this entry belongs to.
     */
    const key = familyKey({ entry, parse, },);
    /**
     Members collected for that family so far.
     */
    const members = families.get(key,) ?? [];
    members.push({ entry, parse, },);
    families.set(key, members,);
  }
  /**
   Retirements in catalog order.
   */
  const retirements: Retirement[] = [];
  for (const members of families.values()) {
    /**
     Members carrying version evidence, the only ones eligible to keep or lose.
     */
    const candidates = members.filter(function hasVersionEvidence(member,) {
      return member.parse.versionParts.length > 0;
    },);
    /**
     Newest member of this family.
     */
    const keeper = chooseKeeper({ candidates, tally, },);
    if (keeper === undefined)
      continue;
    /**
     Identities already retired or kept in this family, so a repeated catalog row
     cannot retire itself.
     */
    const seen = new Set<string>([JSON.stringify([keeper.entry.api, keeper.entry.modelId],)],);
    for (const member of members) {
      /**
       Identity of the member under consideration.
       */
      const identity = JSON.stringify([member.entry.api, member.entry.modelId],);
      if (seen.has(identity,)) {
        if (member !== keeper)
          tally.duplicateIdentity += 1;
        continue;
      }
      seen.add(identity,);
      if (member.parse.versionParts.length === 0) {
        tally.versionlessProtected += 1;
        continue;
      }
      /**
       Recency comparison between the member and the family keeper.
       */
      const outcome = compareRecency({ left: member.parse, right: keeper.parse, },);
      if (outcome === 'left') {
        tally.loserNewerThanKeeper += 1;
        continue;
      }
      if (outcome === undefined) {
        tally.unorderedPair += 1;
        continue;
      }
      retirements.push({
        provider: member.entry.provider,
        api: member.entry.api,
        retiredId: member.entry.modelId,
        keeperId: keeper.entry.modelId,
      },);
    }
  }
  return { retirements, abstentions: { ...tally, }, };
}

//endregion Decision
