import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { SyntheticClient, } from './chat-contract.ts';
import type {
  DecisionAnswer,
  DecisionQuestion,
  DecisionState,
} from './decision-contract.ts';
import { NoProviderForModelError, } from './provider-router.ts';
// TYPE-ONLY AND DELIBERATELY CIRCULAR: `stage-call.ts` calls into this file
// for a decision seat and this file names its voice type. Erased before
// anything runs; the alternative is a third file holding one type alias.
import type { StageVoice, } from './stage-call.ts';
import type { RosterModelId, } from './synthetic-catalog.ts';

//region Stage decision call
// The typed half of one stage exchange. A stage that can phrase its ballot
// as a question (a choice among candidates, a yes-or-no, a score) hands
// this the state and the questions beside its chat sheet, and a decision
// seat on the bench is asked the question where a chat seat is asked the
// sheet. Both answer into the same `StageVoice`, so the quorum, the tally
// and the ledger never learn which kind of seat spoke.

/**
 One stage's ballot as a typed question, beside its chat sheet.

 @example
 ```ts
 const decision: StageDecision = { state: { candidates: { '1': 'The cat naps.', }, }, questions: { best: { type: 'choice', instructions: 'Which is best?', criteria: { '0': 'none', '1': 'candidate 1', }, }, }, read: function read(answers,) { return { best: '1', reason: 'typed', }; }, };
 ```
 */
export type StageDecision = {
  /**
   What the questions are about, the same evidence the chat sheet carries.
   */
  readonly state: DecisionState;

  /**
   Questions by name.
   */
  readonly questions: Readonly<Record<string, DecisionQuestion>>;

  /**
   Reads the answers into the shape the stage's own guard admits; a reading
   the guard refuses is a lost voice, as a chat reply the guard refuses is.
   */
  readonly read: (answers: Readonly<Record<string, DecisionAnswer>>,) => unknown;
};

/**
 Runs one typed-decision exchange for a pipeline stage.

 @param client - injected model client, asked through its `decide`

 @param modelId - decision seat to ask

 @param decision - the stage's question, absent when the stage has none

 @param signal - caller abort honored by the exchange

 @param exchangeTimeoutMs - deadline for the exchange

 @param validate - the stage's own guard over the read answer

 @param stage - stage label for logging

 @param l - logger of the calling stage

 @returns Voice as data; a lost voice never throws unless the caller aborted

 @example
 ```ts
 const voice = await attemptDecisionCall({ client, modelId, decision, signal, exchangeTimeoutMs, validate, stage, l, },);
 ```
 */
export async function attemptDecisionCall<ValueT,>(
  {
    client,
    modelId,
    decision,
    signal,
    exchangeTimeoutMs,
    validate,
    stage,
    l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly modelId: RosterModelId;
    readonly decision?: StageDecision;
    readonly signal: AbortSignal;
    readonly exchangeTimeoutMs: number;
    readonly validate: (value: unknown,) => value is ValueT;
    readonly stage: string;
    readonly l: Logger;
  }>,
): Promise<StageVoice<ValueT>> {
  /**
   Typed exchange the client offers, absent on a client with no decisions
   transport.
   */
  const { decide, } = client;
  if (decision === undefined) {
    l.warn(`${stage} ${modelId}: a decision seat asked a stage with no typed question, voice lost`,);
    return {
      heard: false,
      answered: false,
      unreachable: false,
    };
  }
  if (decide === undefined) {
    l.warn(`${stage} ${modelId}: a decision seat with no decisions client, voice lost`,);
    return {
      heard: false,
      answered: false,
      unreachable: false,
    };
  }
  try {
    /**
     Answers as the endpoint gave them.
     */
    const reply = await decide({
      modelId,
      state: decision.state,
      questions: decision.questions,
      signal,
      exchangeTimeoutMs,
    },);

    /**
     Answers read into the stage's own shape.
     */
    const value = decision.read(reply.answers,);
    if (!validate(value,)) {
      l.warn(`${stage} ${modelId}: typed answer failed the stage guard, voice lost`,);
      return {
        heard: false,
        answered: true,
        unreachable: false,
      };
    }
    return {
      heard: true,
      value,
    };
  }
  catch (error) {
    // Aborts must always win so user steering can stop a fan-out.
    if (signal.aborted)
      throw error;

    /**
     Whether the router refused the call because the decisions endpoint
     reads dry, which is a fact about the bench rather than the exchange.
     */
    const unreachable = error instanceof NoProviderForModelError;
    l.warn(`${stage} ${modelId}: ${String(error,)}, ${unreachable ? 'seat unreachable' : 'voice lost'}`,);
    return {
      heard: false,
      answered: false,
      unreachable,
    };
  }
}

//endregion Stage decision call
