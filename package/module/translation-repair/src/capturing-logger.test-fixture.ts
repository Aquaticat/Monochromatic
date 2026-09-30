import type { Logger, } from '@monochromatic-dev/module-logger/ts';

//region Capturing logger
// A LOGGER THAT KEEPS EVERY LINE, for cases that read what the code under
// test logged.
//
// TEST SUPPORT, NOT PACKAGE SOURCE. Many unit test files carry their own copy
// of this; new cases import this one.

/**
 Drains nothing: every line is kept as it is emitted, so no buffer waits.

 @example
 ```ts
 await flushNothing();
 ```
 */
function flushNothing(): Promise<void> {
  return Promise.resolve();
}

/**
 Logger keeping every line, at any level, in emission order.

 @param messages - array the lines land in

 @returns Logger writing into it

 @example
 ```ts
 const messages: string[] = [];
 const l = capturingLogger({ messages, },);
 ```
 */
export function capturingLogger({ messages, }: { readonly messages: string[]; },): Logger {
  /**
   One level's writer, every level sharing the same array.

   @param message - line as the code under test wrote it
   */
  function keep(message: string,): void {
    messages.push(message,);
  }

  return {
    debug: keep,
    error: keep,
    fatal: keep,
    flush: flushNothing,
    info: keep,
    trace: keep,
    warn: keep,
  };
}

//endregion Capturing logger
