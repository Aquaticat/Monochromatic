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
 Raised when the slate judging raises an absence over a withheld standing,
 whose slate the judging was told ships by preference.

 A FAULT IN THIS CODE rather than a fact about any text (ledger B51, as
 ledger B43 set out for the floor): a withheld slate reaches the judges only
 with a candidate on it, since the settlement keeps the archive first where
 no proposal survived the floor and no lane text is offered, and the lane
 offer drops blank texts; and on a slate with a candidate the judging ships
 its preference past every decline (owner, 2026-09-27, "Preference +
 polish"). An absence here means one of those rules changed without the
 other.

 @example
 ```ts
 throw new WithheldSlateAbsenceError({ reason: error.reason, cause: error, },);
 ```
 */
export class WithheldSlateAbsenceError extends Error {
  /**
   Declares this message safe to forward: it is one fixed sentence; the
   absence's reason rides beside it as a field and never enters it.
   */
  readonly messageNamesOnly: true = true;

  /**
   Why the judging said the slate had nothing to ship.
   */
  public readonly reason: TranslateAbsenceError['reason'];

  /**
   Builds the failure around the absence the judging raised.

   @param reason - why the judging said the slate had nothing to ship

   @param cause - the absence itself, kept for its findings

   @example
   ```ts
   throw new WithheldSlateAbsenceError({ reason: error.reason, cause: error, },);
   ```
   */
  public constructor(
    {
      reason,
      cause,
    }: {
      readonly reason: TranslateAbsenceError['reason'];
      readonly cause: TranslateAbsenceError;
    },
  ) {
    super(
      'the slate judging raised an absence over a withheld standing, whose slate ships by preference, '
        + 'so the settlement and the judging disagree about what a withheld slate can reach',
      { cause, },
    );
    this.name = 'WithheldSlateAbsenceError';
    this.reason = reason;
  }
}

/**
 The slate judging's decision, with an absence over a withheld standing
 named as the fault it is.

 ONE NARROWING AT THE ONE CALL SITE, so the answer that cannot come has one
 statement with its own case, as `requireComparedVerdict` has for the floor
 (ledger B43). An absence over an eligible standing, and anything else the
 judging raises, passes through unchanged.

 @param judged - the judging in flight

 @param standingEligible - whether the standing passed the deterministic gate

 @returns The judges' decision

 @throws {@link WithheldSlateAbsenceError} when the judging raises an absence
 over a withheld standing

 @throws Whatever else the judging raises, unchanged

 @example
 ```ts
 const decided = await requireWithheldSlateDecided({ judged: judgeTranslateSlate(judging,), standingEligible, },);
 ```
 */
export async function requireWithheldSlateDecided<const DecidedT,>(
  {
    judged,
    standingEligible,
  }: {
    readonly judged: Promise<DecidedT>;
    readonly standingEligible: boolean;
  },
): Promise<DecidedT> {
  try {
    return await judged;
  }
  catch (error) {
    if (standingEligible || (!(error instanceof TranslateAbsenceError)))
      throw error;
    throw new WithheldSlateAbsenceError({
      reason: error.reason,
      cause: error,
    },);
  }
}

/**
 Asks the slate judges over one consolidation slate.

 A WITHHELD SLATE IS ALWAYS DECIDED (ledger B51). It used to return the
 absence the judging raised over a withheld standing, which the settlement
 answered by keeping the archive (owner, 2026-09-27, "Keep archive, ship");
 since the judging ships its preference past every decline over a withheld
 standing, and the settlement keeps the archive before judging a slate with
 nothing on it, no judging reaches that absence, and it is now the fault
 `WithheldSlateAbsenceError` names.

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

 @param signal - cancellation for the whole round

 @param perCallTimeoutMs - ceiling on each call

 @param l - stage logger

 @returns The judges' decision

 @throws {@link WithheldSlateAbsenceError} when the judging raises an absence
 over a withheld standing, a fault in this code

 @throws Whatever else the judging raises, unchanged

 @example
 ```ts
 const decided = await judgeConsolidationSlate({ client, judgeModelIds, subject, built, survivors, producedFindings, standingEligible, incumbent, identity, evidence, lineStructured, challenged, signal, perCallTimeoutMs, l, },);
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
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs: number;
    readonly l: Logger;
  }>,
): Promise<TranslateStageResult> {
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
  return await requireWithheldSlateDecided({
    judged: challenged
      ? judgeSlateWithRetry({ judging, },)
      : judgeTranslateSlate(judging,),
    standingEligible,
  },);
}

//endregion Consolidate settle judging
