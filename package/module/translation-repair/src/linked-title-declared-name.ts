import { extractDeclaredIdentity, } from './identity-context.ts';

//region Linked title declared name
// THE EIGHTY-SIXTH CLASS (yingying3, 2026-09-22). The page-name glossary
// (class seventy-one) offers a same-href link title as the archive renders
// it, under a heading that says to render the same person or title the same
// way everywhere. The blog title "永别了。我想你了，樱樱。" names the entry's
// person, whom the front matter declares "Yingying"; the archive's title
// reads "Farewell. I miss you, Sakura." Both lanes copied the archive's
// title as the glossary told them to, the slice was never contested, and the
// page named the person "Yingying" twice and "Sakura" once. yingying1 and 2
// had written "Yingying" into the title on their own. A title that names a
// declared person says so on its glossary line, naming the declared form the
// title takes; the archive's words settle the rest of the title.

/**
 One name the front matter declares on both sides: the source's Han form and
 the declared rendering.
 */
export type DeclaredNamePair = {
  /**
   Name as the source front matter writes it.
   */
  readonly source: string;

  /**
   Name as the target front matter declares it.
   */
  readonly rendering: string;
};

/**
 Full-width comma the corpus joins aliases with, folded to the ASCII one.
 */
const FULL_WIDTH_COMMA = '，';

/**
 Splits one declared field into its comma-joined forms, trimmed, empties out.

 @param value - declared field, empty when the page declares none

 @returns Forms in declared order
 */
function formsOf({ value, }: { readonly value: string; },): readonly string[] {
  return value.replaceAll(
    FULL_WIDTH_COMMA,
    ',',
  )
    .split(',',)
    .map(function trimmed(form,): string {
      return form.trim();
    },)
    .filter(function nonEmpty(form,): boolean {
      return form !== '';
    },);
}

/**
 Pairs the source's declared forms with the target's, field by field and
 position by position, where both sides declare the same count.

 A COUNT MISMATCH PAIRS NOTHING for that field, because a pairing by position
 across unequal lists would declare a correspondence nobody wrote.

 @param sourceData - source front matter data, unknown by type

 @param targetData - target front matter data, unknown by type

 @returns Pairs in declared order, name first, then aliases

 @example
 ```ts
 const declared = declaredNamePairs({ sourceData, targetData, },);
 ```
 */
export function declaredNamePairs(
  {
    sourceData,
    targetData,
  }: {
    readonly sourceData: unknown;
    readonly targetData: unknown;
  },
): readonly DeclaredNamePair[] {
  /**
   Source side's declaration.
   */
  const source = extractDeclaredIdentity({ data: sourceData, },);
  /**
   Target side's declaration.
   */
  const target = extractDeclaredIdentity({ data: targetData, },);
  /**
   Fields that name the person, each paired by position.
   */
  const fields: readonly (readonly [
    readonly string[],
    readonly string[],
  ])[] = [
    [
      formsOf({ value: source.name ?? '', },),
      formsOf({ value: target.name ?? '', },),
    ],
    [
      formsOf({ value: source.alias ?? '', },),
      formsOf({ value: target.alias ?? '', },),
    ],
  ];
  return fields.flatMap(function paired([sources, renderings,],): readonly DeclaredNamePair[] {
    if ((sources.length !== renderings.length) || (sources.length === 0))
      return [];
    return sources.map(function pair(
      sourceForm,
      index,
    ): DeclaredNamePair {
      return {
        source: sourceForm,
        rendering: renderings[index] ?? '',
      };
    },)
      .filter(function differs(pair,): boolean {
        return (pair.rendering !== '') && (pair.rendering !== pair.source);
      },);
  },);
}

/**
 Note appended to a linked title's glossary line when the title names a
 declared person and the archive's rendering does not carry the declared
 form: which name the title carries and which form it takes.

 EMPTY WHEN THE ARCHIVE ALREADY RENDERS THE DECLARED FORM inside the title,
 or when the title names nobody declared, because the line is then right as
 it stands and a note would tell the reader to change nothing.

 @param source - link text as the source writes it

 @param rendering - link text as the archive renders it

 @param declared - declared name pairs for this page

 @returns Note beginning with a semicolon, or an empty string

 @example
 ```ts
 const note = declaredNameNote({ source: '永别了，猫猫。', rendering: 'Farewell, Kitty.', declared, },);
 ```
 */
export function declaredNameNote(
  {
    source,
    rendering,
    declared,
  }: {
    readonly source: string;
    readonly rendering: string;
    readonly declared: readonly DeclaredNamePair[];
  },
): string {
  /**
   Declared names the title carries and the archive rendered otherwise.
   */
  const named = declared.filter(function carriedOtherwise(pair,): boolean {
    return source.includes(pair.source,) && (!rendering.includes(pair.rendering,));
  },);
  if (named.length === 0)
    return '';
  /**
   Each carried name with its declared form.
   */
  const spelled = named.map(function spell(pair,): string {
    return `${pair.source}, declared "${pair.rendering}"`;
  },)
    .join('; ',);
  return `; names ${spelled}: the declared form inside the title, the archive's words for the rest`;
}

//endregion Linked title declared name
