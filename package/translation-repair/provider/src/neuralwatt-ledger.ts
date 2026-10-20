import {
  appendFile,
  mkdir,
} from 'node:fs/promises';
import { homedir, } from 'node:os';
import { dirname, } from 'node:path';

import { tagged, } from '@monochromatic-dev/module-logger/ts';

import {
  contextRoot,
  readTextOrEmptyIfMissing,
} from '@monochromatic-dev/translation-repair-typography/ts';
import type { NeuralWattEnergy, } from './neuralwatt-energy.ts';
import {
  neuralWattDailyWhFrom,
  neuralWattLedgerPathFrom,
} from './neuralwatt-ledger-config.ts';
import {
  type NeuralWattLedgerEntry,
  neuralWattEntryOf,
  type NeuralWattReckoning,
} from './neuralwatt-ledger-entry.ts';

//region NeuralWatt ledger
// THE METER FOR THE DAILY FREE ENERGY, kept here because nobody else keeps it.
//
// The owner, 2026-10-20: "I just added TRANSLATION_REPAIR_NEURALWATT_API_KEY .
// It includes 550Wh of energy on DeepSeek V4.1 Flash and GLM 5.3 Flash per
// day. And we need to meter (using estimations) ourselves because overage eats
// into my normal plan which I use for other stuff." No API reports what is
// left of the free energy (`https://docs.neuralwatt.com/billing/daily-free-energy`,
// fetched 2026-10-20: "There's no API that reports how much free energy you
// have left today"), so every settled call appends one line to a durable file
// and the meter is the day's allowance minus the lines stamped on today's UTC
// date, minus the holds of calls still in flight.
//
// THREE KINDS OF LINE. A MEASURED line carries the `: energy` figure the stream
// reported. An ESTIMATED line carries the estimate, marked, for a call whose
// stream reported none, or an attempt that failed after delivering something.
// A BILLED line carries `billedUsd` above zero: the request left the free
// energy and came out of the owner's plan, so the provider reads dry for the
// rest of the UTC day whatever the sum says.
//
// THE IN-FLIGHT HOLD. Calls run many at a time and a call's true energy is
// known only when its stream ends. A call therefore holds its estimate from
// before it is sent until it settles; the check against the day and the taking
// of the hold happen with no await between them, so concurrent calls cannot all
// read the same remainder. THE HOLD LIVES IN THIS PROCESS ONLY. A second
// process on the same ledger (a budget sample beside a pass) sees the file's
// lines and not this process's holds, so two processes can each spend what
// the other holds; the margin and the billed mark bound that, nothing else
// does, and the record says so.
//
// THE DAY IS THE UTC DATE of a line's `at`, read by instant, so an entry
// stamped with an offset lands where it belongs and a run that crosses 00:00
// UTC sees the allowance come back.

/**
 Logger root for the ledger.
 */
const l = contextRoot({ tag: 'translation-repair', },);

/**
 Decimals the day's figures are logged to: a call is a few thousandths of a
 watt-hour.
 */
const LOG_DECIMALS = 4;

/**
 Raised when a reservation is settled twice: the call it stood for is over.

 @example
 ```ts
 throw new NeuralWattReservationSettledError();
 ```
 */
export class NeuralWattReservationSettledError extends Error {
  /**
   Declares this message safe to forward: it is one authored sentence.
   */
  readonly messageNamesOnly: true = true;

  /**
   Says the reservation was already settled.

   @example
   ```ts
   new NeuralWattReservationSettledError();
   ```
   */
  public constructor() {
    super('a NeuralWatt energy reservation was settled twice; the call it stood for is already in the ledger',);
    this.name = 'NeuralWattReservationSettledError';
  }
}

/**
 What a call reports when it settles.

 @example
 ```ts
 const settlement: NeuralWattSettlement = { measuredWh: 0.015, billedUsd: 0, };
 ```
 */
export type NeuralWattSettlement = {
  /**
   Energy the stream reported, in watt-hours; absent when it reported none,
   and the estimate then stands, marked.
   */
  readonly measuredWh?: number;

  /**
   USD the request was billed; above zero marks the day billed.
   */
  readonly billedUsd?: number;
};

/**
 The energy one call holds while in flight.

 @example
 ```ts
 await reservation.settle({ measuredWh: 0.015, },);
 ```
 */
export type NeuralWattReservation = {
  /**
   Watt-hours the call holds.
   */
  readonly estimateWh: number;

  /**
   Appends the call's line, then releases the hold, even when the append
   fails.

   @throws {@link NeuralWattReservationSettledError} when already settled
   */
  readonly settle: (settlement: NeuralWattSettlement,) => Promise<void>;

  /**
   Appends a line at the estimate for an attempt that delivered something and
   failed; the hold stays for the attempt that follows.
   */
  readonly noteAbandoned: () => Promise<void>;

  /**
   Releases the hold without a line; harmless a second time.
   */
  readonly release: () => void;

  /**
   Releases the hold when the reservation goes out of scope, so a call that
   threw before settling gives its energy back.
   */
  readonly [Symbol.dispose]: () => void;
};

/**
 Outcome of asking to send a call.

 @example
 ```ts
 const outcome: NeuralWattReserveOutcome = { granted: false, energy, estimateWh: 0.3, };
 ```
 */
export type NeuralWattReserveOutcome =
  | {
    readonly granted: true;
    readonly reservation: NeuralWattReservation;
  }
  | {
    readonly granted: false;
    readonly energy: NeuralWattEnergy;
    readonly estimateWh: number;
  };

/**
 The ledger surface a client and a meter hold.

 @example
 ```ts
 const energy = await ledger.read();
 ```
 */
export type NeuralWattLedger = {
  /**
   File the lines are appended to.
   */
  readonly path: string;

  /**
   Reads the day's energy, holds in flight included.
   */
  readonly read: () => Promise<NeuralWattEnergy>;

  /**
   Asks to send a call, holding its estimate when it fits.
   */
  readonly reserve: (
    request: {
      readonly model: string;
      readonly promptTokens: number;
      readonly estimateWh: number;
    },
  ) => Promise<NeuralWattReserveOutcome>;
};

/**
 UTC date of an instant, `YYYY-MM-DD`.

 @param instant - ISO 8601 text or a date

 @returns The date in UTC

 @example
 ```ts
 utcDayOf({ instant: '2026-10-20T22:30:00.000-04:00', },); // '2026-10-21'
 ```
 */
function utcDayOf({ instant, }: { readonly instant: string | Date; },): string {
  return new Date(instant,).toISOString()
    .slice(
      0,
      'YYYY-MM-DD'.length,
    );
}

/**
 The system clock, the ledger's time outside a test.

 @returns The current instant

 @example
 ```ts
 const now = systemClock();
 ```
 */
function systemClock(): Date {
  return new Date();
}

/**
 Builds the ledger over one file and one allowance.

 @param path - ledger file, created on the first line

 @param dailyWh - free energy a UTC day holds

 @param now - clock, injectable so a test moves the day by hand

 @returns Ledger surface

 @example
 ```ts
 const ledger = createNeuralWattLedger({ path, dailyWh: 550, now: () => new Date(), },);
 ```
 */
export function createNeuralWattLedger(
  {
    path,
    dailyWh,
    now,
  }: {
    readonly path: string;
    readonly dailyWh: number;
    readonly now: () => Date;
  },
): NeuralWattLedger {
  /**
   Watt-hours held by calls in flight, by hold.
   */
  const holds = new Set<{ readonly wh: number; }>();

  /**
   Appends one line, creating the directory on the way.

   @param entry - the call's line
   */
  async function note(entry: NeuralWattLedgerEntry,): Promise<void> {
    await mkdir(
      dirname(path,),
      { recursive: true, },
    );
    await appendFile(
      path,
      `${JSON.stringify(entry,)}\n`,
      'utf8',
    );
  }

  /**
   The file's lines of today, in order.

   @returns Entries stamped with today's UTC date
   */
  async function todaysEntries(): Promise<readonly NeuralWattLedgerEntry[]> {
    /**
     Whole file, or nothing where none exists yet.
     */
    const text = await readTextOrEmptyIfMissing({ path, },);

    /**
     UTC date the file is read for.
     */
    const today = utcDayOf({ instant: now(), },);
    return text
      .split('\n',)
      .flatMap(function toEntry(
        lineText,
        index,
      ): readonly NeuralWattLedgerEntry[] {
        if (lineText.trim() === '')
          return [];
        return [neuralWattEntryOf({
          path,
          text: lineText.trim(),
          line: index + 1,
        },),];
      },)
      .filter(function isToday(entry,): boolean {
        return utcDayOf({ instant: entry.at, },) === today;
      },);
  }

  /**
   The day's reading from the lines read and the holds as they stand NOW.

   @param entries - today's lines

   @returns Reading with the holds in flight at this moment
   */
  function energyFrom({ entries, }: { readonly entries: readonly NeuralWattLedgerEntry[]; },): NeuralWattEnergy {
    /**
     Everything the lines say was spent.
     */
    const spentWh = entries.reduce(
      function addWh(
        running,
        entry,
      ): number {
      return running + entry.wh;
    },
      0,
    );

    /**
     The part of that which is an estimate.
     */
    const reckonedWh = entries.reduce(
      function addReckoned(
        running,
        entry,
      ): number {
      return (entry.estimated === undefined) ? running : (running + entry.wh);
    },
      0,
    );

    /**
     Watt-hours held by calls in flight.
     */
    const reservedWh = [...holds,].reduce(
      function addHold(
        running,
        hold,
      ): number {
      return running + hold.wh;
    },
      0,
    );
    return {
      day: utcDayOf({ instant: now(), },),
      dailyWh,
      spentWh,
      reckonedWh,
      reservedWh,
      remainingWh: dailyWh - spentWh
        - reservedWh,
      billedToday: entries.some(function isBilled(entry,): boolean {
        return entry.billedUsd !== undefined;
      },),
      calls: entries.length,
    };
  }

  /**
   Reads the day's energy.

   @returns Reading, holds in flight included
   */
  async function read(): Promise<NeuralWattEnergy> {
    /**
     Logger pre-tagged with this function's name.
     */
    const rl = tagged({
      tag: read.name,
      l,
    },);

    /**
     Today's lines.
     */
    const entries = await todaysEntries();

    /**
     The reading.
     */
    const energy = energyFrom({ entries, },);
    rl.debug(
      `${path}: ${String(energy.calls,)} calls on ${energy.day} (UTC), ${energy.spentWh
        .toFixed(LOG_DECIMALS,)} Wh `
        + `spent of ${String(dailyWh,)} (${energy.reckonedWh
          .toFixed(LOG_DECIMALS,)} of it estimated), ${energy.reservedWh
            .toFixed(LOG_DECIMALS,)} Wh held, ${energy.remainingWh
              .toFixed(LOG_DECIMALS,)} Wh left${energy.billedToday ? ', a request was billed today' : ''}`,
    );
    return energy;
  }

  /**
   Asks to send a call.

   @param model - model the call is for
   
   @param promptTokens - prompt tokens the estimate was drawn for
   
   @param estimateWh - energy the call would hold

   @returns A reservation when the call fits, else the reading it was refused on
   */
  async function reserve(
    {
      model,
      promptTokens,
      estimateWh,
    }: {
      readonly model: string;
      readonly promptTokens: number;
      readonly estimateWh: number;
    },
  ): Promise<NeuralWattReserveOutcome> {
    /**
     Logger pre-tagged with this function's name.
     */
    const rl = tagged({
      tag: reserve.name,
      l,
    },);

    /**
     Today's lines, read BEFORE the check so the check that follows has no await
     between it and the taking of the hold.
     */
    const entries = await todaysEntries();

    // NO AWAIT FROM HERE TO THE HOLD BEING TAKEN: the reading below counts the
    // holds as they stand at this instant, so a call that read the file at
    // the same time as this one and was decided first has its hold counted.
    /**
     The day's reading with the holds as they stand NOW.
     */
    const energy = energyFrom({ entries, },);
    if (energy.billedToday || (energy.remainingWh < estimateWh)) {
      rl.info(
        `${model}: refused before sending, estimate ${estimateWh.toFixed(LOG_DECIMALS,)} Wh, ${energy.remainingWh
          .toFixed(LOG_DECIMALS,)} Wh left on ${energy.day} (UTC)${energy.billedToday ? ', a request was billed today' : ''}`,
      );
      return {
        granted: false,
        energy,
        estimateWh,
      };
    }

    /**
     This call's hold.
     */
    const hold = { wh: estimateWh, };
    holds.add(hold,);

    /**
     Whether the call has been settled.
     */
    const state = { settled: false, };

    /**
     Line for this call at a given reckoning.

     @param wh - watt-hours the line carries
     
     @param estimated - why they are an estimate, absent for a measurement
     
     @param billedUsd - USD billed, when above zero

     @returns The entry
     */
    function entryFor(
      {
        wh,
        estimated,
        billedUsd,
      }: {
        readonly wh: number;
        readonly estimated?: NeuralWattReckoning;
        readonly billedUsd?: number;
      },
    ): NeuralWattLedgerEntry {
      return {
        at: now()
          .toISOString(),
        model,
        wh,
        promptTokens,
        ...((estimated === undefined) ? {} : { estimated, }),
        ...(((billedUsd === undefined) || (!(billedUsd > 0))) ? {} : { billedUsd, }),
      };
    }

    /**
     Gives the hold back; harmless a second time.
     */
    function release(): void {
      state.settled = true;
      holds.delete(hold,);
    }

    /**
     Appends the call's line at its settlement, then releases the hold.

     @param measuredWh - energy the stream reported, absent when it reported none
     
     @param billedUsd - USD the request was billed

     @throws {@link NeuralWattReservationSettledError} when already settled
     */
    async function settle({
      measuredWh,
      billedUsd,
    }: NeuralWattSettlement,): Promise<void> {
      if (state.settled)
        throw new NeuralWattReservationSettledError();
      state.settled = true;

      // THE HOLD IS RELEASED WHETHER OR NOT THE LINE WAS WRITTEN: a failed write
      // must leave no phantom spend in flight.
      /**
       Releases the hold when this function ends.
       */
      using releasing = { [Symbol.dispose]: release, };
      void releasing;
      await note(entryFor({
        wh: measuredWh ?? estimateWh,
        ...((measuredWh === undefined) ? { estimated: 'unreported-estimate' as const, } : {}),
        ...((billedUsd === undefined) ? {} : { billedUsd, }),
      },),);
    }

    /**
     Appends a line at the estimate for an attempt that delivered something
     and failed; the hold stays for the attempt that follows.
     */
    async function noteAbandoned(): Promise<void> {
      await note(entryFor({
        wh: estimateWh,
        estimated: 'abandoned-estimate',
      },),);
    }

    return {
      granted: true,
      reservation: {
        estimateWh,
        settle,
        noteAbandoned,
        release,
        [Symbol.dispose]: release,
      },
    };
  }

  return {
    path,
    read,
    reserve,
  };
}

/**
 Ledger at the path and allowance the environment names, on the real clock.

 @param env - process environment

 @returns Ledger surface

 @example
 ```ts
 const ledger = neuralWattLedgerFromEnv({ env: process.env, },);
 ```
 */
export function neuralWattLedgerFromEnv({ env, }: { readonly env: Readonly<NodeJS.ProcessEnv>; },): NeuralWattLedger {
  return createNeuralWattLedger({
    path: neuralWattLedgerPathFrom({
      env,
      home: homedir(),
    },),
    dailyWh: neuralWattDailyWhFrom({ env, },),
    now: systemClock,
  },);
}

//endregion NeuralWatt ledger
