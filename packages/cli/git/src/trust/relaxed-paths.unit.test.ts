import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { relaxedPathMatches, } from './relaxed-paths.ts';
import type {
  TrustIdentity,
  TrustWarning,
} from './types.ts';

/** Current exact fixture identity. */
const IDENTITY: TrustIdentity = {
  filesystemId: 'device-number_0-1',
  canonicalConfigPath: '/repo/config,one%.mjs',
};

await describe({
  name: relaxedPathMatches.name,
  children: [
    it({
      name: 'accepts exact escaped comma and percent identity',
      fn: async function testExactEscapes() {
        /** Captured warnings. */
        const warnings: TrustWarning[] = [];
        const matches = relaxedPathMatches({
          raw: 'device-number_0-1:/repo/config%2Cone%25.mjs',
          identity: IDENTITY,
          warn: function warn(warning,) { warnings.push(warning,); },
        },);
        expect(matches,).toBe(true,);
        expect(warnings,).toEqual([],);
      },
    },),
    it({
      name: 'warns once per malformed entry and remains strict',
      fn: async function testMalformedEntries() {
        /** Captured warnings. */
        const warnings: TrustWarning[] = [];
        const matches = relaxedPathMatches({
          raw: 'bad,device-number_0-1:/repo/%20,device-number_0-1:relative',
          identity: IDENTITY,
          warn: function warn(warning,) { warnings.push(warning,); },
        },);
        expect(matches,).toBe(false,);
        expect(warnings,).toHaveLength(3,);
      },
    },),
    it({
      name: 'warns planted current path with wrong filesystem identity',
      fn: async function testPlantedIdentity() {
        /** Captured warnings. */
        const warnings: TrustWarning[] = [];
        const matches = relaxedPathMatches({
          raw: 'device-number_other:/repo/config%2Cone%25.mjs',
          identity: IDENTITY,
          warn: function warn(warning,) { warnings.push(warning,); },
        },);
        expect(matches,).toBe(false,);
        expect(warnings[0]?.message,).toContain('different filesystem identity',);
      },
    },),
    it({
      name: 'keeps well-formed unrelated paths quiet',
      fn: async function testUnrelatedPath() {
        /** Captured warnings. */
        const warnings: TrustWarning[] = [];
        const matches = relaxedPathMatches({
          raw: 'device-number_0-1:/other/config.mjs',
          identity: IDENTITY,
          warn: function warn(warning,) { warnings.push(warning,); },
        },);
        expect(matches,).toBe(false,);
        expect(warnings,).toEqual([],);
      },
    },),
  ],
},);
