import { createHash, } from 'node:crypto';
import { writeFile, } from 'node:fs/promises';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  isLfsOid,
  lfsOidOfFile,
} from '@monochromatic-dev/cli-markdown-lint';

import { makeTempDir, } from './lfs-test-fixture.ts';

/**
 Declared oid used by the pointer fixture.
 */
const DECLARED = 'c'.repeat(64,);

await describe({
  name: '',
  children: [
    describe({
      name: isLfsOid.name,
      children: [
        it({
          name: 'accepts 64 lowercase hex characters and rejects everything else',
          fn: async function classify() {
            expect(isLfsOid(DECLARED,),).toBe(true,);
            expect(
              isLfsOid(DECLARED.toUpperCase(),),
            ).toBe(false,);
            expect(
              isLfsOid(DECLARED.slice(1,),),
            ).toBe(false,);
            expect(isLfsOid(`g${DECLARED.slice(1,)}`,),).toBe(false,);
          },
        },),
      ],
    },),
    describe({
      name: lfsOidOfFile.name,
      children: [
        it({
          name: 'hashes smudged bytes and reads a pointer\'s declared oid',
          fn: async function both() {
            await using dir = await makeTempDir('lfs-oid-',);
            /**
             Smudged bytes standing in for an image.
             */
            const bytes = Buffer.from('PNG not really',);
            await writeFile(join(dir.path, 'smudged.png',), bytes,);
            expect(
              await lfsOidOfFile(join(dir.path, 'smudged.png',),),
            ).toBe(createHash('sha256',)
              .update(bytes,)
              .digest('hex',),);
            await writeFile(
              join(dir.path, 'pointer.png',),
              `version https://git-lfs.github.com/spec/v1\noid sha256:${DECLARED}\nsize 12\n`,
            );
            expect(
              await lfsOidOfFile(join(dir.path, 'pointer.png',),),
            ).toBe(DECLARED,);
          },
        },),
        it({
          name: 'hashes a pointer-like file whose oid line is malformed',
          fn: async function malformed() {
            await using dir = await makeTempDir('lfs-oid-',);
            /**
             Pointer header with a bad oid.
             */
            const text = 'version https://git-lfs.github.com/spec/v1\noid sha256:nope\nsize 1\n';
            await writeFile(join(dir.path, 'bad.png',), text,);
            expect(
              await lfsOidOfFile(join(dir.path, 'bad.png',),),
            ).toBe(createHash('sha256',)
              .update(text,)
              .digest('hex',),);
          },
        },),
      ],
    },),
  ],
},);
