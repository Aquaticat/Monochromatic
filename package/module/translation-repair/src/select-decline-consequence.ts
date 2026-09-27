import type { IncumbentKind, } from './translate-absence.ts';

//region Selection decline consequence
// What a judge is told a decline does. The shared sheet says the caller keeps
// trusted text; a caller for whom that is false must say what is true, since a
// judge told something false about the cost of declining is asked for caution
// by a promise nobody can honour.

/**
 What a decline costs where the caller HAS something to fall back on.

 The ordinary case, and the reason declining is safe to encourage: the editor
 and refiner lanes keep the text they were given, and the translate lane keeps
 the archive's own wording. A caller with nothing to keep has to say so
 instead, since a judge told this while it is false is being asked for caution
 by a promise nobody can honour.

 @example
 ```ts
 const consequence = KEEPS_TRUSTED_TEXT;
 ```
 */
export const KEEPS_TRUSTED_TEXT: string = 'the caller keeps text it already trusts when you decline';

/**
 What a decline costs where the caller has NOTHING to fall back on.

 @example
 ```ts
 const consequence = LEAVES_PASSAGE_UNTRANSLATED;
 ```
 */
export const LEAVES_PASSAGE_UNTRANSLATED: string =
  'there is no existing translation of this passage, so declining every candidate leaves it untranslated '
  + 'rather than falling back on anything';

/**
 What a decline costs where the passage HAS wording that cannot ship: a
 standing the deterministic rule refused, or an archive rendering the floor
 refused or the adjudicators disputed. A slate declined in every round ships
 one candidate anyway (owner, 2026-09-27, "Preference + polish"), so a judge
 told the passage stays untranslated, or that trusted text is kept, would be
 told something false about what declining does.

 @example
 ```ts
 const consequence = SHIPS_BY_PREFERENCE;
 ```
 */
export const SHIPS_BY_PREFERENCE: string = [
  'the wording in place cannot ship, so declining does not keep it: a slate declined in every round still ships',
  'one candidate, chosen by a fixed order (the repair lane\'s text, then the translate lane\'s, then the first on',
  'the slate) rather than by your judgment, with your reason recorded against it',
].join(' ',);

/**
 What a translate slate's judges are told a decline does.

 @param incumbentKind - whether there is wording to keep

 @param withheldStanding - whether absent wording exists and cannot ship
 rather than never having existed

 @returns The consequence the sheet states

 @example
 ```ts
 const consequence = declineConsequenceFor({ incumbentKind: 'absent', withheldStanding: true, },);
 ```
 */
export function declineConsequenceFor(
  {
    incumbentKind,
    withheldStanding,
  }: {
    readonly incumbentKind: IncumbentKind;
    readonly withheldStanding: boolean;
  },
): string {
  if (incumbentKind === 'present')
    return KEEPS_TRUSTED_TEXT;
  return withheldStanding ? SHIPS_BY_PREFERENCE : LEAVES_PASSAGE_UNTRANSLATED;
}

//endregion Selection decline consequence
