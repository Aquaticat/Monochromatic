/**
 Tests for the compositor version guard: parsing the `--version` line, comparing, and the refusal message.
 
 @module
 */

import {
  describe,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  compositorVersionProblem,
  isAtLeast,
  MINIMUM_COMPOSITOR_VERSION,
  parseCompositorVersion,
} from './compositor-version.ts';

await describe({
  name: parseCompositorVersion.name,
  children: [
    it({
      name: 'reads the numbers from the version line',
      fn: async ({ expect, }) => {
        expect(parseCompositorVersion('monochromatic-nested-wayland-session 0.4.0\n',),).toEqual([0, 4, 0,],);
        expect(parseCompositorVersion('x 10.20.30',),).toEqual([10, 20, 30,],);
      },
    },),
    it({
      name: 'finds no version in text without one',
      fn: async ({ expect, }) => {
        expect(parseCompositorVersion('',),).toEqual([],);
        expect(parseCompositorVersion('usage: nested',),).toEqual([],);
        expect(parseCompositorVersion('x 1.2',),).toEqual([],);
        expect(parseCompositorVersion('x 1.2.z',),).toEqual([],);
      },
    },),
  ],
},);

await describe({
  name: isAtLeast.name,
  children: [
    it({
      name: 'compares major, then minor, then patch',
      fn: async ({ expect, }) => {
        const minimum = [0, 4, 0,] as const;
        expect(isAtLeast({ version: [0, 4, 0,], minimum, },),).toBe(true,);
        expect(isAtLeast({ version: [0, 4, 7,], minimum, },),).toBe(true,);
        expect(isAtLeast({ version: [0, 5, 0,], minimum, },),).toBe(true,);
        expect(isAtLeast({ version: [1, 0, 0,], minimum, },),).toBe(true,);
        expect(isAtLeast({ version: [0, 3, 9,], minimum, },),).toBe(false,);
        expect(isAtLeast({ version: [0, 0, 99,], minimum, },),).toBe(false,);
      },
    },),
  ],
},);

await describe({
  name: compositorVersionProblem.name,
  children: [
    it({
      name: 'accepts the minimum and newer versions with no message',
      fn: async ({ expect, }) => {
        expect(compositorVersionProblem({ output: `nested ${MINIMUM_COMPOSITOR_VERSION}`, path: '/c', },),).toBe('',);
        expect(compositorVersionProblem({ output: 'nested 0.4.1', path: '/c', },),).toBe('',);
      },
    },),
    it({
      name: 'names the old version, the minimum and both ways out',
      fn: async ({ expect, }) => {
        const message = compositorVersionProblem({ output: 'nested 0.3.0', path: '/old/nested', },);
        expect(message,).toContain('/old/nested is 0.3.0',);
        expect(message,).toContain('need 0.4.0',);
        expect(message,).toContain('E2E_COMPOSITOR',);
        expect(message,).toContain('PINNED_COMPOSITOR_VERSION',);
      },
    },),
    it({
      name: 'refuses output with no version',
      fn: async ({ expect, }) => {
        expect(compositorVersionProblem({ output: 'oops', path: '/c', },),).toContain('printed no version',);
      },
    },),
  ],
},);
