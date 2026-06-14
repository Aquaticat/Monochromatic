import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { createOpfsSink, } from './opfs.ts';

// Node/Bun has no `navigator.storage`, so this file exercises the
// unavailable-backend fallback that the browser test (which runs where OPFS
// exists) never reaches: `getDirectory` throws and is caught. The available
// path lives in `opfs.browser.test.ts`.
await describe({
  name: 'OPFS sink (node fallback)',
  children: [
    it({
      name: 'verify resolves false when OPFS is absent',
      fn: async () => {
        // `navigator.storage.getDirectory()` dereferences an undefined member
        // and throws; verify catches it and reports the backend unavailable.
        const sink = createOpfsSink();
        expect(await sink.verify(),)
          .toBe(false,);
      },
    },),

    it({
      name: 'write is a silent no-op when OPFS is absent',
      fn: async () => {
        // Without a verified writable stream, write takes the unset-guard early
        // return, resolving without throwing.
        const sink = createOpfsSink();
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
