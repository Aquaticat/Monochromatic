//region NeuralWatt ledger test support
// A CLOCK A CASE MOVES BY HAND AND THE LEDGER LINES IT WRITES, for the cases
// about the NeuralWatt energy ledger and the client that spends against it.
//
// TEST SUPPORT, NOT PACKAGE SOURCE: the ledger reads time through an injected
// clock, and no case reads the real clock.

/**
 Builds a clock a case moves by hand.

 @param start - ISO 8601 instant the clock starts at

 @returns The clock and a way to set it

 @example
 ```ts
 const { now, setTo, } = handClock({ start: '2026-10-20T12:00:00.000Z', },);
 ```
 */
export function handClock(
  { start, }: { readonly start: string; },
): {
  readonly now: () => Date;
  readonly setTo: (instant: string,) => void;
} {
  /**
   Instant the clock reads now.
   */
  const state = { at: new Date(start,), };
  return {
    now: function now(): Date {
      return new Date(state.at,);
    },
    setTo: function setTo(instant: string,): void {
      state.at = new Date(instant,);
    },
  };
}

/**
 One ledger line as the ledger writes it.

 @param entry - fields of the line

 @returns The line with its newline

 @example
 ```ts
 await appendFile(path, lineOf({ at: '2026-10-20T01:00:00.000Z', model: 'glm-5.3-flash', wh: 1, promptTokens: 10, },),);
 ```
 */
export function lineOf(entry: Readonly<Record<string, unknown>>,): string {
  return `${JSON.stringify(entry,)}\n`;
}

//endregion NeuralWatt ledger test support
