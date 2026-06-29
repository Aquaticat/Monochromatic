/**
 * Unit tests for the matrix fixture builder.
 *
 * Pure host tests (no containers): pin that `buildWorkspaceYaml` encodes the
 * catalog floor, override, and per-combination linker and hoist settings, and
 * that the `hoist:` line is omitted under the pnp linker where it does not apply.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  buildWorkspaceYaml,
  COMBOS,
  EXPECTED_TIGHTENED,
  FIXTURE_ACTIVE,
  FIXTURE_FLOOR,
  FIXTURE_PACKAGE,
} from './combos.ts';

await describe({
  name: 'combos',
  children: [
    it({
      name: 'encodes the catalog floor and the pinning override',
      fn: async () => {
        /** Workspace file for the first (isolated) combination. */
        const yaml = buildWorkspaceYaml({
          label: 'isolated, hoist on',
          nodeLinker: 'isolated',
          hoist: true,
          staleOrphan: false,
        },);
        expect(yaml.includes(`'${FIXTURE_PACKAGE}': '>=${FIXTURE_FLOOR}'`,),).toBe(true,);
        expect(yaml.includes('nodeLinker: isolated',),).toBe(true,);
        expect(yaml.includes('hoist: true',),).toBe(true,);
        expect(yaml.includes(`${FIXTURE_PACKAGE}: ${FIXTURE_ACTIVE}`,),).toBe(true,);
      },
    },),

    it({
      name: 'omits the hoist line under the pnp linker',
      fn: async () => {
        /** Workspace file for the pnp combination, where hoist does not apply. */
        const yaml = buildWorkspaceYaml({
          label: 'pnp',
          nodeLinker: 'pnp',
          hoist: false,
          staleOrphan: false,
        },);
        expect(yaml.includes('nodeLinker: pnp',),).toBe(true,);
        expect(yaml.includes('hoist:',),).toBe(false,);
      },
    },),

    it({
      name: 'covers exactly one stale-orphan combination',
      fn: async () => {
        /** Combinations flagged to seed a stale orphan. */
        const orphanCombos = COMBOS.filter(function isOrphan(combo,): boolean {
          return combo.staleOrphan;
        },);
        expect(orphanCombos.length,).toBe(1,);
      },
    },),

    it({
      name: 'expected tightened line names floor and active version',
      fn: async () => {
        expect(EXPECTED_TIGHTENED,).toBe(`${FIXTURE_PACKAGE}: >=${FIXTURE_FLOOR} -> >=${FIXTURE_ACTIVE}`,);
      },
    },),
  ],
},);
