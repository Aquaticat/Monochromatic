import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { createSessionStorageSink, } from './session-storage.ts';

// Node/Bun has no global `sessionStorage`, so this file exercises the
// unavailable-backend fallback that the browser test (which runs where the
// backend exists) never reaches: the probe throws and is caught. The
// available path lives in `session-storage.browser.test.ts`.
await describe({
  name: 'sessionStorage sink (node fallback)',
  children: [
    it({
      name: 'verify resolves false when sessionStorage is absent',
      fn: async () => {
        // The probe `setItem` dereferences an undefined global and throws;
        // verify catches it and reports the backend unavailable.
        const sink = createSessionStorageSink();
        expect(await sink.verify(),)
          .toBe(false,);
      },
    },),

    it({
      name: 'write is a silent no-op when sessionStorage is absent',
      fn: async () => {
        // Write swallows the same dereference throw, so an unavailable backend
        // never propagates an error to the caller.
        const sink = createSessionStorageSink();
        await expect(
          sink.write({
            level: 'info',
            message: 'dropped',
            timestamp: 0,
          },),
        )
          .resolves
          .toBeUndefined();
      },
    },),
  ],
},);
