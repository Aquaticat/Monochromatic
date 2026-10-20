import { isJsonRecord, } from '@monochromatic-dev/translation-repair-document-structure/ts';

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

/**
 One JSON object read from text, for cases that look inside a ledger line or a
 request body.

 @param text - JSON text

 @returns The object

 @throws {@link Error} when the text is not a JSON object

 @example
 ```ts
 const entry = jsonRecordOf({ text: (await readFile(path, 'utf8',)).trim(), },);
 ```
 */
export function jsonRecordOf({ text, }: { readonly text: string; },): Readonly<Record<string, unknown>> {
  /**
   Parsed text, unknown until checked.
   */
  const parsed: unknown = JSON.parse(text,);
  if (!isJsonRecord(parsed,))
    throw new Error('the fixture text is not a JSON object',);
  return parsed;
}

/**
 Lines written to the console's info and warn channels while a body runs,
 restored when it ends however it ends.

 @param run - body to run

 @returns The lines, in order

 @example
 ```ts
 const lines = await consoleLinesDuring({ run: async () => { await ask({ client, },); }, },);
 ```
 */
export async function consoleLinesDuring({ run, }: { readonly run: () => Promise<void>; },): Promise<readonly string[]> {
  /**
   Lines received.
   */
  const lines: string[] = [];

  /**
   The info channel as it was.
   */
  const informed = console.info;

  /**
   The warn channel as it was.
   */
  const warned = console.warn;

  /**
   Keeps what a channel is handed first, which is the whole line the tagged
   logger writes.

   @param line - what was logged
   */
  function keep(line: unknown,): void {
    lines.push(String(line,),);
  }

  /**
   Puts both channels back.
   */
  function putBack(): void {
    console.info = informed;
    console.warn = warned;
  }
  console.info = keep;
  console.warn = keep;

  /**
   Restores the channels when this function ends however it ends.
   */
  using restore = { [Symbol.dispose]: putBack, };
  void restore;
  await run();
  return lines;
}

//endregion NeuralWatt ledger test support
