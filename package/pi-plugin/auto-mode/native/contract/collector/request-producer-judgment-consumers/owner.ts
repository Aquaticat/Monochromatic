/**
 Native call-site and response identity evidence never confers instruction authority or permission. @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import type {
  JudgmentConstructor,
  JudgmentSlot,
  ProducerClaim,
  ProducerConsumerIdentity,
  ProducerDescription,
  ProducerIdentity,
  ProducerInvocation,
  ProducerJudgmentEntry,
  ProducerRecord,
  ProducerRequest,
  ProducerResponse,
  ProducerStream,
  ProducerStreamCall,
  ProducerStreamHandle
} from './owner-types.ts';

/**
 Producer diagnostics retain the original message and optional cause.
 */
export class RequestProducerError extends Error {
  /**
   Original category follows the constructing subclass name.

   @param message - original producer custody failure explanation

   @param options - original optional cause retained in the standard error chain
   */
  constructor(message: string, options?: Readonly<ErrorOptions>) {
    super(message, options);
    this.name = this.constructor.name;
  }
}

/**
 Original diagnostics logger identifies the producer custody boundary.
 */
const l = tagged({ tag: 'auto-mode-request-producer' });

/**
 Recognize the object and function values the producer tables retain.

 @param value - untrusted stream, response or option candidate

 @returns whether the candidate is an object or function reference
 */
function reference(value: unknown): value is object {
  return (value !== null) && (((typeof value) === 'object') || ((typeof value) === 'function'));
}

/**
 Create one producer owner for its fixed clock and optional judgment constructor.

 @param options - original owned clock and judgment constructor

 @returns original producer custody owner

 @example
 ```ts
 const producerOwner = createRequestProducerOwner({ now, createJudgment });
 ```
 */
export function createRequestProducerOwner<Judgment>({
  now,
  createJudgment
}: {
  readonly now?: () => number;
  readonly createJudgment?: JudgmentConstructor<Judgment>;
} = {}): {
  readonly bindConsumer: (handle: ProducerStreamHandle) => ProducerStreamCall;
  readonly bindJudgmentConsumer: (input: {
    readonly handle: ProducerStreamHandle;
    readonly construct: JudgmentConstructor<Judgment>;
  }) => ProducerStreamCall;
  readonly fromAgentLoop: (input: ProducerInvocation) => Promise<ProducerStream>;
  readonly fromAuxiliarySummary: (input: ProducerInvocation) => Promise<ProducerStream>;
  readonly describeResponse: (input: ProducerIdentity) => ProducerDescription;
  readonly assertMainAgentResponse: (input: ProducerIdentity) => void;
  readonly beginJudgment: (input: ProducerJudgmentEntry) => Judgment;
  readonly completeJudgment: (input: ProducerIdentity) => void;
  readonly judgmentFor: (input: ProducerIdentity) => Judgment;
} {
  /**
   Consumer identities own their stream callbacks and current judgment slot.
   */
  const consumers = new WeakMap<object, ProducerConsumerIdentity<Judgment>>();
  /**
   Claims bind one stamped request occurrence to its exact consumer.
   */
  const claims = new WeakMap<object, ProducerClaim<Judgment>>();
  /**
   Responses retain their producer record for the lifetime of their SDK keys.
   */
  const responses = new WeakMap<object, ProducerRecord<Judgment>>();
  /**
   Streams retain their producer record for the lifetime of their SDK keys.
   */
  const streams = new WeakMap<object, ProducerRecord<Judgment>>();

  /**
   Read the record of one exact response/consumer pair without checking reuse tombstones.

   @param input - original response and its bound consumer stream

   @returns original producer record for this exact pair

   @throws RequestProducerError when the pair has no producer observation
   */
  function ownedResponseRecord({
    response,
    stream
  }: ProducerIdentity): ProducerRecord<Judgment> {
    const record = reference(response) ? responses.get(response) : undefined;
    const identity = (typeof stream) === 'function' ? consumers.get(stream) : undefined;
    if ((!record) || (!identity)
      || (record.consumer !== identity)) throw new RequestProducerError('Response has no producer observation for this exact consumer');
    return record;
  }

  /**
   Read one record while rejecting responses or streams reused across invocations.

   @param input - original response and its bound consumer stream

   @returns original unambiguous producer record

   @throws RequestProducerError when the pair was reused across producer invocations
   */
  function responseRecord(input: ProducerIdentity): ProducerRecord<Judgment> {
    const record = ownedResponseRecord(input);
    if (record.ambiguous) throw new RequestProducerError('Response or stream identity was reused across producer invocations');
    return record;
  }

  /**
   Describe one response through its original producer observation.

   @param input - original response and its bound consumer stream

   @returns original immutable description for this response
   */
  function describeResponse(input: ProducerIdentity): ProducerDescription {
    return responseRecord(input)
      .description;
  }

  /**
   Prove one response belongs to the main-agent request stream.

   @param input - original response and its bound consumer stream

   @throws RequestProducerError when the response came from an auxiliary request
   */
  function assertMainAgentResponse(input: ProducerIdentity): void {
    if (responseRecord(input)
      .description
      .kind !== 'main-agent') throw new RequestProducerError('Auxiliary request output is not a main-agent tool response');
  }

  /**
   Construction reentry is rejected for the whole owner while one entry is open.
   */
  const constructionState = { beginning: false };

  /**
   Release completed evidence without discarding response ownership or reuse tombstones.

   @param slot - original completed judgment slot for one response
   */
  function retireJudgment(slot: JudgmentSlot<Judgment>): void {
    const rl = tagged({
      tag: retireJudgment.name,
      l
    });
    if (!slot.completed) throw new RequestProducerError('An active producer judgment cannot be retired');
    rl.debug(`retiring completed producer evidence in state ${slot.state.state}`);
    slot.state = { state: 'retired' };
  }

  /**
   Reserve and construct one enclosing judgment for an exact main-agent response.

   @param input - original response, stream, cancellation signal and prepared-group context

   @returns original constructed judgment record

   @throws RequestProducerError when construction reenters, the response is auxiliary or already reserved, or the constructor result violates its ownership checks
   */
  function beginJudgment(input: ProducerJudgmentEntry): Judgment {
    if (constructionState.beginning) throw new RequestProducerError('Judgment construction cannot reenter');
    if ((typeof now) !== 'function') throw new RequestProducerError('Owned judgment clock and constructor are unavailable');
    constructionState.beginning = true;
    using constructionScope = {
      [Symbol.dispose]() {
        constructionState.beginning = false;
      }
    };
    {
      const startedAt = now();
      if (!Number.isFinite(startedAt)) throw new RequestProducerError('Judgment start clock is not finite');
      if ((!input) || ((typeof input) !== 'object')) throw new RequestProducerError('Judgment entry requires an owned response/consumer input');
      const {
        response,
        stream,
        signal,
        group
      } = input;
      const record = responseRecord({
        response,
        stream
      });
      if (record.description
        .kind !== 'main-agent') throw new RequestProducerError('Auxiliary request output cannot own a tool judgment');
      const { construct } = record.consumer;
      if ((typeof construct) !== 'function') throw new RequestProducerError('This consumer has no owned judgment constructor');
      if (record.judgment !== undefined) throw new RequestProducerError('Response already reserved its enclosing judgment');
      const slot: JudgmentSlot<Judgment> = {
        completed: false,
        state: { state: 'constructing' }
      };
      record.judgment = slot;
      const previous = record.consumer
        .judgments
        .current;
      if (previous?.completed) retireJudgment(previous);
      record.consumer
        .judgments
        .current = slot;
      try {
        const value = construct(Object.freeze({
          startedAt,
          signal,
          response,
          stream,
          ...(group === undefined ? {} : { group })
        }));
        if ((!reference(value)) || ((typeof value) !== 'object')
          || (!Object.isFrozen(value))
          || (![
            Object.prototype,
            null
          ].includes(Object.getPrototypeOf(value)))) throw new RequestProducerError('Judgment constructor must return an owned frozen plain record');
        for (const key of Reflect.ownKeys(value)) {
          const descriptor = Object.getOwnPropertyDescriptor(
            value,
            key
          );
          if (((typeof key) !== 'string') || (!descriptor)
            || (!Object.hasOwn(
              descriptor,
              'value'
            ))
            || (!descriptor.enumerable)) throw new RequestProducerError('Judgment result contains an accessor, symbol or hidden property');
        }
        if ((typeof Reflect.get(value, 'then')) === 'function') throw new RequestProducerError('Judgment constructor cannot return an asynchronous result');
        if ((responseRecord({
          response,
          stream
        }) !== record) || (record.judgment !== slot)) throw new RequestProducerError('Judgment response binding changed during construction');
        slot.state = {
          state: 'active',
          value
        };
        return value;
      }
      catch (error) {
        slot.state = {
          state: 'failed',
          error
        };
        throw error;
      }
    }
  }

  /**
   Read the constructed judgment of one reserved response.

   @param input - original response and its bound consumer stream

   @returns original constructed judgment record

   @throws RequestProducerError when the reservation is absent, retired, failed or still constructing
   */
  function judgmentFor(input: ProducerIdentity): Judgment {
    const slot = responseRecord(input)
      .judgment;
    if (!slot) throw new RequestProducerError('Response has no enclosing judgment reservation');
    const state = slot.state;
    if (state.state === 'retired') throw new RequestProducerError('Response judgment completed and was superseded by a later original judgment');
    if (state.state === 'failed') throw new RequestProducerError(
      'Response judgment construction failed',
      { cause: state.error }
    );
    if (state.state !== 'active') throw new RequestProducerError('Response judgment is still being constructed');
    return state.value;
  }

  /**
   Complete one owned operation after its group and selector cleanup.

   @param input - original response and its bound consumer stream

   @throws RequestProducerError when completion reenters construction, targets an auxiliary response, repeats, or precedes construction settlement
   */
  function completeJudgment(input: ProducerIdentity): void {
    const cl = tagged({
      tag: completeJudgment.name,
      l
    });
    if (constructionState.beginning) throw new RequestProducerError('Producer judgment completion cannot reenter judgment construction');
    // Completion releases an already owned operation even if later reuse invalidates its authority.
    const record = ownedResponseRecord(input);
    if (record.description
      .kind !== 'main-agent') throw new RequestProducerError('Auxiliary request output cannot complete a tool judgment');
    const slot = record.judgment;
    if (slot === undefined) {
      cl.debug('completing native operation without a judgment reservation');
      return;
    }
    if (slot.completed) throw new RequestProducerError('Producer judgment operation already completed');
    if ((slot.state.state !== 'active') && (slot.state.state !== 'failed')) throw new RequestProducerError('Producer judgment construction must settle before operation completion');
    slot.completed = true;
    if (record.consumer
      .judgments
      .current !== slot) {
      retireJudgment(slot);
      return;
    }
    cl.debug(`preserving latest completed producer diagnostic in state ${slot.state.state}`);
  }

  /**
   Bind one producer consumer to its owned handle and judgment constructor.

   @param options - original request handle and judgment constructor

   @returns original bound producer stream callback

   @throws RequestProducerError when the handle is not an owned function
   */
  function makeConsumer({
    handle,
    construct
  }: {
    readonly handle: ProducerStreamHandle;
    readonly construct?: JudgmentConstructor<Judgment>;
  }): ProducerStreamCall {
    if ((typeof handle) !== 'function') throw new RequestProducerError('Producer consumer must be an owned function');
    const identity: ProducerConsumerIdentity<Judgment> = Object.freeze({
      construct,
      judgments: { current: undefined }
    });

    /**
     Create the exact stream callback whose returned stream is tracked once.

     @returns original producer stream callback for this consumer
     */
    function createStreamCallback(): ProducerStreamCall {
      return async function stream(
        model: ProducerRequest[0],
        context: ProducerRequest[1],
        options: ProducerRequest[2]
      ): Promise<ProducerStream> {
        const claim = reference(options) ? claims.get(options) : undefined;
        if ((!claim) || (claim.consumer !== identity)
          || (!claim.open)
          || claim.consumed) throw new RequestProducerError('Request has no current unused claim for this exact consumer');
        claim.consumed = true;
        const record: ProducerRecord<Judgment> = {
          consumer: identity,
          description: Object.freeze({
            kind: claim.kind,
            instructionAuthority: 'not-established',
            humanWitness: 'not-established',
            judgmentBudgetAtRequest: 'not-created'
          }),
          response: undefined,
          ambiguous: false
        };
        const returned = await handle({
          model,
          context,
          options
        });
        if ((!reference(returned)) || ((typeof returned.result) !== 'function')
          || ((typeof returned[Symbol.asyncIterator]) !== 'function')) throw new RequestProducerError('Producer consumer did not return a result-bearing stream');
        const previousStream = streams.get(returned);
        if (previousStream) {
          previousStream.ambiguous = true;
          record.ambiguous = true;
          throw new RequestProducerError('Response or stream identity was reused across producer invocations');
        }
        streams.set(
          returned,
          record
        );
        const originalResult = returned.result
          .bind(returned);
        returned.result = async function producerResult(): Promise<ProducerResponse> {
          const response = await originalResult();
          if (!reference(response)) {
            record.ambiguous = true;
            throw new RequestProducerError('Producer stream returned no response object');
          }
          if ((record.response !== undefined) && (record.response !== response)) {
            record.ambiguous = true;
            throw new RequestProducerError('Producer stream changed its response object');
          }
          const previous = responses.get(response);
          if (previous && (previous !== record)) {
            previous.ambiguous = true;
            record.ambiguous = true;
            throw new RequestProducerError('Response or stream identity was reused across producer invocations');
          }
          record.response = response;
          responses.set(
            response,
            record
          );
          return response;
        };
        return returned;
      };
    }
    const stream = createStreamCallback();
    consumers.set(
      stream,
      identity
    );
    return stream;
  }

  /**
   Bind one consumer whose judgments come from the owner's configured constructor.

   @param handle - original request handle for this consumer

   @returns original bound producer stream callback
   */
  function bindConsumer(handle: ProducerStreamHandle): ProducerStreamCall {
    return makeConsumer({
      handle,
      ...(createJudgment === undefined ? {} : { construct: createJudgment })
    });
  }

  /**
   Bind one consumer with its own owned judgment constructor.

   @param input - original request handle and owned judgment constructor

   @returns original bound producer stream callback

   @throws RequestProducerError when the judgment constructor is not a function
   */
  function bindJudgmentConsumer({
    handle,
    construct
  }: {
    readonly handle: ProducerStreamHandle;
    readonly construct: JudgmentConstructor<Judgment>;
  }): ProducerStreamCall {
    if ((typeof construct) !== 'function') throw new RequestProducerError('Consumer judgment constructor must be an owned function');
    return makeConsumer({
      handle,
      construct
    });
  }

  /**
   Issue one stamped request occurrence for its bound consumer stream.

   @param input - original request kind, bound stream and SDK request values

   @returns original producer stream for this invocation

   @throws RequestProducerError when the stream is unbound or its options are not an owned plain record
   */
  async function invoke({
    kind,
    stream,
    model,
    context,
    options
  }: ProducerInvocation): Promise<ProducerStream> {
    const consumer = (typeof stream) === 'function' ? consumers.get(stream) : undefined;
    if (!consumer) throw new RequestProducerError('Native producer stream is not bound to this issuer');
    if ((options !== undefined) && ((options === null) || ((typeof options) !== 'object')
      || Array.isArray(options)
      || (![
        Object.prototype,
        null
      ].includes(Object.getPrototypeOf(options))))) throw new RequestProducerError('Native request options must be an owned plain record');
    for (const key of Reflect.ownKeys(options ?? {})) {
      const descriptor = Object.getOwnPropertyDescriptor(
        options,
        key
      );
      if ((!descriptor) || (!Object.hasOwn(
        descriptor,
        'value'
      ))
        || (!descriptor.enumerable)) throw new RequestProducerError('Native request options contain an accessor or hidden property');
    }
    const stamped = Object.freeze({ ...options });
    const claim: ProducerClaim<Judgment> = {
      consumer,
      kind,
      open: true,
      consumed: false
    };
    claims.set(
      stamped,
      claim
    );
    using invocationScope = {
      [Symbol.dispose]() {
        claim.open = false;
      }
    };
    return await stream(
      model,
      context,
      stamped
    );
  }

  return Object.freeze({
    bindConsumer,
    bindJudgmentConsumer,
    fromAgentLoop: function invokeMainAgentStream(input: ProducerInvocation): Promise<ProducerStream> {
      return (invoke({
        kind: 'main-agent',
        stream: input.stream,
        model: input.model,
        context: input.context,
        options: input.options
      }));
    },
    fromAuxiliarySummary: function invokeAuxiliarySummaryStream(input: ProducerInvocation): Promise<ProducerStream> {
      return (invoke({
        kind: 'auxiliary-summary',
        stream: input.stream,
        model: input.model,
        context: input.context,
        options: input.options
      }));
    },
    describeResponse,
    assertMainAgentResponse,
    beginJudgment,
    completeJudgment,
    judgmentFor
  });
}
