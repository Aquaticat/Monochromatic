/**
 What the package's own root logger warned while one piece of work ran, for
 cases whose reader takes no logger and writes through its module's root.

 TEST SUPPORT, NOT PACKAGE SOURCE. The built package carries its own logger,
 whose `warn` sink looks `console.warn` up by name at each write, so the
 divert here is what it calls. That logger is flushed through a root the
 build itself hands out before `console.warn` is put back: its first line in
 a process waits for the sinks to verify, and a line still waiting when the
 divert ended would be printed instead of kept.

 A CASE CALLING THIS RUNS ONE AT A TIME: the divert is process-wide and held
 across an await, so every suite around the case sets `concurrency: 1`
 (`global-writes-sequenced.unit.test.ts`).

 @module
 */

import { contextRoot, } from '../dist/final/node/index.mjs';

/**
 What the console sink writes after its level tag and after its timestamp
 tag, before the message: `[warn] [2026-10-05T00:00:00.000Z] message`.
 */
const TAG_END = '] ';

/**
 Message of one line the console sink wrote, without the level and the
 timestamp it writes first, since a case cannot know the timestamp.

 @param line - one line as the sink printed it

 @returns Everything after the timestamp tag

 @throws Error when the line carries no level and timestamp tags, which the
 sink writes on every line

 @example
 ```ts
 messageOf({ line: '[warn] [2026-10-05T00:00:00.000Z] [whiskers] purr', },);
 // => '[whiskers] purr'
 ```
 */
function messageOf({ line, }: { readonly line: string; },): string {
  /**
   Where the level tag ends.
   */
  const levelEnd = line.indexOf(TAG_END,);
  /**
   Where the timestamp tag behind it ends.
   */
  const stampEnd = line.indexOf(
    TAG_END,
    levelEnd + TAG_END.length,
  );
  if ((levelEnd === (-1)) || (stampEnd === (-1)))
    throw new Error(`unreachable: the console sink wrote a line without its level and timestamp tags: ${line}`,);
  return line.slice(stampEnd + TAG_END.length,);
}

/**
 Runs one piece of work with `console.warn` diverted, and hands back what
 the work returned beside every warning the package's root logger wrote
 meanwhile.

 @param run - work that may warn

 @returns What the work returned, and the warnings in the order written,
 each from its first tag on

 @throws whatever the work throws, after `console.warn` is put back

 @example
 ```ts
 const { result, warned, } = await warnLinesDuring({ run: async () => readCachedLookup({ dir, query, },), },);
 ```
 */
export async function warnLinesDuring<ResultT,>(
  { run, }: { readonly run: () => Promise<ResultT>; },
): Promise<{
  readonly result: ResultT;
  readonly warned: readonly string[];
}> {
  /**
   Each text `console.warn` was called with; the sink joins the lines of one
   turn into one call and passes that one text.
   */
  const calls: string[] = [];
  /**
   `console.warn` as it was, put back when this returns or throws.
   */
  const real = console.warn;
  console.warn = function keep(text: unknown,): void {
    calls.push(String(text,),);
  };
  /**
   Puts `console.warn` back when this scope ends, however it ends.
   */
  using _restore = {
    [Symbol.dispose]: function putBack(): void {
      console.warn = real;
    },
  };
  /**
   What the work returned.
   */
  const result = await run();
  await contextRoot({ tag: 'console-warn-lines', },)
    .flush();
  return {
    result,
    warned: calls.flatMap(function linesOf(call,): readonly string[] {
      return call
        .split('\n',)
        .map(function toMessage(line,): string {
          return messageOf({ line, },);
        },);
    },),
  };
}
