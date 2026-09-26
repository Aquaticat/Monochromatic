/** Transaction process birth-identity tests. @module */
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { internalTestExports, } from '../../dist/final/node/index.mjs';
import { startZombie, } from '../owner-lock/zombie-fixture.unit.test.ts';

const {
  PROCESS_IDENTITY_ABSENT,
  resolveProcessBirthIdentity,
} = internalTestExports;

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
    it({
      name: 'treats an exited but unreaped Linux process as absent, because a zombie holds nothing',
      fn: async function testZombieIdentity(): Promise<void> {
        if (process.platform !== 'linux')
          return;
        await using zombie = await startZombie(resolveProcessBirthIdentity,);
        expect(zombie.identity.startsWith('linux:',)).toBe(true,);
        expect(await resolveProcessBirthIdentity(zombie.pid,),).toBe(PROCESS_IDENTITY_ABSENT,);
      },
    },),
  ],
},);
