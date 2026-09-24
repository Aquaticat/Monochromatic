import type { SliceSyntax, } from './chunk-document.ts';
import type { DeclaredNamePair, } from './linked-title-declared-name.ts';
import type { HeardVoice, } from './stage-quorum.ts';
import { validateTranslatedSlice, } from './translate-validate.ts';
import type { TranslateReportWire, } from './translate-wire.ts';

//region Translate floor
// THE SIXTY-SIXTH CLASS (XingZ615, 2026-09-19). The translate lane sends a
// candidate the deterministic publication rule refuses back to its author
// once (the owner's decision of 2026-08-14), and kept it on the slate when
// the revision failed too, on the reading that the original was at least
// what the model produced with the whole sheet in front of it. The judges
// do not apply the rule: on the closing poem they chose the rendering that
// moved the attribution line out of the quote (three blocks against the
// original's two) over two renderings that kept it, the lane contest
// flagged the winner "retryable" and moved on, and the consolidation
// withheld it as the standing with nothing valid left to ship. A text the
// rule refuses cannot reach the page, so after its turn it is withheld from
// the judges and kept as a finding; the repair turn and the model's own
// defence are unchanged.

/**
 Finding prefix a withheld candidate is recorded under.
 */
const REFUSED_FINDING = 'translate-candidate-refused';

/**
 Withholds from the slate every candidate the deterministic publication rule
 still refuses after its repair turn.

 @param voices - candidates as the repair turn left them

 @param sourceText - original slice

 @param incumbentText - archive's rendering, which the rule reads as the page
 shape

 @param syntax - syntax role of the slice, when it has one

 @param lineStructured - whether the slice owes one line per line

 @param declared - name pairs the front matter declares, which the rule
 reads for a linked title naming a declared person (class one hundred
 fourteen); none leaves that floor silent

 @returns Candidates the rule accepts, with a finding per candidate withheld

 @example
 ```ts
 const floored = floorTranslateVoices({ voices, sourceText, incumbentText, lineStructured, },);
 ```
 */
export function floorTranslateVoices(
  {
    voices,
    sourceText,
    incumbentText,
    syntax,
    lineStructured,
    declared = [],
  }: {
    readonly voices: readonly HeardVoice<TranslateReportWire>[];
    readonly sourceText: string;
    readonly incumbentText: string;
    readonly syntax?: SliceSyntax;
    readonly lineStructured: boolean;
    readonly declared?: readonly DeclaredNamePair[];
  },
): {
  readonly voices: readonly HeardVoice<TranslateReportWire>[];
  readonly findings: readonly string[];
} {
  /**
   Findings for the candidates withheld, in voice order.
   */
  const findings: string[] = [];
  /**
   Candidates the rule accepts, in voice order.
   */
  const accepted = voices.filter(function acceptedByRule(voice,): boolean {
    /**
     What the rule makes of this candidate.
     */
    const validation = validateTranslatedSlice({
      sourceText,
      candidateText: voice.value
        .translation,
      pageText: incumbentText,
      ...((syntax === undefined) ? {} : { syntax, }),
      lineStructured,
      declared,
    },);
    // A RULE THAT CANNOT SAY keeps the candidate: only a refusal withholds.
    if (validation.kind !== 'invalid')
      return true;
    /**
     Why the rule refused it, as one line.
     */
    const reason = validation.findings
      .join(' ',);
    findings.push(`${REFUSED_FINDING} (${voice.modelId}): ${reason}`,);
    return false;
  },);
  return {
    voices: accepted,
    findings,
  };
}

//endregion Translate floor
