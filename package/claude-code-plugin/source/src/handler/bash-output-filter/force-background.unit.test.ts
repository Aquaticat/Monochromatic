import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  FORCE_BACKGROUND_ENV,
  shouldForceBackground,
} from './force-background.ts';

await describe({
  name: shouldForceBackground.name,
  children: [
    it({
      name: 'names the opt-in environment variable',
      fn: async () => {
        expect(FORCE_BACKGROUND_ENV,).toBe('MONOCHROMATIC_BASH_FORCE_BACKGROUND',);
      },
    },),
    it({
      name: 'forces a main-thread call when the opt-in is on',
      fn: async () => {
        expect(
          shouldForceBackground({ env: { [FORCE_BACKGROUND_ENV]: 'on', }, },),
        ).toBe(true,);
      },
    },),
    it({
      name: 'leaves a subagent call alone even when the opt-in is on',
      fn: async () => {
        expect(
          shouldForceBackground({ agentId: 'agent-1', env: { [FORCE_BACKGROUND_ENV]: 'on', }, },),
        ).toBe(false,);
      },
    },),
    it({
      name: 'leaves a call alone when the opt-in is absent',
      fn: async () => {
        expect(shouldForceBackground({ env: {}, },),).toBe(false,);
      },
    },),
    it({
      name: 'leaves a call alone for any value other than on',
      fn: async () => {
        expect(
          shouldForceBackground({ env: { [FORCE_BACKGROUND_ENV]: '1', }, },),
        ).toBe(false,);
      },
    },),
  ],
},);
