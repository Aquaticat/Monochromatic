import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { contextRoot, } from '@monochromatic-dev/translation-repair-typography/ts';
import {
  NEURALWATT_DAY_START_VAR,
  type NeuralWattDayStart,
  neuralWattDayStartAt,
  neuralWattDayStartOfInstant,
} from './neuralwatt-day.ts';
import type { NeuralWattQuotaSession, } from './neuralwatt-quota-session.ts';

//region NeuralWatt day anchor
// WHERE THIS RUN'S DAY STARTS, decided once. The owner, 2026-10-20: "Every neuralwatt day starts at 15:15" (19:15 UTC
// for an owner in America/New_York, EDT). The time of day comes from the quota's `current_period_start` (the baseline
// reading of the run, `neuralwatt-quota-session.ts`), else from the `TRANSLATION_REPAIR_NEURALWATT_DAY_START` setting,
// else not at all: NeuralWatt is then refused for the run, with one warning that names the missing field and both
// remedies. THERE IS NO MIDNIGHT FALLBACK (`neuralwatt-day.ts`).

/**
 Logger root for the anchor decision.
 */
const l = contextRoot({ tag: 'translation-repair', },);

/**
 Where the run's day anchor came from, or that it came from nowhere.

 @example
 ```ts
 const anchor: NeuralWattDayAnchor = { known: false, };
 ```
 */
export type NeuralWattDayAnchor =
  | {
    readonly known: true;

    /**
     Milliseconds after 00:00 UTC the day starts at.
     */
    readonly msOfDay: number;
  }
  | {
    readonly known: false;
  };

/**
 Decides where the run's day starts.

 @param quota - the client's quota session, whose baseline carries `current_period_start`

 @param setting - the day-start setting, empty where the owner set none

 @param now - clock, for naming the day the anchor places now

 @param signal - abort signal for the baseline read

 @returns The anchor, or that none could be learned

 @example
 ```ts
 const anchor = await decideNeuralWattDayAnchor({ quota, setting, now, signal, },);
 ```
 */
export async function decideNeuralWattDayAnchor(
  {
    quota,
    setting,
    now,
    signal,
  }: {
    readonly quota: NeuralWattQuotaSession;
    readonly setting: NeuralWattDayStart;
    readonly now: () => Date;
    readonly signal: AbortSignal;
  },
): Promise<NeuralWattDayAnchor> {
  /**
   Logger pre-tagged with this function's name.
   */
  const rl = tagged({
    tag: decideNeuralWattDayAnchor.name,
    l,
  },);

  /**
   The starting quota reading, which a run takes once.
   */
  const baseline = await quota.ensureBaseline({ signal, },);

  /**
   The quota's period start, if the reading gave one.
   */
  const periodStart = baseline.taken
    ? baseline.quota
      .subscription
      ?.periodStart
    : undefined;

  /**
   Its time of day, empty where the reading gave no instant.
   */
  const fromQuota = (periodStart === undefined) ? {} : neuralWattDayStartOfInstant({ instant: periodStart, },);

  /**
   Where the anchor came from, and its time of day.
   */
  const chosen = (fromQuota.msOfDay !== undefined)
    ? {
      msOfDay: fromQuota.msOfDay,
      source: `the quota's subscription.current_period_start (${String(periodStart,)})`,
    }
    : ((setting.msOfDay === undefined)
      ? undefined
      : {
        msOfDay: setting.msOfDay,
        source: `the ${NEURALWATT_DAY_START_VAR} setting`,
      });
  if (chosen === undefined) {
    rl.warn(
      `NeuralWatt is refused for this run: its day start is unknown, because ${
        baseline.taken
          ? 'the quota reply carries no usable subscription.current_period_start'
          : 'the quota could not be read for subscription.current_period_start'
      } and ${NEURALWATT_DAY_START_VAR} is not set. Either make GET /v1/quota readable with `
        + `subscription.current_period_start, or set ${NEURALWATT_DAY_START_VAR}=HH:MM (UTC; 19:15 for a 15:15 `
        + 'day start in America/New_York during daylight saving time)',
    );
    return { known: false, };
  }

  /**
   First instant of the day the anchor places now.
   */
  const today = neuralWattDayStartAt({
    now: now(),
    msOfDay: chosen.msOfDay,
  },);
  rl.info(
    `NeuralWatt day starts at ${
      new Date(chosen.msOfDay,)
        .toISOString()
        .slice(
          'YYYY-MM-DDT'.length,
          'YYYY-MM-DDTHH:MM:SS.sss'.length,
        )
    } UTC every day, from ${chosen.source}; the current day began ${today.toISOString()}`,
  );
  return {
    known: true,
    msOfDay: chosen.msOfDay,
  };
}

//endregion NeuralWatt day anchor
