/** Deterministic test-only provider timelines using a local clock, not shared fake timers. @module */
import { setImmediate as nextTurn, } from 'node:timers/promises';
import type { AssistantMessage, Usage, } from '@earendil-works/pi-ai';
import { ADVISOR_CLOCK_BOUNDARY, runAdvisorOperation, type AdvisorDispatch, type AdvisorOperationOptions, type AdvisorOperationSnapshot, } from '../dist/final/node/index.mjs';

/** Unsettled promises must not advance the local fixture clock until scheduler boundaries are known. */
const NOT_READY: unique symbol = Symbol('fixture/no-ready-outcome');
/** One planned provider attempt. */
export type AttemptPlan = {
  /** Completion delay relative to preparation start. */
  readonly after: number;
  /** Text, including whitespace-only empty-response cases. */
  readonly text?: string;
  /** Terminal provider state. */
  readonly stopReason?: AssistantMessage['stopReason'];
  /** Failure diagnostic. */
  readonly error?: string;
  /** Authentication/preparation delay before the actual dispatch callback. */
  readonly preparationMs?: number;
};
/** Shared synthetic usage makes double-counting observable. */
export const FIXTURE_USAGE: Usage = {
  input: 7, output: 5, reasoning: 3, cacheRead: 2, cacheWrite: 4, totalTokens: 18,
  cost: { input: 1, output: 2, cacheRead: 3, cacheWrite: 4, total: 10, },
};
/** Build terminal synthetic provider data. */
function response(plan: AttemptPlan,): AssistantMessage {
  return {
    role: 'assistant', api: 'faux', provider: 'fixture', model: 'fixture', timestamp: 0,
    stopReason: plan.stopReason ?? 'stop', usage: FIXTURE_USAGE,
    content: [{ type: 'text', text: plan.text ?? '', },],
    ...(plan.error === undefined ? {} : { errorMessage: plan.error, }),
  };
}

/**
 Create one local provider timeline; no actual provider request or global timer mutation occurs.
 @param plans - per-model attempt sequence
 @param events - optional caller actions on the local timeline
 @returns fixture operations and captured dispatch evidence
 */
export function operationFixture({ plans, events = [], }: {
  readonly plans: Readonly<Record<string, readonly AttemptPlan[]>>;
  readonly events?: readonly { readonly at: number; readonly run: () => void; }[];
},) {
  /** Mutable time is local to this fixture. */
  const clock = { value: 0, };
  /** Scheduled provider or caller events. */
  const queue = [...events,];
  /** Every selected model, including rejected preparation. */
  const prepared: string[] = [];
  /** Actual dispatches after the operation's final gate. */
  const dispatched: { model: string; at: number; signal: AbortSignal; }[] = [];
  /** Immutable progress snapshots received by the fixture. */
  const progress: AdvisorOperationSnapshot[] = [];
  /** Injected provider boundary. */
  const complete: AdvisorDispatch = async function complete(input): Promise<AssistantMessage> {
    /** Attempt index before this preparation is recorded. */
    const index = prepared.filter(model => model === input.candidate.model).length;
    prepared.push(input.candidate.model,);
    /** Script for this selected attempt. */
    const plan = plans[input.candidate.model]?.[index];
    if (plan === undefined)
      throw new Error(`fixture missing plan for ${input.candidate.model} attempt ${index + 1}`,);
    /** Preparation start anchors this fixture's completion event. */
    const started = clock.value;
    if (plan.preparationMs !== undefined) {
      /** Locally controlled asynchronous authentication. */
      const ready = Promise.withResolvers<void>();
      queue.push({ at: started + plan.preparationMs, run: (): void => ready.resolve(), },);
      await ready.promise;
    }
    input.onDispatch({ reasoning: 'high', },);
    dispatched.push({ model: input.candidate.model, at: clock.value, signal: input.signal, },);
    input.onUsage(FIXTURE_USAGE,);
    /** Provider may ignore cancellation; settlement is still observed after the operation closes. */
    const pending = Promise.withResolvers<AssistantMessage>();
    queue.push({ at: started + plan.after, run: (): void => pending.resolve(response(plan,),), },);
    return await pending.promise;
  };
  /** Deterministically select a provider event or the scheduler's own deadline. */
  const wait: NonNullable<AdvisorOperationOptions['wait']> = async function wait(options) {
    await nextTurn();
    /** First process notifications already queued by synchronous or microtask work. */
    const settled = await Promise.race([...options.pending, Promise.resolve(NOT_READY,),],);
    if (settled !== NOT_READY)
      return settled;
    queue.sort((left, right) => left.at - right.at,);
    /** Next event may occur after the operation's wakeup boundary. */
    const event = queue[0];
    if (event !== undefined && event.at <= options.untilMs) {
      queue.shift();
      clock.value = event.at;
      event.run();
      await nextTurn();
      return await Promise.race([...options.pending, Promise.resolve(ADVISOR_CLOCK_BOUNDARY,),],);
    }
    clock.value = options.untilMs;
    return ADVISOR_CLOCK_BOUNDARY;
  };
  return {
    dispatched, prepared, progress,
    now: (): number => clock.value,
    async run(options: Partial<Pick<AdvisorOperationOptions, 'hedgeDelayMs' | 'signal' | 'deadlineAtMs'>> = {}): Promise<AdvisorOperationSnapshot> {
      return await runAdvisorOperation({
        candidates: Object.keys(plans,).map(model => ({ model, provider: model.split('/',)[0] ?? 'fixture', contextChars: 20, estimatedInputTokens: 5, truncated: false, })),
        startedAtMs: 0, deadlineAtMs: 200, collectionGraceMs: 30, complete, wait, now: (): number => clock.value,
        onUpdate: (value): void => { progress.push(value,); }, ...options,
      },);
    },
    async flush(): Promise<void> {
      while (queue.length > 0) {
        queue.sort((left, right) => left.at - right.at,);
        /** Finite remaining fixture event. */
        const event = queue.shift();
        if (event === undefined)
          throw new Error('fixture event disappeared',);
        clock.value = event.at;
        event.run();
        await nextTurn();
      }
    },
  };
}
