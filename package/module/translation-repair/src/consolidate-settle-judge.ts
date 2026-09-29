import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { SyntheticClient, } from './chat-contract.ts';
import { INELIGIBLE_STANDING_WITHHELD_FINDING, } from './consolidate-ineligible-standing.ts';
import type { ConsolidationSubject, } from './consolidate-settle.ts';
import type { SettlementIdentity, } from './consolidate-settle-context.ts';
import type { RosterModelId, } from './synthetic-catalog.ts';
import {
  type IncumbentKind,
  TranslateAbsenceError,
} from './translate-absence.ts';
import type { TranslateCandidateSet, } from './translate-candidates.ts';
import { judgeTranslateSlate, } from './translate-judge.ts';
import { judgeSlateWithRetry, } from './translate-retry.ts';
import type { TranslateStageResult, } from './translate-stage-result.ts';

//region Consolidate settle judging
// THE SLATE JUDGING OF `consolidate-settle.ts`, split out at that file's line
// budget when its absence stopped throwing and started returning (owner,
// 2026-09-27, "Keep archive, ship"). The request is built here once, so the
// challenged and the single-round asks cannot drift apart.

/**
 What the slate judging returned: a decision, or the absence it raised over
 a withheld standing, which keeps the archive rather than stopping the entry.

 @example
 ```ts
 const round: JudgedRound = { kind: 'decided', decided, };
 ```
 */
export type JudgedRound =
  | {
    /**
     The judges settled the slate.
     */
    readonly kind: 'decided';

    /**
     What they settled.
     */
    readonly decided: TranslateStageResult;
  }
  | {
    /**
     The slate reached the judges with nothing on it to ship.
     */
    readonly kind: 'absent';

    /**
     The absence the judging raised, carrying its reason and findings.
     */
    readonly absence: TranslateAbsenceError;
  };

/**
 Asks the slate judges over one consolidation slate.

 AN ABSENT SLATE WITH THE STANDING WITHHELD KEEPS THE ARCHIVE. The judge
 reports an absent incumbent as a passage the archive never carried; here
 the passage exists and failed the gate, and with no candidate or no voice
 heard nothing on the slate may ship either, so the caller keeps the archive
 (owner, 2026-09-27, "Keep archive, ship"). Until then this re-raised the
 judge's refusal under the ineligible standing's name and stopped the entry.

 A TIE WITH THE STANDING WITHHELD IS CHALLENGED ONCE (class fifty-five,
 XingZ605 slice 13, 2026-09-18): four valid proposals, the judges 2 to 2
 between two renderings, and the decline stopped the entry at 4h08m over
 a slate that had nothing wrong with it. The translate lane has re-asked a
 declined slate under `decline-challenge` since class fifty-three, with a
 run-off over the candidates the tie backed; the consolidation gets the
 same second round wherever the standing is withheld, and a challenge that
 declines with nothing left to narrow ships the judges' preference (owner,
 2026-09-27, "Preference + polish"). An eligible standing keeps the single
 round, because there a decline keeps text the contest already endorsed,
 except where every contest ballot called the archive flawed
 (`runoffOverStanding`, class one hundred six), where a tie is run off too.
 This said the eligible standing always kept the single round until ledger
 H10.

 @param client - provider client the round borrows

 @param judgeModelIds - voices seated to judge

 @param subject - slice in the archive's terms

 @param built - distinct proposals the judges see

 @param survivors - proposals the floor passed, counted for the judges

 @param producedFindings - what gathering and repairing recorded

 @param standingEligible - whether the standing passed the deterministic gate

 @param incumbent - what the slate offers to keep, empty when withheld

 @param identity - front matter and reference context the judges read

 @param evidence - pictures and neighbouring passages the producers saw

 @param lineStructured - whether the verse rule governs this slice

 @param challenged - whether a tie is run off once

 @param sliceIndex - prepared position of the slice, for the log

 @param signal - cancellation for the whole round

 @param perCallTimeoutMs - ceiling on each call

 @param l - stage logger

 @returns Decision, or the absence raised over a withheld standing

 @throws Whatever the judging raises other than an absence over a withheld
 standing

 @example
 ```ts
 const judgedRound = await judgeConsolidationSlate({ client, judgeModelIds, subject, built, survivors, ... },);
 ```
 */
export async function judgeConsolidationSlate(
  {
    client,
    judgeModelIds,
    subject,
    built,
    survivors,
    producedFindings,
    standingEligible,
    incumbent,
    identity,
    evidence,
    lineStructured,
    challenged,
    sliceIndex,
    signal,
    perCallTimeoutMs,
    l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly judgeModelIds: readonly RosterModelId[];
    readonly subject: ConsolidationSubject;
    readonly built: TranslateCandidateSet;
    readonly survivors: number;
    readonly producedFindings: readonly string[];
    readonly standingEligible: boolean;
    readonly incumbent: Readonly<{
      incumbentText: string;
      incumbentKind: IncumbentKind;
    }>;
    readonly identity: SettlementIdentity;
    readonly evidence: Readonly<{
      pictureContext?: string;
      neighbouringSourceText?: string;
      neighbouringIncumbentText?: string;
    }>;
    readonly lineStructured: boolean;
    readonly challenged: boolean;
    readonly sliceIndex: number;
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs: number;
    readonly l: Logger;
  }>,
): Promise<JudgedRound> {
  /**
   Everything one slate judging takes, built once so the challenged and
   the single-round asks cannot drift apart.
   */
  const judging: Parameters<typeof judgeTranslateSlate>[0] = {
    client,
    produced: {
      candidates: built.candidates,

      // SURVIVORS RATHER THAN VOICES HEARD, because this number exists to
      // tell the judges how thin the slate they are deciding over is, and
      // a refused proposal is not on it. A census reading this for
      // transport health would misread a refusal as a lost voice;
      // `verdicts` is what separates them.
      heardTranslators: survivors,

      findings: [
        ...producedFindings,
        ...(standingEligible ? [] : [INELIGIBLE_STANDING_WITHHELD_FINDING,]),
        ...built.findings,
      ],
    },
    judgeModelIds,
    sourceText: subject.sourceText,
    incumbentText: incumbent.incumbentText,

    // PRESENT WHENEVER THE STANDING MAY SHIP, ABSENT WHEN THE GATE REFUSED
    // IT. What the judges fall back on at this stage is `standingText`,
    // not the archive's own wording, and the `standingText === ''` exit
    // in `settleConsolidation` returns before any judge is bought; so a
    // slate reaching this call has a text to keep unless that text is
    // ineligible, in which case there is nothing to keep. Threading the
    // slice's own `incumbentKind` here would say something different and
    // wrong: an anchor whose lanes both produced wording has a standing text
    // to fall back on even though the archive holds none.
    incumbentKind: incumbent.incumbentKind,
    ...((subject.syntax === undefined) ? {} : { syntax: subject.syntax, }),
    ...identity,
    // WHAT THE PRODUCERS WERE SHOWN, forwarded rather than recomputed.
    // One change put the pictures in front of the producers and left the
    // judges blind, which is worse than both being blind: a producer that
    // used a picture correctly then looked to its judge like one
    // inventing detail.
    ...evidence,
    // THE SAME FLAG THE PRODUCERS WERE GIVEN, which the settlement has held
    // since it was written and passed to nobody. It was then given to the
    // consolidation producers; leaving the judges out of it would have the
    // judges mark down exactly the unmerging the producers were told to do.
    lineStructured,
    // WORDING THAT CANNOT SHIP IS WITHHELD, NOT ABSENT (owner answer
    // 2026-09-27, "Preference + polish"): the judges are told a declined
    // slate still ships by preference, and a challenge round declined
    // with nothing left to narrow does, where it stopped the entry.
    withheldStanding: !standingEligible,
    signal,
    perCallTimeoutMs,
    l,
  };
  try {
    return {
      kind: 'decided',
      decided: challenged
        ? await judgeSlateWithRetry({ judging, },)
        : await judgeTranslateSlate(judging,),
    };
  }
  catch (error) {
    // Only a slate with nothing to ship reaches here now: no candidate, or
    // no voice heard.
    if ((standingEligible) || (!(error instanceof TranslateAbsenceError)))
      throw error;
    l.warn(`slice ${String(sliceIndex,)}: the withheld slate left the judges nothing (${error.reason})`,);
    return {
      kind: 'absent',
      absence: error,
    };
  }
}

//endregion Consolidate settle judging
