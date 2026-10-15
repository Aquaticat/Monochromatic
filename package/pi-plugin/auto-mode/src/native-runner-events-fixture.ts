/**
 Independent event consumer separates original recorder, host, and transport boundaries. @module
 */
import assert from 'node:assert/strict';
import type {
  EventCall,
  EventControl,
  EventFixture,
  EventInput,
  EventModule
} from './native-runner-events-fixture-types.ts';

/** Require the built export before using its independent consumer signature.
 @param value - built native namespace
 @returns narrowed original native event factory
 *
 @throws Error when the original event factory is absent
 */
function assertEventModule(value: unknown): asserts value is EventModule {
  if ((value === null) || ((typeof value) !== 'object')
    || (!('createProgramRunnerEvents' in value))
    || ((typeof value.createProgramRunnerEvents) !== 'function')) throw new Error('Built runner events are unavailable');
}
/**
 Consumers load the emitted artifact through the native loader.
 */
const loaded: unknown = await import(new URL(
  '../dist/native/contract/collector/program-rule-batch-sdk-copy-v2/input/program-runner-events.ts',
  import.meta.url
).href);
assertEventModule(loaded);
/**
 Explicit narrowing survives delayed fixture invocation.
 */
export const eventModule: EventModule = loaded;

//region Test-owned observations distinguish record publication from awaited host publication.
/** Construct original callbacks with independent recorder and ticket observations.
 @returns fixture with independently owned calls, records, events, and failure controls
 *
 @example createRunnerEventsFixture();
 */
export function createRunnerEventsFixture(): EventFixture {
  /**
   Ordered observations include transport settlement after asynchronous event delivery.
   */
  const steps: string[] = [];
  /**
   Host events preserve the actual payload objects received.
   */
  const events: unknown[] = [];
  /**
   Recorder arguments retain original call, record, and usage identities.
   */
  const recordings: unknown[][] = [];
  /**
   Ticket observations distinguish reverse-order member completion.
   */
  const resolutions: unknown[][] = [];
  /**
   Host delivery can remain pending or fail with a non-Error original value.
   */
  const control: EventControl = {
    failure: Object.freeze({ original: 'failure' }),
    barrier: Promise.withResolvers<void>(),
    record: Object.freeze({ original: 'record' })
  };
  /** Observe each callback before a selected failure or caller-side publication.
   @param point - externally observable callback boundary
   *
   @throws Error when the selected fixture callback fails
   */
  function step(point: string): void {
    steps.push(point);
    control.onStep?.(point);
    if (control.failAt === point) throw control.failure;
  }
  /**
   Recorder methods assert their original receiver instead of accepting detached invocations.
   */
  const recorder: EventInput['bound']['scope']['recorder'] = {
    start(call: EventCall): unknown {
      assert.equal(
        this,
        recorder
      );
      recordings.push([
        'start',
        call
      ]);
      step('start');
      return control.record;
    },
    finish(
      record: unknown,
      isError: boolean,
      text: string
    ): void {
      assert.equal(
        this,
        recorder
      );
      recordings.push([
        'finish',
        record,
        isError,
        text
      ]);
      step('finish');
    },
    addUsage(usage: unknown): void {
      assert.equal(
        this,
        recorder
      );
      recordings.push([
        'usage',
        usage
      ]);
      step('usage');
    }
  };
  /**
   Host methods verify receiver identity and can delay event completion independently.
   */
  const host: EventInput['runner']['host'] = {
    async emit(event): Promise<void> {
      assert.equal(
        this,
        host
      );
      events.push(event);
      step(event.type);
      if (control.waitAt === event.type) await control.barrier
        .promise;
      step(`${event.type}:done`);
    }
  };
  /**
   Calls share a tool name so only native identifier association can select their tickets.
   */
  const calls: EventCall[] = [
    'parent/1',
    'parent/2'
  ].map(function call(id) {
    return {
      type: 'toolCall',
      id,
      name: 'same',
      arguments: Object.freeze({ id })
    };
  });
  /**
   Member tickets have distinct observable callbacks and original method receivers.
   */
  const tickets = calls.map(function ticketFor(
    call,
    index
  ) {
    /**
     Original ticket identity remains observable when its resolver is invoked.
     */
    const ticket = {
      resolve(outcome: unknown): void {
        assert.equal(
          this,
          ticket
        );
        resolutions.push([
          index,
          outcome
        ]);
        step(`resolve:${call.id}`);
      }
    };
    return ticket;
  });
  /**
   Original map allocation belongs to the execution owner, not the event factory.
   */
  const input: EventInput = {
    runner: { host },
    bound: {
      scope: { recorder },
      ordinals: new Map([['parent/1', 0], ['parent/2', 1]]),
      tickets
    },
    records: new Map(),
    parentId: 'parent'
  };
  /**
   Built callbacks retain the original fixture input identities.
   */
  const callbacks = eventModule.createProgramRunnerEvents(input);
  return {
    steps,
    events,
    recordings,
    resolutions,
    control,
    calls,
    input,
    callbacks
  };
}
//endregion
