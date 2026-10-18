//region Consistency label form
// THE LABEL A JUDGE WROTE, READ AGAINST THE LABELS THE SHEET SHOWED (the lead's ruling of 2026-10-15 on the run of
// TianqiChen66625). Seven replies of that run named the option that won anyway and were refused for the way they wrote
// it: `Occurrence 3` and `Candidate 2` for `OCCURRENCE 3` and `CANDIDATE 2`, and a bare `3` or `2`. A name that stands
// for exactly one shown label is that label, whatever its case, whatever white space surrounds it or runs inside it, and
// whether it is the label or only the number the label ends in; a name that stands for none, or for two, is still
// refused, and so is the word of another sheet (a choice among candidates is shown places too, so `Occurrence 2` there
// would name a place, not a candidate). The label a reply is stored under is the shown one, in the sheet's own form.

/**
 Runs of white space, which a name may carry inside it or around it.
 */
const WHITESPACE_RUN = /\s+/gu;

/**
 Digits at the end of a label.
 */
const TRAILING_NUMBER = /\d+$/u;

/**
 A label or a name in the form labels are compared in: white space trimmed and collapsed to single spaces, upper case.

 @param text - label or name as written

 @returns The comparison form

 @example
 ```ts
 const form = comparisonFormOf({ text: ' Occurrence   3 ', },); // 'OCCURRENCE 3'
 ```
 */
function comparisonFormOf({ text, }: { readonly text: string; },): string {
  return text.trim()
    .replaceAll(
      WHITESPACE_RUN,
      ' ',
    )
    .toUpperCase();
}

/**
 The shown labels of one sheet, looked up by the form they are compared in and by the number they end in.
 */
type ShownIndex = {
  readonly byForm: ReadonlyMap<string, readonly string[]>;
  readonly byNumber: ReadonlyMap<string, readonly string[]>;
};

/**
 The index of each list of shown labels already read, so a ballot naming many places reads the list once, not once per name.
 */
const INDEXES = new WeakMap<readonly string[], ShownIndex>();

/**
 Appends a label to the list a key holds, in place, starting the list where the key has none.

 @param map - lookup being built
 @param key - comparison form or trailing number the label is found under
 @param label - shown label

 @example
 ```ts
 appendTo({ map: byNumber, key: '3', label: 'OCCURRENCE 3', },);
 ```
 */
function appendTo(
  {
    map,
    key,
    label,
  }: {
    readonly map: Map<string, string[]>;
    readonly key: string;
    readonly label: string;
  },
): void {
  const list = map.get(key,);
  if (list === undefined) {
    map.set(key, [label,],);
    return;
  }
  list.push(label,);
}

/**
 Reads a list of shown labels into the lookups by comparison form and by trailing number.

 @param shown - labels the sheet showed

 @returns The lookups, each label listed once under each key it has

 @example
 ```ts
 const { byNumber, } = shownIndexOf({ shown: ['OCCURRENCE 1', 'OCCURRENCE 2',], },); // byNumber.get('2') is ['OCCURRENCE 2']
 ```
 */
function shownIndexOf({ shown, }: { readonly shown: readonly string[]; },): ShownIndex {
  const known = INDEXES.get(shown,);
  if (known !== undefined)
    return known;
  /**
   Labels by comparison form, built once.
   */
  const byForm = new Map<string, string[]>();
  /**
   Labels by trailing number, built once.
   */
  const byNumber = new Map<string, string[]>();
  for (const label of new Set(shown,)) {
    appendTo({ map: byForm, key: comparisonFormOf({ text: label, },), label, },);
    const number = TRAILING_NUMBER.exec(label,)?.[0];
    if (number !== undefined)
      appendTo({ map: byNumber, key: number, label, },);
  }
  /**
   The index to keep.
   */
  const index: ShownIndex = { byForm, byNumber, };
  INDEXES.set(
    shown,
    index,
  );
  return index;
}

/**
 Finds the one shown label a name stands for.

 @param name - what the judge wrote as a label
 @param shown - labels the sheet showed, the only labels a reply may use

 @returns The shown label as a list of one, none when the name stands for no shown label or for more than one

 @example
 ```ts
 const [label,] = shownLabelOf({ name: ' occurrence 3 ', shown: ['OCCURRENCE 3', 'OCCURRENCE 4',], },); // 'OCCURRENCE 3'
 ```
 */
export function shownLabelOf(
  {
    name,
    shown,
  }: {
    readonly name: string;
    readonly shown: readonly string[];
  },
): readonly string[] {
  /**
   The name in the form labels are compared in.
   */
  const form = comparisonFormOf({ text: name, },);
  /**
   Whether the name is only a number.
   */
  const isNumber = /^\d+$/u.test(form,);
  /**
   The shown labels by comparison form and by trailing number, read from the list once however many names are looked up.
   */
  const index = shownIndexOf({ shown, },);
  /**
   Every distinct shown label the name stands for.
   */
  const standsFor = [
    ...new Set([...(index.byForm.get(form,) ?? []), ...(isNumber ? (index.byNumber.get(form,) ?? []) : []),],),
  ];
  return (standsFor.length === 1) ? standsFor : [];
}

//endregion Consistency label form
