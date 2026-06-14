import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { createSessionStorageSink, } from './session-storage.ts';
import type { LogRecord, } from '../types.ts';

// Node exposes an in-memory Web Storage `sessionStorage` (on by default in the
// v26 the test runner uses), so the sink genuinely works under node and this
// file exercises the available path directly: verify round-trips and writes
// persist under incrementing namespaced keys. The browser environment is
// covered by `session-storage.browser.test.ts`; OPFS, whose backend node
// lacks, covers the unavailable-verify fallback in `opfs.unit.test.ts`.
await describe({
  name: 'sessionStorage sink (node web storage)',
  // Serial because every test shares the one process-global sessionStorage.
  concurrency: 1,
  children: [
    it({
      name: 'verify resolves true where sessionStorage round-trips',
      fn: async () => {
        // The probe writes a sentinel, reads it back, and removes it; a match
        // proves the backend persists, so verify reports it available.
        const sink = createSessionStorageSink();
        expect(await sink.verify(),)
          .toBe(true,);
      },
    },),

    it({
      name: 'write persists each record under an incrementing namespaced key',
      fn: async () => {
        globalThis.sessionStorage
          .clear();
        const sink = createSessionStorageSink();
        await sink.verify();

        /**
         * First record written; lands on the fresh sink's initial counter slot.
         */
        const first: LogRecord = {
          level: 'info',
          message: 'one',
          timestamp: 0,
        };
        /**
         * Second record written; the counter increment puts it on the next slot.
         */
        const second: LogRecord = {
          level: 'warn',
          message: 'two',
          timestamp: 0,
        };
        await sink.write(first,);
        await sink.write(second,);

        // A fresh sink's counter starts at zero, so the two writes land on
        // sequential `monochromatic.log.N` keys, each holding the JSONL record.
        expect(globalThis.sessionStorage
          .getItem('monochromatic.log.0',),)
          .toBe(JSON.stringify(first,),);
        expect(globalThis.sessionStorage
          .getItem('monochromatic.log.1',),)
          .toBe(JSON.stringify(second,),);
      },
    },),
  ],
},);
