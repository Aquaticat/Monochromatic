import { writeFile, } from 'node:fs/promises';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  lfsObjectBase,
  parseLfsConfig,
  readLfsObjectBase,
} from '@monochromatic-dev/cli-markdown-lint';

import { makeTempDir, } from './lfs-test-fixture.ts';

await describe({
  name: '',
  children: [
    describe({
      name: lfsObjectBase.name,
      children: [
        it({
          name: 'strips userinfo, query, fragment, and a trailing slash',
          fn: async function strips() {
            expect(lfsObjectBase('https://lfs:token@lfs.example/?x=1#y',),).toBe('https://lfs.example',);
          },
        },),
        it({
          name: 'keeps a path prefix',
          fn: async function path() {
            expect(lfsObjectBase('https://host.example/repo/info/lfs/',),).toBe('https://host.example/repo/info/lfs',);
          },
        },),
      ],
    },),
    describe({
      name: parseLfsConfig.name,
      children: [
        it({
          name: 'reads lfs.url',
          fn: async function lfsUrl() {
            expect(parseLfsConfig('[lfs]\n\turl = https://lfs.example\n',),).toEqual(['https://lfs.example',],);
          },
        },),
        it({
          name: 'reads remote.<name>.lfsurl',
          fn: async function remote() {
            expect(parseLfsConfig('[remote "origin"]\n\tlfsurl = https://lfs.example/x\n',),)
              .toEqual(['https://lfs.example/x',],);
          },
        },),
        it({
          name: 'ignores comments, blank lines, and keys in other sections',
          fn: async function ignores() {
            expect(parseLfsConfig('# c\n; d\n\n[core]\n\turl = https://nope.example\n[lfs]\n\tconcurrenttransfers = 3\n',),)
              .toEqual([],);
          },
        },),
        it({
          name: 'returns declarations in file order',
          fn: async function order() {
            expect(parseLfsConfig('[lfs]\n\turl = https://a.example\n[remote "o"]\n\tlfsurl = https://b.example\n',),)
              .toEqual([
                'https://a.example',
                'https://b.example',
              ],);
          },
        },),
      ],
    },),
    describe({
      name: readLfsObjectBase.name,
      children: [
        it({
          name: 'returns the first base from a repository root and none without a file',
          fn: async function reads() {
            await using dir = await makeTempDir('lfs-config-',);
            expect(await readLfsObjectBase(dir.path,),).toEqual([],);
            await writeFile(join(dir.path, '.lfsconfig',), '[lfs]\n\turl = https://lfs:t@lfs.example/\n',);
            expect(await readLfsObjectBase(dir.path,),).toEqual(['https://lfs.example',],);
          },
        },),
      ],
    },),
  ],
},);
