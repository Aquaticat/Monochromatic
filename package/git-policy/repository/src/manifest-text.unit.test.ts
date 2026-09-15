/** Manifest text reading and version rewrite unit tests. @module */
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  ManifestShapeError,
  readManifestDependencyFacts,
  replaceManifestVersion,
} from '../dist/final/node/index.mjs';

await describe({
  name: '',
  children: [
    describe({
      name: readManifestDependencyFacts.name,
      children: [
        it({
          name: 'reads name, version, runtime fields in order, and development names',
          fn: async function testFacts(): Promise<void> {
            expect(readManifestDependencyFacts({
              path: 'package.json',
              text: JSON.stringify({
                name: '@scope/a',
                version: '1.0.0',
                dependencies: { '@scope/b': 'workspace:*', },
                peerDependencies: { '@scope/c': '*', },
                optionalDependencies: { '@scope/d': '*', },
                devDependencies: { '@scope/e': 'workspace:*', },
              },),
            },),).toEqual({
              name: '@scope/a',
              version: '1.0.0',
              runtimeDependencyNames: ['@scope/b', '@scope/c', '@scope/d',],
              devDependencyNames: ['@scope/e',],
            },);
          },
        },),
        it({
          name: 'omits an absent version and treats non-object dependency fields as empty',
          fn: async function testAbsentVersion(): Promise<void> {
            expect(readManifestDependencyFacts({
              path: 'package.json',
              text: '{"name":"a","dependencies":["b"]}',
            },),).toEqual({
              name: 'a',
              runtimeDependencyNames: [],
              devDependencyNames: [],
            },);
          },
        },),
        ...[
          ['[]', 'is not a JSON object',],
          ['{"version":"1.0.0"}', 'has no string "name"',],
          ['{"name":"a","version":1}', 'has a non-string "version"',],
        ].map(function rejectShape([text, message,],) {
          return it({
            name: `rejects manifest that ${message ?? ''}`,
            fn: async function testRejectedShape(): Promise<void> {
              expect(function read() {
                readManifestDependencyFacts({ path: 'package/module/a/package.json', text: text ?? '', },);
              },).toThrow(ManifestShapeError,);
            },
          },);
        },),
      ],
    },),
    describe({
      name: replaceManifestVersion.name,
      children: [
        it({
          name: 'changes only the top-level version value and keeps formatting',
          fn: async function testReplace(): Promise<void> {
            const text = '{\n  "name": "a",\n  "description": "version \\"x\\"",\n  "publishConfig": { "version": "9.9.9" },\n  "version" :  "1.0.0",\n  "tail": ["version"]\n}\n';
            expect(replaceManifestVersion({ path: 'package.json', text, from: '1.0.0', to: '1.0.1', },),).toBe(
              '{\n  "name": "a",\n  "description": "version \\"x\\"",\n  "publishConfig": { "version": "9.9.9" },\n  "version" :  "1.0.1",\n  "tail": ["version"]\n}\n',
            );
          },
        },),
        ...[
          ['{"version":"2.0.0"}', 'declares a different version',],
          ['{"name":"a","nested":{"version":"1.0.0"}}', 'has no top-level version',],
          ['{"version":1}', 'has a non-string version',],
          ['{"name":"a', 'ends inside a string literal',],
        ].map(function rejectRewrite([text, reason,],) {
          return it({
            name: `rejects manifest that ${reason ?? ''}`,
            fn: async function testRejectedRewrite(): Promise<void> {
              expect(function rewrite() {
                replaceManifestVersion({ path: 'package.json', text: text ?? '', from: '1.0.0', to: '1.0.1', },);
              },).toThrow(ManifestShapeError,);
            },
          },);
        },),
      ],
    },),
  ],
},);
