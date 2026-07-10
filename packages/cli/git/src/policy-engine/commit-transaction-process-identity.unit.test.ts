/** Transaction process birth-identity tests. @module */
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  PROCESS_IDENTITY_ABSENT,
  resolveProcessBirthIdentity,
} from './commit-transaction-process-identity.ts';

await describe({
  name: resolveProcessBirthIdentity.name,
  children: [
    it({
      name: 'distinguishes current Linux process from absent PID',
      fn: async function testLinuxBirthIdentity(): Promise<void> {
        if (process.platform !== 'linux')
          return;
        /** Current process identity. */
        const current = await resolveProcessBirthIdentity(process.pid,);
        if ((typeof current) === 'symbol')
          throw new TypeError('Current Linux process identity was absent.',);
        expect(current.startsWith('linux:',)).toBe(true,);
        /** Deliberately impossible Linux PID identity. */
        const absent = await resolveProcessBirthIdentity(Number.MAX_SAFE_INTEGER,);
        expect(absent).toBe(PROCESS_IDENTITY_ABSENT,);
      },
    },),
  ],
},);
