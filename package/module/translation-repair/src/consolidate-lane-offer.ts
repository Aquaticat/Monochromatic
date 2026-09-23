import type { SliceSyntax, } from './chunk-document.ts';
import type { LaneText, } from './translate-candidates.ts';
import { validateTranslatedSlice, } from './translate-validate.ts';

//region Lane texts offered to the consolidation slate
// THE CONSOLIDATION IS THE RETRY OF A DECLINED CONTEST, and until class forty
// (Mio24 slice 17, 2026-09-17) the retry never saw the two texts the contest
// was about. There the contest settled `neither` with every ballot judging
// the archive flawed, the archive's one-line rendering stood, the
// deterministic rule withheld it (the original's poem carries a link the line
// does not), the writers' proposals flattened the poem's blockquote and its
// line breaks, three of five slate judges abstained over that, the two who
// voted tied, and the entry stopped; the repair and translate lane texts
// carried the blockquote, the line breaks and the link, passed the rule, and
// were on no slate.
//
// SO THE LANE TEXTS JOIN THE SLATE, as candidates the judges weigh beside the
// writers' proposals, exactly when the standing is not a text the contest
// endorsed and the rule admits: a declined contest, or a winning lane the
// rule refused. Each joins only when it passes the rule itself, since the
// floor would refuse it and a judge choosing it would choose nothing, and
// only when it is not the standing, which the slate already offers or the
// gate already withheld. A lane the contest endorsed as the eligible standing
// needs no second hearing, and the lane it beat gets none.

/**
 Lane texts a consolidation slate offers beside the writers' proposals.

 @param sourceText - the original passage, which the rule reads each lane
 text against

 @param incumbentText - the archive's rendering, which the rule reads as the
 page shape

 @param repairText - what the repair lane would ship

 @param translateText - what the translate lane would ship

 @param standingText - wording the settlement runs against, never offered
 again under a lane name

 @param standingMayShip - whether the contest endorsed the standing

 @param standingEligible - whether the standing passed the deterministic rule

 @param syntax - syntax role of the slice, when it has one

 @param lineStructured - whether the original is verse or another
 line-structured passage, which the rule reads the same way for a lane text
 as it read for the standing (class one hundred two: a lane text carrying
 the Chinese line of a bilingual pair was refused as the standing and offered
 anyway because the offer's rule ran without this flag)

 @returns Lane texts to put on the slate, repair before translate; none when
 the standing is an endorsed eligible lane

 @example
 ```ts
 const laneTexts = laneTextsForSlate({ sourceText, incumbentText, repairText, translateText, standingText, standingMayShip: false, standingEligible: false, },);
 ```
 */
export function laneTextsForSlate(
  {
    sourceText,
    incumbentText,
    repairText,
    translateText,
    standingText,
    standingMayShip,
    standingEligible,
    syntax,
    lineStructured = false,
  }: {
    readonly sourceText: string;
    readonly incumbentText: string;
    readonly repairText: string;
    readonly translateText: string;
    readonly standingText: string;
    readonly standingMayShip: boolean;
    readonly standingEligible: boolean;
    readonly syntax?: SliceSyntax;
    readonly lineStructured?: boolean;
  },
): readonly LaneText[] {
  if (standingMayShip && standingEligible)
    return [];
  /**
   Both lanes in slate order.
   */
  const lanes: readonly LaneText[] = [
    {
      lane: 'repair',
      text: repairText,
    },
    {
      lane: 'translate',
      text: translateText,
    },
  ];
  return lanes.filter(function offered(laneText,): boolean {
    /**
     The lane's text without its surrounding whitespace, blank when the lane
     proposed nothing.
     */
    const trimmed = laneText.text
      .trim();
    if ((trimmed === '') || (laneText.text === standingText))
      return false;
    /**
     What the deterministic rule makes of this lane's text.
     */
    const validation = validateTranslatedSlice({
      sourceText,
      candidateText: laneText.text,
      pageText: incumbentText,
      ...((syntax === undefined) ? {} : { syntax, }),
      lineStructured,
    },);
    return validation.kind === 'valid';
  },);
}

//endregion Lane texts offered to the consolidation slate
