import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { notifyWriteProtection, } from './notify.ts';

/**
 * Logger root for file-enforcer after removing the package log shim.
 *
 * @example
 * ```ts
 * const rl = tagged({ tag: someFunction.name, l, },);
 * ```
 */
const l = tagged({ tag: 'file-enforcer', },);

//region notifyWriteProtection

await describe({
  name: notifyWriteProtection.name,
  // Sequential execution required: tests spy on the shared module-level
  // logger `l`, and sinon refuses to wrap an already-wrapped method.
  // Matches the convention in module/test/src/sinon.unit.test.ts.
  concurrency: 1,
  children: [
    it({
      name: 'logs a warning via tagged logger',
      fn: async ({ sinon, },) => {
        const warnSpy = sinon.spy(l, 'warn',);
        await notifyWriteProtection('/repo/CLAUDE.md',);
        /** Should have logged with the PROTECTED prefix */
        expect(warnSpy,).toHaveBeenCalledWith(
          expect.stringContaining('PROTECTED',),
        );
      },
    },),
    it({
      name: 'includes the file path in the warning',
      fn: async ({ sinon, },) => {
        const warnSpy = sinon.spy(l, 'warn',);
        await notifyWriteProtection('/repo/output.txt',);
        expect(warnSpy,).toHaveBeenCalledWith(
          expect.stringContaining('/repo/output.txt',),
        );
      },
    },),
    it({
      name: 'does not throw when notify-send is unavailable',
      fn: async () => {
        // If notify-send fails or is missing, the function should still complete
        await expect(
          notifyWriteProtection('/nonexistent/path.txt',),
        )
          .resolves
          .toBeUndefined();
      },
    },),
  ],
},);

//endregion notifyWriteProtection
