/**
 Native call-site and response identity evidence never confers instruction authority or permission. @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import {
  RequestProducerError,
  reference
} from './owner-errors.ts';
import { createJudgmentLifecycle } from './owner-judgments.ts';
import type {
  JudgmentConstructor,
  ProducerClaim,
  ProducerConsumerIdentity,
  ProducerDescription,
  ProducerIdentity,
  ProducerInvocation,
  ProducerIssuance,
  ProducerJudgmentEntry,
  ProducerRecord,
  ProducerRequest,
  ProducerResponse,
  ProducerStream,
  ProducerStreamCall,
  ProducerStreamHandle
} from './owner-types.ts';

export { RequestProducerError } from './owner-errors.ts';

/**
 Original diagnostics logger identifies the producer custody boundary.
 */
const l = tagged({ tag: 'auto-mode-request-producer' });

/**
 Create one producer owner for its fixed clock and optional judgment constructor.

 @param now - original owned start clock for judgment deadlines

 @param createJudgment - original optional judgment constructor for bound consumers

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

   @param response - original SDK response object

   @param stream - original bound consumer stream callback

   @returns original producer record for this exact pair

   @throws RequestProducerError when the pair has no producer observation
   */
  function ownedResponseRecord({
    response,
    stream
  }: ProducerIdentity): ProducerRecord<Judgment> {
    /**
     Original table lookups authenticate both identities without reading public traps.
     */
    const record = reference(response) ? responses.get(response) : undefined;
    /**
     Original consumer identity is read only for a callable bound stream.
     */
    const identity = (typeof stream) === 'function' ? consumers.get(stream) : undefined;
    if ((!record) || (!identity)
      || (record.consumer !== identity)) throw new RequestProducerError('Response has no producer observation for this exact consumer');
    return record;
  }

  /**
   Read one record while rejecting responses or streams reused across invocations.

   @param response - original SDK response object

   @param stream - original bound consumer stream callback

   @returns original unambiguous producer record

   @throws RequestProducerError when the pair was reused across producer invocations
   */
  function responseRecord({
    response,
    stream
  }: ProducerIdentity): ProducerRecord<Judgment> {
    /**
     Original owned record is re-read before its reuse tombstone is checked.
     */
    const record = ownedResponseRecord({
      response,
      stream
    });
    if (record.ambiguous) throw new RequestProducerError('Response or stream identity was reused across producer invocations');
    return record;
  }

  /**
   Describe one response through its original producer observation.

   @param response - original SDK response object

   @param stream - original bound consumer stream callback

   @returns original immutable description for this response
   */
  function describeResponse({
    response,
    stream
  }: ProducerIdentity): ProducerDescription {
    /**
     Original response description is read through its exact producer record.
     */
    const { description } = responseRecord({
      response,
      stream
    });
    return description;
  }

  /**
   Prove one response belongs to the main-agent request stream.

   @param response - original SDK response object

   @param stream - original bound consumer stream callback

   @throws RequestProducerError when the response came from an auxiliary request
   */
  function assertMainAgentResponse({
    response,
    stream
  }: ProducerIdentity): void {
    /**
     Original description kind proves the main-agent request stream.
     */
    const description = responseRecord({
      response,
      stream
    })
      .description;
    if (description.kind !== 'main-agent') throw new RequestProducerError('Auxiliary request output is not a main-agent tool response');
  }

  /**
   Judgment lifecycle owns reservation, construction and completion beside these tables.
   */
  const judgmentLifecycle = createJudgmentLifecycle<Judgment>({
    logger: l,
    ...(now === undefined ? {} : { now }),
    responseRecord,
    ownedResponseRecord
  });

  /**
   Bind one producer consumer to its owned handle and judgment constructor.

   @param handle - original request handle for this consumer

   @param construct - original optional owned judgment constructor

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
    /**
     Frozen consumer identity owns its mutable current-slot pointer.
     */
    const identity: ProducerConsumerIdentity<Judgment> = Object.freeze({
      ...(construct === undefined ? {} : { construct }),
      judgments: {}
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
        /**
         Original claim lookup authenticates this request occurrence without traps.
         */
        const claim = reference(options) ? claims.get(options) : undefined;
        if ((!claim) || (claim.consumer !== identity)
          || (!claim.open)
          || claim.consumed) throw new RequestProducerError('Request has no current unused claim for this exact consumer');
        claim.consumed = true;
        /**
         Original record binds this response occurrence to its exact consumer.
         */
        const record: ProducerRecord<Judgment> = {
          consumer: identity,
          description: Object.freeze({
            kind: claim.kind,
            instructionAuthority: 'not-established',
            humanWitness: 'not-established',
            judgmentBudgetAtRequest: 'not-created'
          }),
          ambiguous: false
        };
        /**
         Original handle performs the actual SDK request for this consumer.
         */
        const returned = await handle({
          model,
          context,
          options
        });
        if ((!reference(returned)) || ((typeof returned.result) !== 'function')
          || ((typeof returned[Symbol.asyncIterator]) !== 'function')) throw new RequestProducerError('Producer consumer did not return a result-bearing stream');
        /**
         Previous stream record exposes reuse across producer invocations.
         */
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
        /**
         Original result method is retained before this stream's tracked replacement.
         */
        const originalResult = returned.result
          .bind(returned);
        returned.result = async function producerResult(): Promise<ProducerResponse> {
          /**
           Original response occurrence is retained before its identity checks.
           */
          const response = await originalResult();
          if (!reference(response)) {
            record.ambiguous = true;
            throw new RequestProducerError('Producer stream returned no response object');
          }
          if ((record.response !== undefined) && (record.response !== response)) {
            record.ambiguous = true;
            throw new RequestProducerError('Producer stream changed its response object');
          }
          /**
           Previous response record exposes reuse across producer invocations.
           */
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
    /**
     Original stream callback is registered once for this consumer identity.
     */
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

   @param handle - original request handle for this consumer

   @param construct - original owned judgment constructor

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

   @param kind - original request kind for this invocation

   @param stream - original bound consumer stream callback

   @param model - original SDK model for this request

   @param context - original SDK transcript context

   @param options - original SDK stream options for this request

   @returns original producer stream for this invocation

   @throws RequestProducerError when the stream is unbound or its options are not an owned plain record
   */
  async function invoke({
    kind,
    stream,
    model,
    context,
    options
  }: ProducerIssuance): Promise<ProducerStream> {
    /**
     Original consumer lookup authenticates this stream callback without traps.
     */
    const consumer = (typeof stream) === 'function' ? consumers.get(stream) : undefined;
    if (!consumer) throw new RequestProducerError('Native producer stream is not bound to this issuer');
    if ((options !== undefined) && ((options === null) || ((typeof options) !== 'object')
      || Array.isArray(options)
      || (![
        Object.prototype,
        null
      ].includes(Object.getPrototypeOf(options))))) throw new RequestProducerError('Native request options must be an owned plain record');
    for (const key of Reflect.ownKeys(options ?? {})) {
      /**
       Original own descriptor proves the option key is a visible data property.
       */
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
    /**
     Stamped options freeze this claim's exact request occurrence.
     */
    const stamped = Object.freeze({ ...options });
    /**
     Claim closes when this invocation's scope exits on every path.
     */
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
    /**
     Invocation scope closes this claim on every exit path.
     */
    using invocationScope = {
      [Symbol.dispose](): void {
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
    beginJudgment: judgmentLifecycle.beginJudgment,
    completeJudgment: judgmentLifecycle.completeJudgment,
    judgmentFor: judgmentLifecycle.judgmentFor
  });
}
