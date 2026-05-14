import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';
import { tagged, } from './tagged.ts';
import type { Logger, } from './types.ts';

/**
 * Builds a stub logger whose methods record the messages they receive
 * and whose `flush` is a trivial resolved promise. Used to verify the
 * tagged wrapper's message prefixing and `flush` forwarding without
 * touching the default multi-sink singleton.
 *
 * @returns Object containing the stub logger and the recorded message list.
 */
function createStubLogger(): {
  l: Logger;
  messages: { level: string; message: string; }[];
  flushCalls: number;
} {
  const messages: { level: string; message: string; }[] = [];
  const counters: { flushCalls: number; } = { flushCalls: 0, };
  const l: Logger = {
    debug: function debug(message: string,): void {
      messages.push({ level: 'debug', message, },);
    },
    error: function error(message: string,): void {
      messages.push({ level: 'error', message, },);
    },
    fatal: function fatal(message: string,): void {
      messages.push({ level: 'fatal', message, },);
    },
    flush: function flush(): Promise<void> {
      counters.flushCalls++;
      return Promise.resolve();
    },
    info: function info(message: string,): void {
      messages.push({ level: 'info', message, },);
    },
    trace: function trace(message: string,): void {
      messages.push({ level: 'trace', message, },);
    },
    warn: function warn(message: string,): void {
      messages.push({ level: 'warn', message, },);
    },
  };
  return {
    get flushCalls() {
      return counters.flushCalls;
    },
    l,
    messages,
  };
}

await describe({
  name: 'tagged logger wrapper',
  children: [
    it({
      name: 'prepends [tag] to each level method',
      fn: async () => {
        const stub = createStubLogger();
        const wrapped = tagged({
          tag: 'scope',
          l: stub.l,
        },);

        wrapped.info('hello',);
        wrapped.warn('careful',);

        expect(stub.messages,)
          .toEqual([
            { level: 'info', message: '[scope] hello', },
            { level: 'warn', message: '[scope] careful', },
          ],);
      },
    },),

    it({
      name: 'flush delegates to the inner logger without tagging',
      fn: async () => {
        const stub = createStubLogger();
        const wrapped = tagged({
          tag: 'scope',
          l: stub.l,
        },);

        expect(stub.flushCalls,)
          .toBe(0,);
        await wrapped.flush();
        expect(stub.flushCalls,)
          .toBe(1,);
        // flush must not leak into the message stream
        expect(stub.messages.length,)
          .toBe(0,);
      },
    },),
  ],
},);
