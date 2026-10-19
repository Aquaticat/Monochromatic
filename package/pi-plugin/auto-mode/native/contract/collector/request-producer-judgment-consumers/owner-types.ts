/**
 Request producer contracts derive from the installed SDK stream and the real judgment factories. @module
 */
import type { AgentSession } from '@earendil-works/pi-coding-agent';
import type { JudgmentConstructionInput } from '../program-rule-batch-sdk-copy-v2/input/judgment-constructor-types.ts';

//region Native request and response shapes follow the installed SDK stream contract.

/**
 Original producer request keeps the SDK model, transcript context and stream options.
 */
export type ProducerRequest = Parameters<AgentSession['agent']['streamFunction']>;

/**
 Original producer stream retains its result-bearing asynchronous iteration.
 */
export type ProducerStream = Awaited<ReturnType<AgentSession['agent']['streamFunction']>>;

/**
 Original producer response is the exact result object of one stream occurrence.
 */
export type ProducerResponse = Awaited<ReturnType<ProducerStream['result']>>;

/**
 Original producer stream call forwards one SDK request through its bound consumer.
 */
export type ProducerStreamCall = (...request: ProducerRequest) => Promise<ProducerStream>;

/**
 Original producer handle performs the actual SDK request for one consumer.
 */
export type ProducerStreamHandle = (request: {
  readonly model: ProducerRequest[0];
  readonly context: ProducerRequest[1];
  readonly options: ProducerRequest[2];
}) => Promise<ProducerStream>;

/**
 Original producer invocation is one SDK request through its bound consumer stream.
 The internal issuance tags the request kind selected by the owning wrapper.
 */
export type ProducerInvocation = {
  readonly stream: ProducerStreamCall;
  readonly model: ProducerRequest[0];
  readonly context: ProducerRequest[1];
  readonly options: ProducerRequest[2];
};

/**
 Original tagged issuance carries the request kind its wrapper selects.
 */
export type ProducerIssuance = ProducerInvocation & Readonly<{
  readonly kind: 'main-agent' | 'auxiliary-summary';
}>;

/**
 Original response identity pair authenticates one producer observation.
 */
export type ProducerIdentity = {
  readonly response: unknown;
  readonly stream: unknown;
};

/**
 Original judgment construction entry is the genuine production contract;
 the prepared-group context and cancellation signal are both required.
 */
export type JudgmentConstructionEntry = JudgmentConstructionInput;

/**
 Original judgment constructor builds one owned judgment record for a construction entry.
 The genuine `createJudgmentConstructor` result satisfies this contract exactly.
 */
export type JudgmentConstructor<Judgment> = (input: JudgmentConstructionEntry) => Judgment;

/**
 Original producer judgment entry starts one deadline for an exact main-agent response.
 */
export type ProducerJudgmentEntry = {
  readonly response: JudgmentConstructionInput['response'];
  readonly stream: object;
  readonly signal: AbortSignal;
  readonly group: JudgmentConstructionInput['group'];
};

//endregion Native request and response shapes follow the installed SDK stream contract.

//region Judgment slots keep one discriminated state so retirement releases the whole record.

/**
 Constructing slots hold no value yet; retired slots hold no evidence again.
 */
export type JudgmentSlotState<Judgment> = Readonly<
  | {
    readonly state: 'constructing';
  }
  | {
    readonly state: 'active';
    readonly value: Judgment;
  }
  | {
    readonly state: 'failed';
    readonly error: unknown;
  }
  | {
    readonly state: 'retired';
  }
>;

/**
 Shared judgment slot keeps one completion flag beside its discriminated state record.
 */
export type JudgmentSlot<Judgment> = {
  completed: boolean;
  state: JudgmentSlotState<Judgment>;
};

//endregion Judgment slots keep one discriminated state so retirement releases the whole record.

//region Producer records keep description, response and ambiguity beside consumer identity.

/**
 Original producer description labels request custody without claiming authority.
 */
export type ProducerDescription = Readonly<{
  readonly kind: 'main-agent' | 'auxiliary-summary';
  readonly instructionAuthority: 'not-established';
  readonly humanWitness: 'not-established';
  readonly judgmentBudgetAtRequest: 'not-created';
}>;

/**
 Original consumer identity owns its stream callback and current judgment slot.
 */
export type ProducerConsumerIdentity<Judgment> = {
  readonly construct?: JudgmentConstructor<Judgment>;
  readonly judgments: {
    current?: JudgmentSlot<Judgment>;
  };
};

/**
 Original claim binds one stamped request occurrence to its exact consumer.
 */
export type ProducerClaim<Judgment> = {
  readonly consumer: ProducerConsumerIdentity<Judgment>;
  readonly kind: 'main-agent' | 'auxiliary-summary';
  open: boolean;
  consumed: boolean;
};

/**
 Original producer record retains its response identity and reuse tombstone.
 */
export type ProducerRecord<Judgment> = {
  readonly consumer: ProducerConsumerIdentity<Judgment>;
  readonly description: ProducerDescription;
  response?: ProducerResponse;
  ambiguous: boolean;
  judgment?: JudgmentSlot<Judgment>;
};

//endregion Producer records keep description, response and ambiguity beside consumer identity.
