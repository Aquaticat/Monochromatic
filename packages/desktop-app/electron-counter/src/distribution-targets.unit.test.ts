/**
 * Unit tests for Electron distribution target matrix.
 *
 * Tests import from built `dist/app` so the distribution tool and tests agree on
 * the emitted artifact shape.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  DISTRIBUTION_TARGET_COUNT,
  DISTRIBUTION_TARGETS,
  targetKey,
} from '../dist/app/distribution-targets.js';

/** Expected target keys for Linux, Windows, and macOS on x64 and arm64. */
const expectedTargetKeys = [
  'linux-x64',
  'linux-arm64',
  'win32-x64',
  'win32-arm64',
  'darwin-x64',
  'darwin-arm64',
] as const;

await describe({
  name: '',
  children: [
    describe({
      name: 'DISTRIBUTION_TARGETS',
      children: [
        it({
          name: 'contains platform by architecture Cartesian product',
          fn: async () => {
            expect(DISTRIBUTION_TARGETS.length,).toBe(DISTRIBUTION_TARGET_COUNT,);
            expect(DISTRIBUTION_TARGETS.map(function toKey(target,) {
              return targetKey({ target, },);
            },),).toEqual([...expectedTargetKeys,],);
          },
        },),
      ],
    },),
    describe({
      name: targetKey.name,
      children: [
        it({
          name: 'formats stable target key',
          fn: async () => {
            expect(targetKey({
              target: {
                platform: 'linux',
                arch: 'arm64',
              },
            },),).toBe('linux-arm64',);
          },
        },),
      ],
    },),
  ],
},);
