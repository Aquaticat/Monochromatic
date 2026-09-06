import { createHash, } from 'node:crypto';
import { join, } from 'node:path';

import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  candidateTargetPaths,
  discoverLfsImageRepo,
  isRelativePath,
  objectUrlParts,
  parse,
  prepareLfsImageContext,
  relativeTargetPath,
  repoRelative,
} from '@monochromatic-dev/cli-markdown-lint';

import {
  FIXTURE_IMAGE_BYTES,
  FIXTURE_OBJECT_BASE,
  makeLfsRepo,
  makeTempDir,
} from './lfs-test-fixture.ts';

/**
 Expected oid of the fixture image.
 */
const FIXTURE_OID = createHash('sha256',)
  .update(FIXTURE_IMAGE_BYTES,)
  .digest('hex',);

await describe({
  name: '',
  children: [
    describe({
      name: repoRelative.name,
      children: [
        it({
          name: 'relativizes with forward slashes',
          fn: async function relativizes() {
            expect(repoRelative({ repoRoot: '/repo', path: '/repo/a/b.png', },),).toBe('a/b.png',);
          },
        },),
      ],
    },),
    describe({
      name: isRelativePath.name,
      children: [
        it({
          name: 'accepts relative paths and rejects schemes, fragments, and site-absolute paths',
          fn: async function classify() {
            expect(isRelativePath('asset/shot.png',),).toBe(true,);
            expect(isRelativePath('./shot.png',),).toBe(true,);
            expect(isRelativePath('https://x.example/a.png',),).toBe(false,);
            expect(isRelativePath('mailto:x@y',),).toBe(false,);
            expect(isRelativePath('#top',),).toBe(false,);
            expect(isRelativePath('/a.png',),).toBe(false,);
            expect(isRelativePath('',),).toBe(false,);
            expect(isRelativePath('c:/windows.png',),).toBe(false,);
            expect(isRelativePath('a b:c.png',),).toBe(true,);
          },
        },),
      ],
    },),
    describe({
      name: relativeTargetPath.name,
      children: [
        it({
          name: 'resolves against the file directory and drops query and fragment',
          fn: async function resolves() {
            expect(relativeTargetPath({ url: '../asset/a.png?x#y', filePath: '/r/pkg/doc/README.md', repoRoot: '/r', },),)
              .toEqual(['pkg/asset/a.png',],);
          },
        },),
        it({
          name: 'returns nothing for a path escaping the root or a non-relative destination',
          fn: async function escapes() {
            expect(relativeTargetPath({ url: '../../a.png', filePath: '/r/pkg/README.md', repoRoot: '/r', },),).toEqual([],);
            expect(relativeTargetPath({ url: 'https://x.example/a.png', filePath: '/r/README.md', repoRoot: '/r', },),)
              .toEqual([],);
          },
        },),
      ],
    },),
    describe({
      name: objectUrlParts.name,
      children: [
        it({
          name: 'splits oid and path under the base',
          fn: async function splits() {
            expect(objectUrlParts({ url: `${FIXTURE_OBJECT_BASE}/${FIXTURE_OID}/pkg/a.png?x`, objectBase: FIXTURE_OBJECT_BASE, },),)
              .toEqual([{ oid: FIXTURE_OID, repoRelativePath: 'pkg/a.png', },],);
          },
        },),
        it({
          name: 'returns nothing for another origin, a bare oid, or a malformed oid',
          fn: async function rejects() {
            expect(objectUrlParts({ url: `https://other.example/${FIXTURE_OID}/a.png`, objectBase: FIXTURE_OBJECT_BASE, },),)
              .toEqual([],);
            expect(objectUrlParts({ url: `${FIXTURE_OBJECT_BASE}/${FIXTURE_OID}`, objectBase: FIXTURE_OBJECT_BASE, },),)
              .toEqual([],);
            expect(objectUrlParts({ url: `${FIXTURE_OBJECT_BASE}/nope/a.png`, objectBase: FIXTURE_OBJECT_BASE, },),)
              .toEqual([],);
          },
        },),
      ],
    },),
    describe({
      name: candidateTargetPaths.name,
      children: [
        it({
          name: 'collects relative and object-URL paths from images and definitions',
          fn: async function collects() {
            /**
             Source with one of each destination form plus an external image.
             */
            const source = [
              '![a](asset/a.png)',
              `![b](${FIXTURE_OBJECT_BASE}/${FIXTURE_OID}/pkg/asset/b.png)`,
              '![c](https://x.example/c.png)',
              '![d][def]',
              '',
              '[def]: ../other/d.png',
              '',
            ].join('\n',);
            expect([...candidateTargetPaths({
              tree: parse({ source, mdx: false, },),
              filePath: '/r/pkg/README.md',
              repoRoot: '/r',
              objectBase: FIXTURE_OBJECT_BASE,
            },),].toSorted(),).toEqual([
              'other/d.png',
              'pkg/asset/a.png',
              'pkg/asset/b.png',
            ],);
          },
        },),
      ],
    },),
    describe({
      name: discoverLfsImageRepo.name,
      children: [
        it({
          name: 'finds the root from a nested directory and reads the credential-free base',
          fn: async function finds() {
            await using repo = await makeLfsRepo();
            /**
             Discovery result from a nested directory.
             */
            const [found,] = await discoverLfsImageRepo({ cwd: join(repo.path, 'pkg', 'asset',), exclude: [], },);
            expect(found?.repoRoot,).toBe(repo.path,);
            expect(found?.objectBase,).toBe(FIXTURE_OBJECT_BASE,);
            expect(found?.isLfsTracked('pkg/asset/shot.png',),).toBe(true,);
            expect(found?.isLfsTracked('pkg/README.md',),).toBe(false,);
          },
        },),
        it({
          name: 'finds nothing without a .lfsconfig',
          fn: async function none() {
            await using dir = await makeTempDir('lfs-none-',);
            expect(await discoverLfsImageRepo({ cwd: dir.path, exclude: [], },),).toEqual([],);
          },
        },),
        it({
          name: 'excludes files matching the run patterns and never files outside the root',
          fn: async function excludes() {
            await using repo = await makeLfsRepo();
            /**
             Discovery result with an exclude pattern.
             */
            const [found,] = await discoverLfsImageRepo({ cwd: repo.path, exclude: ['pkg/README.md',], },);
            expect(
              found?.isExcluded(join(repo.path, 'pkg', 'README.md',),),
            ).toBe(true,);
            expect(
              found?.isExcluded(join(repo.path, 'other.md',),),
            ).toBe(false,);
            expect(found?.isExcluded('/elsewhere/README.md',),).toBe(false,);
          },
        },),
      ],
    },),
    describe({
      name: prepareLfsImageContext.name,
      children: [
        it({
          name: 'resolves lfs, plain, missing, and unreferenced targets',
          fn: async function resolves() {
            await using repo = await makeLfsRepo();
            const [found,] = await discoverLfsImageRepo({ cwd: repo.path, exclude: [], },);
            /**
             Context for a README naming every fixture path.
             */
            const context = await prepareLfsImageContext({
              repo: nonNullishOrThrow(found,),
              filePath: join(repo.path, 'pkg', 'README.md',),
              source: '![a](asset/shot.png)\n![b](asset/plain.svg)\n![c](asset/gone.png)\n![d](asset)\n',
              mdx: false,
            },);
            expect(context.filePath,).toBe(join(repo.path, 'pkg', 'README.md',),);
            expect(context.objectBase,).toBe(FIXTURE_OBJECT_BASE,);
            expect(context.resolveTarget('pkg/asset/shot.png',),).toEqual({ kind: 'lfs', oid: FIXTURE_OID, },);
            expect(context.resolveTarget('pkg/asset/plain.svg',),).toEqual({ kind: 'plain', },);
            expect(context.resolveTarget('pkg/asset/gone.png',),).toEqual({ kind: 'missing', },);
            expect(context.resolveTarget('pkg/asset',),).toEqual({ kind: 'missing', },);
            expect(context.resolveTarget('never/referenced.png',),).toEqual({ kind: 'missing', },);
          },
        },),
      ],
    },),
  ],
},);
