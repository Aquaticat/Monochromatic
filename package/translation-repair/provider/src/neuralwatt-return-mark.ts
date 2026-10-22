import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { contextRoot, } from '@monochromatic-dev/translation-repair-typography/ts';

//region NeuralWatt return mark
// WHEN A SPENT NEURALWATT DAY STARTS AGAIN, on the budget layer's monotonic clock, kept beside the cached meter reading
// that named it. A reading replaces the mark, so a return never outlives the reading that named it, and past it the
// budget layer reads the meters again whatever the reading's age (`provider-budget.ts`).

/**
 Logger root for the return mark.
 */
const l = contextRoot({ tag: 'translation-repair', },);

/**
 The return the last meter reading named: none, or the instant on the monotonic clock the day starts again.

 @example
 ```ts
 const mark: ReturnMark = { kind: 'at', at: 49_000, };
 ```
 */
type ReturnMark =
  | {
    /**
     The reading named a return.
     */
    readonly kind: 'at';

    /**
     Instant on the monotonic clock the day starts again.
     */
    readonly at: number;
  }
    | {
    /**
     The reading named none.
     */
      readonly kind: 'none';
    };

/**
 The return of NeuralWatt's spent day, as the last reading named it.

 @example
 ```ts
 const mark: NeuralWattReturnMark = createNeuralWattReturnMark({ now: monotonicMs, boundMs: 300_000, },);
 ```
 */
export type NeuralWattReturnMark = {
  /**
   Replaces the mark with what a meter reading named, logging the wait when it named one.

   @param returnsInMs - how long until the day starts again, absent where the reading named none
   */
  readonly replace: (args: { readonly returnsInMs?: number; },) => void;

  /**
   Whether the day has started again since the reading that named the return.
   */
  readonly passed: () => boolean;

  /**
   Milliseconds left until the day starts again, zero where no return is named or it has passed.
   */
  readonly leftMs: () => number;
};

/**
 Builds the mark of one budget layer.

 @param now - the monotonic clock the budget layer reads

 @param boundMs - the longest return waited for, for the line

 @returns A mark that names no return until a reading names one

 @example
 ```ts
 const returns = createNeuralWattReturnMark({ now, boundMs: 300_000, },);
 ```
 */
export function createNeuralWattReturnMark(
  {
    now,
    boundMs,
  }: {
    readonly now: () => number;
    readonly boundMs: number;
  },
): NeuralWattReturnMark {
  /**
   Logger pre-tagged with this function's name.
   */
  const rl = tagged({
    tag: createNeuralWattReturnMark.name,
    l,
  },);

  /**
   The return the last reading named.
   */
  const held: { current: ReturnMark; } = { current: { kind: 'none', }, };

  return {
    replace: function replace({ returnsInMs, },): void {
      if (returnsInMs === undefined) {
        held.current = { kind: 'none', };
        return;
      }
      held.current = {
        kind: 'at',
        at: now() + returnsInMs,
      };
      rl.info(
        `neuralwatt: the day's energy is spent and its day starts again in ${String(returnsInMs,)}ms, within the `
          + `${String(boundMs,)}ms this run waits for it; held out until then, and read again then`,
      );
    },

    passed: function passed(): boolean {
      return (held.current
        .kind
        === 'at') && (now()
          >= held.current
            .at);
    },

    leftMs: function leftMs(): number {
      return (held.current
        .kind
        === 'at')
        ? Math.max(
          0,
          held.current
            .at
            - now(),
        )
        : 0;
    },
  };
}

//endregion NeuralWatt return mark
