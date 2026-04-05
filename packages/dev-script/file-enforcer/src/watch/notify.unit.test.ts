import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';
import { l, } from '../log.ts';
import { notifyWriteProtection, } from './notify.ts';

//region notifyWriteProtection

await describe({
  name: notifyWriteProtection.name,
  children: [
    it({
      name: 'logs a warning via tagged logger',
      fn: async ({ sinon, }) => {
        const warnSpy = sinon.spy(l, 'warn',);
        await notifyWriteProtection('/repo/CLAUDE.md',);
        /** Should have logged with the PROTECTED prefix */
        expect(warnSpy,).toHaveBeenCalledWith(
          expect.stringContaining('PROTECTED',),
        );
      },
    }),
    it({
      name: 'includes the file path in the warning',
      fn: async ({ sinon, }) => {
        const warnSpy = sinon.spy(l, 'warn',);
        await notifyWriteProtection('/repo/output.txt',);
        expect(warnSpy,).toHaveBeenCalledWith(
          expect.stringContaining('/repo/output.txt',),
        );
      },
    }),
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
    }),
  ],
},);

//endregion notifyWriteProtection
