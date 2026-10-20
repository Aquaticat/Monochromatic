import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { contextRoot, } from '@monochromatic-dev/translation-repair-typography/ts';
import {
  isSuccessStatus,
  errorName,
} from '@monochromatic-dev/translation-repair-markup/ts';
import {
  type ModelTransport,
  ProviderHttpError,
} from '@monochromatic-dev/translation-repair-provider-stream/ts';
import { neuralWattQuotaUrlFor, } from './neuralwatt-catalog.ts';
import {
  type NeuralWattPlanSpend,
  type NeuralWattQuota,
  parseNeuralWattQuota,
  planSpendBetween,
} from './neuralwatt-quota.ts';
import {
  exchangeWithRetry,
  type RetryPolicy,
} from './transient-retry.ts';

//region NeuralWatt quota session
// THE TWO QUOTA READINGS OF ONE RUN: a baseline before the first NeuralWatt
// call and the reading at the end, whose difference is the plan energy spent
// (`neuralwatt-quota.ts` says what that figure can and cannot see).
//
// THE BASELINE IS TAKEN LAZILY, once, before the first call goes out, so a run
// that never reaches NeuralWatt (a start guard, a held model, the provider
// dry) reads the quota zero times, and the end-of-run report says it has no
// starting reading rather than inventing one. A READING THAT FAILS NEVER
// BLOCKS A CALL: the quota is a report on the owner's plan, and the ledger and
// the cost-comment backstop are what keep calls off it. The failure is
// warned, with the endpoint's status or the shape complaint, and the run's
// end report says why it has nothing to compare.

/**
 Logger root for the quota session.
 */
const l = contextRoot({ tag: 'translation-repair', },);

/**
 Whether the starting reading was taken, and what it said.

 @example
 ```ts
 const outcome: BaselineOutcome = { taken: false, };
 ```
 */
type BaselineOutcome =
  | {
    readonly taken: true;
    readonly quota: NeuralWattQuota;
  }
  | {
    readonly taken: false;
  };

/**
 Quota reads of one client.

 @example
 ```ts
 const session = createNeuralWattQuotaSession({ headers, baseUrl, transport, retryPolicy, },);
 ```
 */
export type NeuralWattQuotaSession = {
  /**
   Takes the starting reading if it has not been tried; never throws for a
   failed read.
   */
  readonly ensureBaseline: (args: { readonly signal: AbortSignal; },) => Promise<void>;

  /**
   Reads the quota again and compares it with the starting reading.
   */
  readonly planSpend: (args: { readonly signal: AbortSignal; },) => Promise<NeuralWattPlanSpend>;
};

/**
 Builds the quota session of one client.

 @param headers - request headers, auth included
 
 @param baseUrl - API base address
 
 @param transport - HTTP the reads go over
 
 @param retryPolicy - transient-retry pacing

 @returns Session surface

 @example
 ```ts
 const session = createNeuralWattQuotaSession({ headers, baseUrl, transport, retryPolicy, },);
 ```
 */
export function createNeuralWattQuotaSession(
  {
    headers,
    baseUrl,
    transport,
    retryPolicy,
  }: {
    readonly headers: Readonly<Record<string, string>>;
    readonly baseUrl: string;
    readonly transport: ModelTransport;
    readonly retryPolicy: RetryPolicy;
  },
): NeuralWattQuotaSession {
  /**
   What the session holds: the starting reading once taken, and whether the
   taking has been tried.
   */
  const state: {
    attempt?: Promise<BaselineOutcome>;
  } = {};

  /**
   Reads the quota once.

   @param signal - abort signal for the read

   @returns The reading

   @throws {@link ProviderHttpError} on a non-success status

   @throws {@link import('./neuralwatt-quota.ts').NeuralWattQuotaShapeError} on a body that is not the documented shape
   */
  async function readQuota({ signal, }: { readonly signal: AbortSignal; },): Promise<NeuralWattQuota> {
    /**
     Reply from the quota endpoint.
     */
    const reply = await exchangeWithRetry({
      provider: 'neuralwatt',
      transport,
      exchange: {
        url: neuralWattQuotaUrlFor({ baseUrl, },),
        label: 'quota',
        method: 'GET',
        headers,
        signal,
      },
      policy: retryPolicy,
    },);
    if (!isSuccessStatus({ status: reply.status, },))
      throw new ProviderHttpError({
        provider: 'neuralwatt',
        status: reply.status,
        bodyText: reply.bodyText,
        summary: `NeuralWatt /quota returned HTTP ${String(reply.status,)}:`,
      },);
    return parseNeuralWattQuota({ bodyText: reply.bodyText, },);
  }

  /**
   Reads the quota for the baseline, saying so when it cannot.

   @param signal - abort signal for the read

   @returns The reading, or that none was taken
   */
  async function tryBaseline({ signal, }: { readonly signal: AbortSignal; },): Promise<BaselineOutcome> {
    /**
     Logger pre-tagged with this function's name.
     */
    const rl = tagged({
      tag: tryBaseline.name,
      l,
    },);
    try {
      /**
       The starting reading.
       */
      const quota = await readQuota({ signal, },);
      rl.info(
        `NeuralWatt quota at the start of the run: ${
          (quota.subscription
            ?.kwhUsed
            === undefined)
            ? 'no energy charged to a plan is reported'
            : `${String(quota.subscription
              .kwhUsed,)} kWh charged this period`
        }`,
      );
      return {
        taken: true,
        quota,
      };
    }
    catch (error) {
      rl.warn(
        `NeuralWatt quota could not be read before the first call (${errorName({ error, },)}); the run goes on, `
          + 'and its end report will have no starting reading to compare with',
      );
      return { taken: false, };
    }
  }

  /**
   Takes the starting reading if it has not been tried.

   @param signal - abort signal for the read
   */
  async function ensureBaseline({ signal, }: { readonly signal: AbortSignal; },): Promise<void> {
    state.attempt ??= tryBaseline({ signal, },);
    await state.attempt;
  }

  /**
   Reads the quota again and compares it with the starting reading.

   @param signal - abort signal for the read

   @returns The difference, or why there is none
   */
  async function planSpend({ signal, }: { readonly signal: AbortSignal; },): Promise<NeuralWattPlanSpend> {
    /**
     Logger pre-tagged with this function's name.
     */
    const rl = tagged({
      tag: planSpend.name,
      l,
    },);
    if (state.attempt === undefined)
      return {
        kind: 'not-comparable',
        reason: 'the run made no NeuralWatt call, so no starting reading was taken',
      };

    /**
     The starting reading, if it could be taken.
     */
    const before = await state.attempt;
    if (!before.taken)
      return {
        kind: 'not-comparable',
        reason: 'the starting reading could not be taken',
      };
    try {
      return planSpendBetween({
        before: before.quota,
        after: await readQuota({ signal, },),
      },);
    }
    catch (error) {
      rl.warn(`NeuralWatt quota could not be read at the end of the run (${errorName({ error, },)})`,);
      return {
        kind: 'not-comparable',
        reason: 'the reading at the end of the run could not be taken',
      };
    }
  }

  return {
    ensureBaseline,
    planSpend,
  };
}

//endregion NeuralWatt quota session
