/** Dependent version bump planning unit tests. @module */
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  patchBumpVersion,
  planDependentBumps,
  UnsupportedVersionError,
  type WorkspaceManifest,
} from '../dist/final/node/index.mjs';

/**
 Builds a manifest fixture with a directory derived from the name.

 @param name - Package name.

 @param version - Optional version.

 @param edgeNames - Runtime or bundled dependency names.

 @returns Workspace manifest fixture.
 */
function manifest({
  name,
  version,
  edgeNames = [],
}: Readonly<{
  name: string;
  version?: string;
  edgeNames?: readonly string[];
}>,): WorkspaceManifest {
  return {
    name,
    directory: `package/module/${name}`,
    ...(version === undefined ? {} : { version, }),
    edgeNames,
  };
}

await describe({
  name: '',
  children: [
    describe({
      name: patchBumpVersion.name,
      children: [
        it({
          name: 'increments the patch component numerically',
          fn: async function testPatchBump(): Promise<void> {
            expect(patchBumpVersion({ name: 'a', version: '1.2.3', },),).toBe('1.2.4',);
            expect(patchBumpVersion({ name: 'a', version: '0.0.9', },),).toBe('0.0.10',);
          },
        },),
        ...[
          '1.0.0-alpha.1',
          '1.0.0+build',
          '01.0.0',
          '1.0',
          '1.0.x',
          '',
        ].map(function rejectVersion(version,) {
          return it({
            name: `rejects ${JSON.stringify(version,)}`,
            fn: async function testRejectedVersion(): Promise<void> {
              expect(function bump() {
                patchBumpVersion({ name: '@scope/a', version, },);
              },).toThrow(UnsupportedVersionError,);
            },
          },);
        },),
      ],
    },),
    describe({
      name: planDependentBumps.name,
      children: [
        it({
          name: 'bumps direct and transitive publishable dependents in name order',
          fn: async function testTransitive(): Promise<void> {
            const manifests = [
              manifest({ name: 'z-app', version: '2.0.0', edgeNames: ['mid',], },),
              manifest({ name: 'mid', version: '1.0.0', edgeNames: ['base',], },),
              manifest({ name: 'base', version: '1.1.0', },),
              manifest({ name: 'a-tool', version: '0.1.0', edgeNames: ['base',], },),
            ];
            expect(planDependentBumps({
              manifests,
              bumpedNames: ['base',],
              publishableNames: ['z-app', 'mid', 'base', 'a-tool',],
            },),).toEqual([
              { name: 'a-tool', directory: 'package/module/a-tool', from: '0.1.0', to: '0.1.1', },
              { name: 'mid', directory: 'package/module/mid', from: '1.0.0', to: '1.0.1', },
              { name: 'z-app', directory: 'package/module/z-app', from: '2.0.0', to: '2.0.1', },
            ],);
          },
        },),
        it({
          name: 'walks through unpublishable packages but bumps only publishable ones',
          fn: async function testUnpublishableChain(): Promise<void> {
            const manifests = [
              manifest({ name: 'app', version: '1.0.0', edgeNames: ['internal',], },),
              manifest({ name: 'internal', version: '1.0.0', edgeNames: ['base',], },),
              manifest({ name: 'base', version: '1.0.0', },),
            ];
            expect(planDependentBumps({
              manifests,
              bumpedNames: ['base',],
              publishableNames: ['app', 'base',],
            },),).toEqual([{ name: 'app', directory: 'package/module/app', from: '1.0.0', to: '1.0.1', },],);
          },
        },),
        it({
          name: 'skips already bumped and versionless dependents',
          fn: async function testSkips(): Promise<void> {
            const manifests = [
              manifest({ name: 'bumped-dependent', version: '3.0.0', edgeNames: ['base',], },),
              manifest({ name: 'versionless', edgeNames: ['base',], },),
              manifest({ name: 'base', version: '1.0.0', },),
            ];
            expect(planDependentBumps({
              manifests,
              bumpedNames: ['base', 'bumped-dependent',],
              publishableNames: ['bumped-dependent', 'versionless', 'base',],
            },),).toEqual([],);
          },
        },),
        it({
          name: 'ignores external and self edges and terminates on cycles',
          fn: async function testCycles(): Promise<void> {
            const manifests = [
              manifest({ name: 'left', version: '1.0.0', edgeNames: ['right', 'left', 'external',], },),
              manifest({ name: 'right', version: '1.0.0', edgeNames: ['left',], },),
            ];
            expect(planDependentBumps({
              manifests,
              bumpedNames: ['left',],
              publishableNames: ['left', 'right',],
            },),).toEqual([{ name: 'right', directory: 'package/module/right', from: '1.0.0', to: '1.0.1', },],);
          },
        },),
        it({
          name: 'returns nothing when no package was bumped',
          fn: async function testNoBumps(): Promise<void> {
            expect(planDependentBumps({
              manifests: [manifest({ name: 'a', version: '1.0.0', edgeNames: ['b',], },),],
              bumpedNames: [],
              publishableNames: ['a',],
            },),).toEqual([],);
          },
        },),
        it({
          name: 'throws when a dependent needing a bump has a prerelease version',
          fn: async function testUnsupportedDependent(): Promise<void> {
            expect(function plan() {
              planDependentBumps({
                manifests: [
                  manifest({ name: 'a', version: '1.0.0-rc.1', edgeNames: ['b',], },),
                  manifest({ name: 'b', version: '1.0.0', },),
                ],
                bumpedNames: ['b',],
                publishableNames: ['a', 'b',],
              },);
            },).toThrow(UnsupportedVersionError,);
          },
        },),
      ],
    },),
  ],
},);
