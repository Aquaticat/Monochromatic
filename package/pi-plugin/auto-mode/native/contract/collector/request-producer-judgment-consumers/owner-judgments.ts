/**
 Judgment reservation,
construction and completion retain one discriminated slot per response. @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import {
  RequestProducerError,
  reference
} from './owner-errors.ts';
import type {
  JudgmentConstructor,
  JudgmentSlot,
  ProducerIdentity,
  ProducerJudgmentEntry,
  ProducerRecord
} from './owner-types.ts';

/**
 Judgment lifecycle keeps the exact reservation, construction and completion branches
 beside the producer record tables it authenticates through.

 @param logger - original producer diagnostics logger

 @param now - original owned start clock for judgment deadlines

 @param responseRecord - original unambiguous record reader

 @param ownedResponseRecord - original owned record reader

 @returns original judgment reservation, lookup and completion operations

 @example
 ```ts
 const judgmentLifecycle = createJudgmentLifecycle({ logger, now, createJudgment, responseRecord, ownedResponseRecord });
 ```
 */
export function createJudgmentLifecycle<Judgment>({
  logger,
  now,
  responseRecord,
  ownedResponseRecord
}: {
  readonly logger: ReturnType<typeof tagged>;
  readonly now?: () => number;
  readonly responseRecord: (input: ProducerIdentity) => ProducerRecord<Judgment>;
  readonly ownedResponseRecord: (input: ProducerIdentity) => ProducerRecord<Judgment>;
}): {
  readonly beginJudgment: (input: ProducerJudgmentEntry) => Judgment;
  readonly judgmentFor: (input: ProducerIdentity) => Judgment;
  readonly completeJudgment: (input: ProducerIdentity) => void;
} {
  /**
   Construction reentry is rejected for the whole owner while one entry is open.
   */
  const constructionState = { beginning: false };

  /**
   Release completed evidence without discarding response ownership or reuse tombstones.

   @param slot - original completed judgment slot for one response

   @throws RequestProducerError when the slot has not completed
   */
  function retireJudgment(slot: JudgmentSlot<Judgment>): void {
    /**
     Retirement diagnostics identify the slot without logging judgment contents.
     */
    const rl = tagged({
      tag: retireJudgment.name,
      l: logger
    });
    if (!slot.completed) throw new RequestProducerError('An active producer judgment cannot be retired');
    /**
     Retired state label identifies the released evidence record.
     */
    const retiredStateLabel = slot.state.state;
    rl.debug(`retiring completed producer evidence in state ${retiredStateLabel}`);
    slot.state = { state: 'retired' };
  }

  /**
   Reserve and construct one enclosing judgment for an exact main-agent response.

   @param response - original SDK response object

   @param stream - original bound consumer stream callback

   @param signal - original cancellation signal for this operation

   @param group - original prepared-group context for production judgments

   @returns original constructed judgment record

   @throws RequestProducerError when construction reenters, the response is auxiliary or already reserved, or the constructor result violates its ownership checks
   */
  function beginJudgment({
    response,
    stream,
    signal,
    group
  }: ProducerJudgmentEntry): Judgment {
    if (constructionState.beginning) throw new RequestProducerError('Judgment construction cannot reenter');
    if ((typeof now) !== 'function') throw new RequestProducerError('Owned judgment clock and constructor are unavailable');
    constructionState.beginning = true;
    /**
     Construction scope releases the reentry guard on every exit path.
     */
    using constructionScope = {
      [Symbol.dispose](): void {
        constructionState.beginning = false;
      }
    };
    {
      /**
       Original start clock fixes this judgment's single deadline.
       */
      const startedAt = now();
      if (!Number.isFinite(startedAt)) throw new RequestProducerError('Judgment start clock is not finite');
      /**
       Original producer record authenticates this response before reservation.
       */
      const record = responseRecord({
        response,
        stream
      });
      /**
       Original description kind proves the main-agent response.
       */
      const description = record.description;
      if (description.kind !== 'main-agent') throw new RequestProducerError('Auxiliary request output cannot own a tool judgment');
      /**
       Original consumer owns the judgment constructor for this response.
       */
      const { construct } = record.consumer;
      if ((typeof construct) !== 'function') throw new RequestProducerError('This consumer has no owned judgment constructor');
      if (record.judgment !== undefined) throw new RequestProducerError('Response already reserved its enclosing judgment');
      /**
       New slot starts constructing beside its completion flag.
       */
      const slot: JudgmentSlot<Judgment> = {
        completed: false,
        state: { state: 'constructing' }
      };
      record.judgment = slot;
      /**
       Previous current slot is retired only after its own completion.
       */
      const previous = record.consumer
        .judgments
        .current;
      if (previous?.completed === true) retireJudgment(previous);
      record.consumer
        .judgments
        .current = slot;
      try {
        /**
         Original constructor result must stay an owned frozen plain record.
         */
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
          /**
           Original own descriptor proves the key is a visible data property.
           */
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
        if ((typeof Reflect.get(
          value,
          'then'
        )) === 'function') throw new RequestProducerError('Judgment constructor cannot return an asynchronous result');
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
    /**
     Original reservation is read through its exact unambiguous producer record.
     */
    const slot = responseRecord(input)
      .judgment;
    if (!slot) throw new RequestProducerError('Response has no enclosing judgment reservation');
    /**
     Discriminated state decides the exact rejection or value for this reservation.
     */
    const { state } = slot;
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
    /**
     Completion diagnostics identify the operation without logging judgment contents.
     */
    const cl = tagged({
      tag: completeJudgment.name,
      l: logger
    });
    if (constructionState.beginning) throw new RequestProducerError('Producer judgment completion cannot reenter judgment construction');
    // Completion releases an already owned operation even if later reuse invalidates its authority.
    /**
     Completion releases an already owned operation through its owned record.
     */
    const record = ownedResponseRecord(input);
    /**
     Original description kind proves the main-agent response.
     */
    const completionDescription = record.description;
    if (completionDescription.kind !== 'main-agent') throw new RequestProducerError('Auxiliary request output cannot complete a tool judgment');
    /**
     Absent reservations complete silently because bypassed operations never reserved.
     */
    const slot = record.judgment;
    if (slot === undefined) {
      cl.debug('completing native operation without a judgment reservation');
      return;
    }
    if (slot.completed) throw new RequestProducerError('Producer judgment operation already completed');
    /**
     Settled construction states complete; constructing slots cannot.
     */
    const settledState = slot.state.state;
    if ((settledState !== 'active') && (settledState !== 'failed')) throw new RequestProducerError('Producer judgment construction must settle before operation completion');
    slot.completed = true;
    /**
     Current slot pointer decides whether this completion stays the latest diagnostic.
     */
    const currentSlot = record.consumer
      .judgments
      .current;
    if (currentSlot !== slot) {
      retireJudgment(slot);
      return;
    }
    /**
     Preserved state label identifies the latest completed diagnostic.
     */
    const preservedStateLabel = slot.state.state;
    cl.debug(`preserving latest completed producer diagnostic in state ${preservedStateLabel}`);
  }

  return Object.freeze({
    beginJudgment,
    judgmentFor,
    completeJudgment
  });
}
