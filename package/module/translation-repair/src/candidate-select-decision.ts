import {
  CANDIDATE_NONE,
  type CandidateBallotAsSent,
  KEEPS_TRUSTED_TEXT,
  type SelectEvidence,
} from './candidate-select-wire.ts';
import type { DecisionAnswer, } from './decision-contract.ts';
import type { StageDecision, } from './stage-decision-call.ts';

//region Candidate selection as a typed question
// THE SELECT BALLOT PHRASED FOR A DECISION SEAT: the same task, criteria,
// evidence and anonymized candidates the chat sheet carries
// (`buildCandidateSelectMessages`), as a state object, and one choice
// question over the candidate numbers plus the decline. A decision seat
// answers with a number and a distribution and never a reason, so the
// ballot's `reason` carries the distribution, which is the audit trail a
// typed judge can give.

/**
 One evidence block as the state carries it.

 @example
 ```ts
 const block: EvidenceBlock = { label: 'ORIGINAL (Chinese)', text: '猫在窗台上打盹。', };
 ```
 */
type EvidenceBlock = {
  /**
   Heading naming what the text is.
   */
  readonly label: string;

  /**
   Material itself.
   */
  readonly text: string;
};

/**
 Label the ballot's reason opens with, so a reader can tell a typed ballot
 from a written one.
 */
export const TYPED_BALLOT_REASON = 'typed decision';

/**
 What a chosen index reads as when the answer carries no distribution.
 */
const UNREPORTED = 'unreported';

/**
 What the reading hands the stage guard when the answers carry no choice for
 the ballot question: a value no guard admits, so the seat's voice is lost
 rather than read as a decline.
 */
export const NO_TYPED_ANSWER: unique symbol = Symbol('decision seat replied without choosing a candidate number (select stage, 2026-09-18)',);

/**
 Builds the select stage's question for a decision seat.

 @param task - what the candidates are attempting, in one sentence

 @param criteria - ordered decision rules, most important first

 @param evidence - source and baseline material judges compare against

 @param rendered - candidate texts in caller-fixed order

 @param declineConsequence - what the caller does when every judge declines

 @returns State, one choice question and the reading into a ballot

 @example
 ```ts
 const decision = selectDecision({ task, criteria, evidence, rendered, },);
 ```
 */
export function selectDecision(
  {
    task,
    criteria,
    evidence,
    rendered,
    declineConsequence = KEEPS_TRUSTED_TEXT,
  }: {
    readonly task: string;
    readonly criteria: readonly string[];
    readonly evidence: readonly SelectEvidence[];
    readonly rendered: readonly string[];
    readonly declineConsequence?: string;
  },
): StageDecision {
  /**
   Options: the decline, then one per candidate by its one-based number.
   */
  const options: Readonly<Record<string, string>> = Object.fromEntries([
    [
      String(CANDIDATE_NONE,),
      'no candidate is acceptable',
    ],
    ...rendered.map(function option(
      _text,
      index,
    ): readonly [
      string,
      string,
    ] {
      return [
        String(index + 1,),
        `candidate ${String(index + 1,)} is the best rendering`,
      ];
    },),
  ],);
  return {
    state: {
      task,
      criteria: Object.fromEntries(criteria.map(function rule(
        text,
        index,
      ): readonly [
        string,
        string,
      ] {
        return [
          String(index + 1,),
          text,
        ];
      },),),
      evidence: evidence.map(function block(entry,): EvidenceBlock {
        return {
          label: entry.label,
          text: entry.text,
        };
      },),
      candidates: Object.fromEntries(rendered.map(function candidate(
        text,
        index,
      ): readonly [
        string,
        string,
      ] {
        return [
          String(index + 1,),
          text,
        ];
      },),),
    },
    questions: {
      best: {
        type: 'choice',
        instructions: `${task} Decide by the numbered rules in state.criteria, earlier ones outranking later ones. `
          + 'You do not know which system produced which candidate. Judge only the texts in state.candidates '
          + `against state.evidence. Choose ${String(CANDIDATE_NONE,)} when NO candidate is acceptable; `
          + `${declineConsequence}.`,
        criteria: options,
      },
    },
    read: function readBallot(answers: Readonly<Record<string, DecisionAnswer>>,): CandidateBallotAsSent | typeof NO_TYPED_ANSWER {
      /**
       Answer to the one question, when it is a choice.
       */
      const { best, } = answers;
      if ((best === undefined) || (best.type !== 'choice'))
        return NO_TYPED_ANSWER;
      return {
        best: best.choice,
        reason: `${TYPED_BALLOT_REASON}: probabilities ${JSON.stringify(best.probabilities ?? {},)}, confidence ${
          (best.confidence === undefined) ? UNREPORTED : String(best.confidence,)
        }`,
      };
    },
  };
}

//endregion Candidate selection as a typed question
