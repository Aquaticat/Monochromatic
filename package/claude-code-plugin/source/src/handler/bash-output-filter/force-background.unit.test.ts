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
      name: 'names the opt-out environment variable',
      fn: async () => {
        expect(FORCE_BACKGROUND_ENV,).toBe('MONOCHROMATIC_BASH_FORCE_BACKGROUND',);
      },
    },),
    it({
      name: 'forces a main-thread call by default',
      fn: async () => {
        expect(shouldForceBackground({ env: {}, },),).toBe(true,);
      },
    },),
    it({
      name: 'leaves a subagent call alone',
      fn: async () => {
        expect(shouldForceBackground({ agentId: 'agent-1', env: {}, },),).toBe(false,);
      },
    },),
    it({
      name: 'leaves a call alone when the opt-out is off',
      fn: async () => {
        expect(
          shouldForceBackground({ env: { [FORCE_BACKGROUND_ENV]: 'off', }, },),
        ).toBe(false,);
      },
    },),
    it({
      name: 'still forces for any value other than off',
      fn: async () => {
        expect(
          shouldForceBackground({ env: { [FORCE_BACKGROUND_ENV]: 'on', }, },),
        ).toBe(true,);
        expect(
          shouldForceBackground({ env: { [FORCE_BACKGROUND_ENV]: '', }, },),
        ).toBe(true,);
      },
    },),
  ],
},);
