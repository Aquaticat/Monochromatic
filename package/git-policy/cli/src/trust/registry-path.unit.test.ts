import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  chunkEncodedPath,
  decodeIdentityField,
  encodeIdentityField,
  recordDirectory,
  validateSnapshotRelativePath,
} from './registry-path.ts';

/** Registry path chunk width from schema. */
const CHUNK_WIDTH = 120;
/** Long fixture spanning two chunks plus one byte. */
const LONG_FIXTURE_LENGTH = (CHUNK_WIDTH * 2) + 1;
await describe({
  name: 'reversible trust registry path',
  children: [
    it({
      name: 'round trips exact UTF-8 identity fields without hashes',
      fn: async function testRoundTrip() {
        /** Unicode canonical path fixture. */
        const value = '/repo/猫/cli-git.config.mjs';
        /** Reversible base64url encoding. */
        const encoded = encodeIdentityField(value,);
        expect(encoded.includes('=',),).toBe(false,);
        expect(decodeIdentityField(encoded,),).toBe(value,);
      },
    },),
    it({
      name: 'chunks long paths at fixed component width',
      fn: async function testChunking() {
        /** Long encoded path fixture. */
        const encoded = 'a'.repeat(LONG_FIXTURE_LENGTH,);
        expect(chunkEncodedPath(encoded,).map(function chunkLength(chunk,) {
          return chunk.length;
        },),).toEqual([CHUNK_WIDTH, CHUNK_WIDTH, 1,],);
      },
    },),
    it({
      name: 'includes complete encoded identity in record path',
      fn: async function testRecordPath() {
        /** Complete trust identity. */
        const identity = {
          filesystemId: 'fs-uuid_example',
          canonicalConfigPath: '/repo/cli-git.config.mjs',
        };
        /** Exact reversible directory. */
        const directory = recordDirectory({ registryRoot: '/registry', identity, },);
        expect(directory,).toContain(encodeIdentityField(identity.filesystemId,),);
        expect(directory,).toContain(chunkEncodedPath(encodeIdentityField(identity.canonicalConfigPath,),)[0],);
      },
    },),
    it({
      name: 'rejects noncanonical encodings and traversal snapshots',
      fn: async function testRejectedPaths() {
        expect(() => decodeIdentityField('YQ==',),).toThrow(Error,);
        expect(() => validateSnapshotRelativePath('snapshots/../record.json',),).toThrow(Error,);
        expect(() => validateSnapshotRelativePath('/snapshots/config.mjs',),).toThrow(Error,);
      },
    },),
  ],
},);
