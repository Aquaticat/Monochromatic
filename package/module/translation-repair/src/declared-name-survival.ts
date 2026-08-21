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

/**
 * Separator between alternate handles inside one declared field.
 *
 * Corpus front matter writes `alias` as a comma-joined list, so one field can
 * declare several handles and each is a name in its own right.
 */
const HANDLE_SEPARATOR = ',';

/**
 * Shortest form worth checking.
 *
 * A one or two character handle collides with ordinary words often enough that
 * its survival cannot be told from an accident, and this guard is only useful
 * while its answer means something.
 */
const SHORTEST_CHECKABLE_FORM = 3;

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
      if (form.length < SHORTEST_CHECKABLE_FORM)
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
 * Whether one text carries one declared form.
 *
 * CASE-INSENSITIVE, because a candidate that lowercased a handle has changed
 * its spelling and not dropped the person from the sentence. Spelling is the
 * judges' business; this is only about loss.
 *
 * @param text - text to look in
 *
 * @param form - declared name form
 *
 * @returns Whether the form appears
 *
 * @example
 * ```ts
 * const present = carriesForm({ text: 'Mittens naps.', form: 'mittens', },);
 * ```
 */
function carriesForm(
  {
    text,
    form,
  }: {
    readonly text: string;
    readonly form: string;
  },
): boolean {
  return text
    .toLowerCase()
    .includes(form.toLowerCase(),);
}

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
   * Forms the base text actually carried, which are the only ones at stake.
   */
  const atStake = forms.filter(function wasThere(form,): boolean {
    return carriesForm({
      text: baseText,
      form,
    },);
  },);

  /**
   * Forms at stake that the candidate no longer carries.
   */
  const dropped = atStake.filter(function isGone(form,): boolean {
    return !carriesForm({
      text: candidateText,
      form,
    },);
  },);

  // A LONGER FORM CONTAINING A SHORTER LOST ONE REPORTS ONCE. Losing
  // `Zha Ke (Lilith)` should not read as two separate losses when the shorter
  // form only ever appeared inside the longer.
  return dropped.filter(function isNotInsideAnother(form,): boolean {
    return !dropped.some(function contains(other,): boolean {
      return (other !== form)
        && (other.length > form.length)
        && carriesForm({
          text: other,
          form,
        },);
    },);
  },);
}

//endregion Declared name survival
