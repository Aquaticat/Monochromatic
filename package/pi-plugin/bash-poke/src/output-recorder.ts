/**
 Bounded recording of streaming command output.

 @module
 */

import { middleOutFromParts, } from './middle-out.ts';

//region Types

/**
 Poke-ready view of everything recorded for one job.
 */
type OutputSnapshot = {
  /**
   Text to embed in the poke, elided in the middle when it exceeded the budget.
   */
  readonly text: string;

  /**
   Whether the middle was elided.
   */
  readonly truncated: boolean;

  /**
   Characters removed between the kept head and tail.
   */
  readonly elidedChars: number;

  /**
   Characters captured in total, which survives elision.
   */
  readonly totalChars: number;
};

/**
 Bounded recorder fed by output chunks as they arrive.
 
 Memory stays within the head and tail budgets no matter how much a command
 prints, because the complete text is spooled to disk rather than retained.
 */
type OutputRecorder = {
  /**
   Folds one arriving chunk into the bounded buffers.
   */
  readonly append: (chunk: string) => void;

  /**
   Reads the current poke-ready view.
   */
  readonly snapshot: () => OutputSnapshot;

  /**
   Reads the most recent output lines for progress display.
   */
  readonly tailLines: (count: number) => readonly string[];
};

/**
 Mutable counters for one recorder, held together so no function-root binding
 leaks across the closures that read and write them.
 */
type RecorderState = {
  /**
   Characters captured in total, including everything elided.
   */
  totalChars: number;

  /**
   Characters currently held in the rolling window.
   */
  rollingChars: number;

  /**
   Characters currently held in the kept prefix.
   */
  headCharsHeld: number;
};

//endregion Types

//region Buffer trimming

/**
 Drops leading chunks until a rolling buffer fits its character budget.
 
 Only the front is removed, so what survives is always the most recent output.
 The walk is bounded by the chunk count plus one partial cut, which keeps
 trimming linear in the number of chunks rather than in their characters.
 
 @param chunks - rolling buffer, mutated in place
 
 @param chars - current character total of the buffer
 
 @param budget - maximum characters to retain
 
 @returns adjusted character total
 
 @example
 ```ts
 const chunks = ['abcd', 'efgh'];
 trimRollingBuffer({ chunks, chars: 8, budget: 5, },);
 ```
 */
function trimRollingBuffer(
  {
    chunks,
    chars,
    budget,
  }: {
    readonly chunks: string[];
    chars: number;
    readonly budget: number;
  },
): number {
  /**
   Running total, reduced by every dropped or shortened chunk.
   */
  let total = chars;
  while (total > budget) {
    /**
     Oldest retained chunk, the only place a boundary cut can be needed.
     */
    const [oldest] = chunks;
    if (oldest === undefined)
      break;

    /**
     Characters that must go to reach the budget.
     */
    const excess = total - budget;
    if (oldest.length > excess) {
      chunks[0] = oldest.slice(excess, );
      total -= excess;
      break;
    }
    total -= oldest.length;
    chunks.shift();
  }
  return total;
}

//endregion Buffer trimming

//region Recorder

/**
 Creates a bounded recorder for one job's output.
 
 @param headChars - characters kept from the start
 
 @param tailChars - characters kept from the end
 
 @returns recorder fed by chunks and read on demand
 
 @example
 ```ts
 const recorder = createOutputRecorder({ headChars: 2, tailChars: 3, },);
 recorder.append('abcdefghij');
 recorder.snapshot();
 ```
 */
function createOutputRecorder(
  {
    headChars,
    tailChars,
  }: {
    readonly headChars: number;
    readonly tailChars: number;
  },
): OutputRecorder {
  /**
   Combined budget; output within it is reproduced exactly.
   */
  const budget = headChars + tailChars;

  /**
   Chunks forming the kept prefix.
   */
  const headChunks: string[] = [];

  /**
   Chunks forming the rolling suffix window.
   */
  const rollingChunks: string[] = [];

  /**
   Counters shared by append, snapshot, and tailLines.
   */
  const state: RecorderState = {
    totalChars: 0,
    rollingChars: 0,
    headCharsHeld: 0,
  };

  return {
    append(chunk: string, ): void {
      if (chunk.length === 0)
        return;
      state.totalChars += chunk.length;

      if (state.headCharsHeld < headChars) {
        /**
         Prefix room left, so the chunk is cut only when it overflows that room.
         */
        const room = headChars - state.headCharsHeld;

        /**
         Part of the chunk that still fits in the kept prefix.
         */
        const kept = chunk.slice(
          0,
          room,
        );
        headChunks.push(kept, );
        state.headCharsHeld += kept.length;
      }

      rollingChunks.push(chunk, );
      state.rollingChars += chunk.length;
      state.rollingChars = trimRollingBuffer({
        chunks: rollingChunks,
        chars: state.rollingChars,
        budget,
      }, );
    },

    snapshot(): OutputSnapshot {
      /**
       Rolling window text, which is the complete output when it all fit.
       */
      const rolling = rollingChunks.join('', );
      if (state.totalChars <= budget)
        return {
          text: rolling,
          truncated: false,
          elidedChars: 0,
          totalChars: state.totalChars,
        };

      /**
       Kept prefix text.
       */
      const head = headChunks.join('', );

      /**
       Kept suffix text, taken from the rolling window's end.
       */
      const tail = rolling.slice(rolling.length - tailChars, );

      /**
       Characters the elision marker must account for.
       */
      const elidedChars = state.totalChars - head.length
        - tail.length;
      return {
        text: middleOutFromParts({
          head,
          tail,
          elidedChars,
        }, ),
        truncated: true,
        elidedChars,
        totalChars: state.totalChars,
      };
    },

    tailLines(count: number, ): readonly string[] {
      if (count <= 0)
        return [];

      /**
       Rolling window split into lines, the freshest last.
       */
      const lines = rollingChunks.join('', )
        .split('\n', );
      return lines.slice(Math.max(
        lines.length - count,
        0,
      ), );
    },
  };
}

//endregion Recorder

export {
  createOutputRecorder,
  trimRollingBuffer,
};

export type {
  OutputRecorder,
  OutputSnapshot,
  RecorderState,
};
