import type { DeclaredIdentity, } from './identity-context.ts';
import {
  carriesName,
  nameProjection,
  type NameProjection,
  projectName,
} from './name-projection.ts';

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
// CARRIED AS A NAME, NOT AS LETTERS (ledger B23). This used to say that
// widening what counts as carried could only turn a missed loss into a caught
// one or a spurious refusal into an acceptance. It was wrong both ways: the
// projection drops the spaces between words as well as the marks inside a
// handle, so containment found `ann` inside `cannot`. A candidate that lost
// `Ann` but said `cannot` kept the name, and a base that said only `cannot`
// put an `Ann` it never held at stake. A key now counts only where each Latin
// end meets a word edge (`name-projection.ts`), a letter meeting a digit and
// a small letter meeting a capital being edges, since that is how a handle
// joins a name. Measured on 2026-09-29 over every declared and contributor
// form against the texts of its own entry: all 285 carriages in the 92
// archives and all 544 on the 214 settled pages stand as names, and 1,422 of
// 47,389 in the stored artifacts existed only across a word edge.

/**
 Separator between alternate handles inside one declared field.
 
 Corpus front matter writes `alias` as a comma-joined list, so one field can
 declare several handles and each is a name in its own right.
 */
const HANDLE_SEPARATOR = ',';

/**
 Shortest form worth checking, counted in letters and digits.
 
 A one or two character handle collides with ordinary words often enough that
 its survival cannot be told from an accident, and this guard is only useful
 while its answer means something.
 
 COUNTED ON THE PROJECTION rather than the declaration, since the projection
 is what collides. `a_b` reads as three characters and compares as two. No
 form in the pinned corpus falls between the two readings, so this is the
 right threshold in the right place rather than a change of policy.
 */
const SHORTEST_CHECKABLE_FORM = 3;

/**
 Every name form one side declares, as separate strings.
 
 @param identity - one side's declared identity
 
 @returns Declared forms, deduplicated, longest first
 
 @example
 ```ts
 const forms = declaredNameForms({ identity: { name: 'Mittens', alias: 'Blossom, Patch', }, },);
 ```
 */
export function declaredNameForms(
  { identity, }: { readonly identity: DeclaredIdentity; },
): readonly string[] {
  /**
   Declared fields that can carry a name, in declaration order.
   
   LOCATION IS DELIBERATELY ABSENT. A place is not a name for this purpose,
   and a translation may legitimately render or omit one.
   */
  const fields = [
    identity.name,
    identity.alias,
  ];

  /**
   Forms seen, so a name repeated across fields is checked once.
   */
  const seen = new Set<string>();
  for (const field of fields) {
    if (field === undefined)
      continue;
    for (const raw of field.split(HANDLE_SEPARATOR,)) {
      /**
       One handle without surrounding space.
       */
      const form = raw.trim();

      /**
       Same handle as this guard will compare it.
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
 One declared form paired with the key it is compared under.
 
 BOTH ARE CARRIED because they answer to different readers: the key decides
 survival, and the form as declared is what a finding must name, since an
 operator reading `mittensthecat` cannot look it up anywhere.
 
 @example
 ```ts
 const keyed: KeyedForm = { form: 'Mittens the Cat', key: 'mittensthecat', };
 ```
 */
type KeyedForm = {
  /**
   Form exactly as the front matter declares it.
   */
  readonly form: string;

  /**
   Same form projected onto letters and digits.
   */
  readonly key: string;

  /**
   Form's own projection, read when one lost form is looked for inside
   another.
   */
  readonly projection: NameProjection;
};

/**
 Declared names the base text carried and the candidate does not.
 
 @param forms - declared name forms to check
 
 @param baseText - text being replaced, which sets what must survive
 
 @param candidateText - proposed replacement
 
 @returns Forms present in base and absent from candidate, longest first
 
 @example
 ```ts
 const dropped = findDroppedDeclaredNames({ forms, baseText, candidateText, },);
 ```
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
   Text being replaced, projected once rather than once per form.
   */
  const base = projectName({ text: baseText, },);

  /**
   Proposed replacement, projected the same way.
   */
  const candidate = projectName({ text: candidateText, },);

  /**
   Every form beside the key it is compared under.
   */
  const keyed: readonly KeyedForm[] = forms.map(function toKeyed(form,): KeyedForm {
    /**
     Form's own projection.
     */
    const projection = projectName({ text: form, },);
    return {
      form,
      key: projection.key,
      projection,
    };
  },);

  /**
   Forms the base text actually carried as names, which are the only ones at
   stake.
   */
  const atStake = keyed.filter(function wasThere({ key, },): boolean {
    return carriesName({
      projection: base,
      key,
    },);
  },);

  /**
   Forms at stake that the candidate no longer carries as names.
   */
  const dropped = atStake.filter(function isGone({ key, },): boolean {
    return !carriesName({
      projection: candidate,
      key,
    },);
  },);

  // A LONGER FORM CARRYING A SHORTER LOST ONE REPORTS ONCE. Losing
  // `Zha Ke (Lilith)` should not read as two separate losses when the shorter
  // form only ever appeared inside the longer. Carried as a name, as above:
  // `Ann` running on inside `Annabel` is its own loss (ledger B23).
  return dropped
    .filter(function isNotInsideAnother({ key: lostKey, },): boolean {
      return !dropped.some(function contains(
        {
          key: otherKey,
          projection: other,
        },
      ): boolean {
        return (otherKey !== lostKey)
          && (otherKey.length > lostKey.length)
          && carriesName({
            projection: other,
            key: lostKey,
          },);
      },);
    },)
    .map(function toForm({ form, },): string {
      return form;
    },);
}

/**
 Renders a declared-name refusal as a finding.
 
 @param sliceIndex - slice the refusal names
 
 @param dropped - declared forms the replacement no longer carries
 
 @returns Finding in scorecard-stable wording
 
 @example
 ```ts
 const finding = declaredNameRefusalFinding({ sliceIndex: 3, dropped: [ 'Blossom', ], },);
 ```
 */
export function declaredNameRefusalFinding(
  {
    sliceIndex,
    dropped,
  }: {
    readonly sliceIndex: number;
    readonly dropped: readonly string[];
  },
): string {
  /**
   Lost forms quoted, so a finding cannot be misread as prose.
   */
  const quoted = dropped.map(function quote(form,): string {
    return JSON.stringify(form,);
  },);
  return `translate-refused-declared-name (slice ${String(sliceIndex,)}: archive text carries ${
    quoted.join(', ',)
  } and the replacement does not; keeping the archive text)`;
}

/**
 Everything one refusal contributes to a settled slice.
 
 GATHERED IN ONE PLACE because a refusal has to show up in three: the record
 field a reader queries, the finding a scorecard counts, and the log an
 operator watches. Spelled out at each call site, the three drift apart, and a
 refusal missing from any one of them is a refusal nobody can audit.
 
 @example
 ```ts
 const report = declaredNameRefusalReport({ sliceIndex: 3, dropped, },);
 ```
 
 @internal
 */
export type DeclaredNameRefusalReport = {
  /**
   Fragment to spread into the settled record.
   
   ALWAYS NAMES THE FIELD, empty array when nothing was refused, because the
   repair outcome requires it: a reader of a settled slice should never have
   to tell "dropped nothing" from "nobody wrote the field".
   */
  readonly record: { readonly droppedDeclaredNames: readonly string[]; };

  /**
   Findings to append, empty when nothing was refused.
   */
  readonly findings: readonly string[];
};

/**
 Gathers what a refusal owes the record, the findings and the log.
 
 @param sliceIndex - slice the refusal names
 
 @param dropped - declared forms the replacement no longer carries, empty when
 it dropped none
 
 @returns Record fragment and findings, both empty when nothing was refused
 
 @example
 ```ts
 const { record, findings, } = declaredNameRefusalReport({ sliceIndex, dropped, },);
 ```
 
 @internal
 */
export function declaredNameRefusalReport(
  {
    sliceIndex,
    dropped,
  }: {
    readonly sliceIndex: number;
    readonly dropped: readonly string[];
  },
): DeclaredNameRefusalReport {
  if (dropped.length === 0) {
    return {
      record: { droppedDeclaredNames: [], },
      findings: [],
    };
  }
  return {
    record: { droppedDeclaredNames: dropped, },
    findings: [
      declaredNameRefusalFinding({
        sliceIndex,
        dropped,
      },),
    ],
  };
}

//endregion Declared name survival
