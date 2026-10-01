//region Wall clock stub
// Stands in for the system clock in the cases that set it, the way a person
// or a time daemon does (ledger B78): `Date.now` holds a reading the case
// moves, and disposal puts the real one back. The one file
// `wall-clock-reads.unit.test.ts` lets read the wall clock as a number, since
// replacing it is the point.

/**
 Milliseconds in an hour, the step these cases set the clock by.
 */
export const HOUR_MS = 3_600_000;

/**
 Where a stubbed wall clock starts: 2026-10-01T00:00:00.000Z, a reading no
 process-relative clock comes near.
 */
export const WALL_START_MS = 1_790_812_800_000;

/**
 A wall clock a case sets, restored when its scope ends.
 */
export type WallClockStub = Disposable & {
  /**
   Sets the clock by a signed span, as setting the system time does.

   @param byMs - milliseconds to move it, negative to set it back
   */
  readonly step: ({ byMs, }: { readonly byMs: number; },) => void;
};

/**
 Holds `Date.now` at a reading the case sets, until the scope ends.

 @param atMs - reading the clock holds at first

 @returns The stub, to step and to dispose

 @example
 ```ts
 using wall = stubWallClock({ atMs: WALL_START_MS, },);
 wall.step({ byMs: -HOUR_MS, },);
 ```
 */
export function stubWallClock({ atMs, }: { readonly atMs: number; },): WallClockStub {
  /**
   The real clock, put back on disposal.
   */
  const real = Date.now
    .bind(Date,);

  /**
   The reading the stub holds.
   */
  const reading = { ms: atMs, };
  Date.now = function steppedNow(): number {
    return reading.ms;
  };
  return {
    step({ byMs, },): void {
      reading.ms += byMs;
    },
    [Symbol.dispose](): void {
      Date.now = real;
    },
  };
}

//endregion Wall clock stub
