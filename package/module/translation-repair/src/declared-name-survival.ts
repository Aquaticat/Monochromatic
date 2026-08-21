import type { DeclaredIdentity, } from './identity-context.ts';

//region Declared name survival
// CHECKS THAT A NAME THE DOCUMENTS DECLARE SURVIVES AN EDIT, rather than asking
// a model to preserve it.
//
// WHY A GUARD AND NOT A PROMPT. Measured 2026-08-20 against the repair lane's
// own editor-judge sheet and roster: shown two candidates differing only in a
// declared alias, SIX OF SIX judges chose the one that dropped it, every one
// reasoning that the alias "has no basis in the original". Adding a carve-out
// to the criterion moved the reasoning, and judges said in as many words that
// the alias was declared and therefore not an addition, and the vote still did
// not flip: the shorter text simply reads better and naturalness is also on the
// sheet. A stage that loses a person's name six times out of six cannot be
// fixed by explaining the rule to it again.
//
// The translate lane's judges do the same thing at three of six, which
// `doc/audit/glm-4-7-flash-across-every-stage.md` recorded.
//
// CONSERVATIVE BY CONSTRUCTION. The rule is only ever "what was already there
// stays there": a name absent from the passage being edited is never required
// to appear in its replacement. So this can refuse a real loss and can never
// demand an insertion.
//
// COMPARED ON LETTERS AND DIGITS ALONE, because a handle is written several
// ways across one archive and every one of them is the same person. Measured
// over the pinned corpus, 212 declared forms against the English body of their
// own entry: a raw substring comparison finds 111 and MISSES 12 that are
// plainly there, while the projection finds all 123 and loses none of the 111.
// The dozen divide into three shapes, none of them exotic:
//
//   - the archive escapes Markdown, writing `\_` where the declaration writes
//     `_`, which no comparison over raw text can see through;
//   - the two sides disagree about a separator, one writing a space where the
//     other writes an underscore or nothing at all;
//   - the declaration spaces a handle the body runs together, or the reverse.
//
// A LINE BREAK IS THE SAME CASE and is why this is not merely a whitespace
// fold. Our own wrapper writes a break as a newline plus the enclosing block's
// continuation prefix, so a name split inside a blockquote becomes `name` then
// `> rest`, and folding whitespace alone would still not find it. Nothing in
// the pinned corpus is wrapped that way today, measured at zero of 212, but the
// pipeline writes the archive the next pass reads.
//
// LOOSER IN THE SAFE DIRECTION. Widening what counts as "carried" both puts
// more forms at stake and accepts more renderings of them, so it can only turn
// a missed loss into a caught one or a spurious refusal into an acceptance.
// Refusals cannot become more common through a name the base never carried.

/**
 * Separator between alternate handles inside one declared field.
 *
 * Corpus front matter writes `alias` as a comma-joined list, so one field can
 * declare several handles and each is a name in its own right.
 */
const HANDLE_SEPARATOR = ',';

/**
 * Shortest form worth checking, counted in letters and digits.
 *
 * A one or two character handle collides with ordinary words often enough that
 * its survival cannot be told from an accident, and this guard is only useful
 * while its answer means something.
 *
 * COUNTED ON THE PROJECTION rather than the declaration, since the projection
 * is what collides. `a_b` reads as three characters and compares as two. No
 * form in the pinned corpus falls between the two readings, so this is the
 * right threshold in the right place rather than a change of policy.
 */
const SHORTEST_CHECKABLE_FORM = 3;

/**
 * Whether one character belongs to a name rather than to the punctuation,
 * spacing or markup written around it.
 *
 * @param character - single character
 *
 * @returns Whether it is a letter or a digit in any script
 *
 * @example
 * ```ts
 * const kept = isNameCharacter({ character: '猫', },);
 * ```
 */
function isNameCharacter({ character, }: { readonly character: string; },): boolean {
  // oxlint-disable-next-line no-restricted-syntax/no-regex -- Unicode letter and number classes have no string-API equivalent and the corpus writes Han, Latin and digits inside one handle; input is ONE character and the pattern carries no quantifier or alternation, so it cannot backtrack.
  return /[\p{L}\p{N}]/u.test(character,);
}

/**
 * Text reduced to the characters a name is made of, lowercased.
 *
 * @param text - any text
 *
 * @returns Letters and digits only, in order
 *
 * @example
 * ```ts
 * const key = nameProjection({ text: 'Mittens\_the\_Cat', },);
 * ```
 */
function nameProjection({ text, }: { readonly text: string; },): string {
  /**
   * Same text composed and folded, so one spelling of a diacritic cannot
   * project differently from another.
   *
   * COMPOSED BEFORE ANYTHING ELSE, because a combining mark is neither a letter
   * nor a digit and would be dropped where a precomposed one is kept: `Mikä`
   * written the two ways would otherwise yield two different keys and the guard
   * would report a name lost that is sitting right there.
   */
  const composed = text
    .toLowerCase()
    .normalize('NFC',);

  /**
   * Characters kept, in order.
   *
   * SCANNED BY CODE UNIT rather than by grapheme. A surrogate half is neither a
   * letter nor a digit, so an emoji inside a handle drops out of the key; it
   * drops out of both sides identically, which is all this comparison needs.
   */
  const kept: string[] = [];
  for (let at = 0; at < composed.length; at += 1) {
    /**
     * Character under the cursor.
     */
    const character = composed.charAt(at,);
    if (isNameCharacter({ character, },))
      kept.push(character,);
  }
  return kept.join('',);
}

/**
 * Every name form one side declares, as separate strings.
 *
 * @param identity - one side's declared identity
 *
 * @returns Declared forms, deduplicated, longest first
 *
 * @example
 * ```ts
 * const forms = declaredNameForms({ identity: { name: 'Mittens', alias: 'Blossom, Patch', }, },);
 * ```
 */
export function declaredNameForms(
  { identity, }: { readonly identity: DeclaredIdentity; },
): readonly string[] {
  /**
   * Declared fields that can carry a name, in declaration order.
   *
   * LOCATION IS DELIBERATELY ABSENT. A place is not a name for this purpose,
   * and a translation may legitimately render or omit one.
   */
  const fields = [
    identity.name,
    identity.alias,
  ];

  /**
   * Forms seen, so a name repeated across fields is checked once.
   */
  const seen = new Set<string>();
  for (const field of fields) {
    if (field === undefined)
      continue;
    for (const raw of field.split(HANDLE_SEPARATOR,)) {
      /**
       * One handle without surrounding space.
       */
      const form = raw.trim();

      /**
       * Same handle as this guard will compare it.
       */
      const key = nameProjection({ text: form, },);
      if (key.length < SHORTEST_CHECKABLE_FORM)
        continue;
      seen.add(form,);
    }
  }

  // LONGEST FIRST, so a finding names the fullest form that was lost rather
  // than a fragment of it that happens to sort earlier.
  return [ ...seen, ].toSorted(function byLengthDescending(
    left,
    right,
  ): number {
    return right.length - left.length;
  },);
}

/**
 * One declared form paired with the key it is compared under.
 *
 * BOTH ARE CARRIED because they answer to different readers: the key decides
 * survival, and the form as declared is what a finding must name, since an
 * operator reading `mittensthecat` cannot look it up anywhere.
 *
 * @example
 * ```ts
 * const keyed: KeyedForm = { form: 'Mittens the Cat', key: 'mittensthecat', };
 * ```
 */
type KeyedForm = {
  /**
   * Form exactly as the front matter declares it.
   */
  readonly form: string;

  /**
   * Same form projected onto letters and digits.
   */
  readonly key: string;
};

/**
 * Declared names the base text carried and the candidate does not.
 *
 * @param forms - declared name forms to check
 *
 * @param baseText - text being replaced, which sets what must survive
 *
 * @param candidateText - proposed replacement
 *
 * @returns Forms present in base and absent from candidate, longest first
 *
 * @example
 * ```ts
 * const dropped = findDroppedDeclaredNames({ forms, baseText, candidateText, },);
 * ```
 */
export function findDroppedDeclaredNames(
  {
    forms,
    baseText,
    candidateText,
  }: {
    readonly forms: readonly string[];
    readonly baseText: string;
    readonly candidateText: string;
  },
): readonly string[] {
  /**
   * Text being replaced, projected once rather than once per form.
   */
  const base = nameProjection({ text: baseText, },);

  /**
   * Proposed replacement, projected the same way.
   */
  const candidate = nameProjection({ text: candidateText, },);

  /**
   * Every form beside the key it is compared under.
   */
  const keyed: readonly KeyedForm[] = forms.map(function toKeyed(form,): KeyedForm {
    return {
      form,
      key: nameProjection({ text: form, },),
    };
  },);

  /**
   * Forms the base text actually carried, which are the only ones at stake.
   */
  const atStake = keyed.filter(function wasThere({ key, },): boolean {
    return base.includes(key,);
  },);

  /**
   * Forms at stake that the candidate no longer carries.
   */
  const dropped = atStake.filter(function isGone({ key, },): boolean {
    return !candidate.includes(key,);
  },);

  // A LONGER FORM CONTAINING A SHORTER LOST ONE REPORTS ONCE. Losing
  // `Zha Ke (Lilith)` should not read as two separate losses when the shorter
  // form only ever appeared inside the longer.
  return dropped
    .filter(function isNotInsideAnother({ key: lostKey, },): boolean {
      return !dropped.some(function contains({ key: otherKey, },): boolean {
        return (otherKey !== lostKey)
          && (otherKey.length > lostKey.length)
          && otherKey.includes(lostKey,);
      },);
    },)
    .map(function toForm({ form, },): string {
      return form;
    },);
}

/**
 * Renders a declared-name refusal as a finding.
 *
 * @param chunkIndex - slice the refusal names
 *
 * @param dropped - declared forms the replacement no longer carries
 *
 * @returns Finding in scorecard-stable wording
 *
 * @example
 * ```ts
 * const finding = declaredNameRefusalFinding({ chunkIndex: 3, dropped: [ 'Blossom', ], },);
 * ```
 */
export function declaredNameRefusalFinding(
  {
    chunkIndex,
    dropped,
  }: {
    readonly chunkIndex: number;
    readonly dropped: readonly string[];
  },
): string {
  /**
   * Lost forms quoted, so a finding cannot be misread as prose.
   */
  const quoted = dropped.map(function quote(form,): string {
    return JSON.stringify(form,);
  },);
  return `translate-refused-declared-name (slice ${String(chunkIndex,)}: archive text carries ${
    quoted.join(', ',)
  } and the replacement does not; keeping the archive text)`;
}

/**
 * Everything one refusal contributes to a settled slice.
 *
 * GATHERED IN ONE PLACE because a refusal has to show up in three: the record
 * field a reader queries, the finding a scorecard counts, and the log an
 * operator watches. Spelled out at each call site, the three drift apart, and a
 * refusal missing from any one of them is a refusal nobody can audit.
 *
 * @example
 * ```ts
 * const report = declaredNameRefusalReport({ chunkIndex: 3, dropped, },);
 * ```
 */
export type DeclaredNameRefusalReport = {
  /**
   * Fragment to spread into the settled record, empty when nothing was
   * refused.
   */
  readonly record: { readonly droppedDeclaredNames?: readonly string[]; };

  /**
   * Findings to append, empty when nothing was refused.
   */
  readonly findings: readonly string[];
};

/**
 * Gathers what a refusal owes the record, the findings and the log.
 *
 * @param chunkIndex - slice the refusal names
 *
 * @param dropped - declared forms the replacement no longer carries, empty when
 * it dropped none
 *
 * @returns Record fragment and findings, both empty when nothing was refused
 *
 * @example
 * ```ts
 * const { record, findings, } = declaredNameRefusalReport({ chunkIndex, dropped, },);
 * ```
 */
export function declaredNameRefusalReport(
  {
    chunkIndex,
    dropped,
  }: {
    readonly chunkIndex: number;
    readonly dropped: readonly string[];
  },
): DeclaredNameRefusalReport {
  if (dropped.length === 0) {
    return {
      record: {},
      findings: [],
    };
  }
  return {
    record: { droppedDeclaredNames: dropped, },
    findings: [
      declaredNameRefusalFinding({
        chunkIndex,
        dropped,
      },),
    ],
  };
}

//endregion Declared name survival
