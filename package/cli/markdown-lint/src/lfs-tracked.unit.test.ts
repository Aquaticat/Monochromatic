import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { lfsTrackedMatcher, } from '@monochromatic-dev/cli-markdown-lint';

/**
 Attribute lines mirroring the repository's `.gitattributes`.
 */
const ATTRIBUTES = [
  '* text=auto eol=lf',
  '',
  '# raster formats',
  '*.png filter=lfs diff=lfs merge=lfs -text',
  '*.jpg\tfilter=lfs diff=lfs merge=lfs -text',
  'design/*.bin filter=lfs',
  'package/*/asset/readme/*.png !filter !diff !merge',
].join('\n',);

await describe({
  name: lfsTrackedMatcher.name,
  children: [
    it({
      name: 'matches a filter=lfs extension pattern anywhere in the tree',
      fn: async function extension() {
        /**
         Predicate under test.
         */
        const tracked = lfsTrackedMatcher(ATTRIBUTES,);
        expect(tracked('deep/dir/shot.png',),).toBe(true,);
        expect(tracked('shot.jpg',),).toBe(true,);
      },
    },),
    it({
      name: 'ignores lines without filter=lfs',
      fn: async function others() {
        /**
         Predicate under test.
         */
        const tracked = lfsTrackedMatcher(ATTRIBUTES,);
        expect(tracked('README.md',),).toBe(false,);
        expect(tracked('src/index.ts',),).toBe(false,);
      },
    },),
    it({
      name: 'honours a directory-scoped pattern',
      fn: async function scoped() {
        /**
         Predicate under test.
         */
        const tracked = lfsTrackedMatcher(ATTRIBUTES,);
        expect(tracked('design/a.bin',),).toBe(true,);
        expect(tracked('other/a.bin',),).toBe(false,);
      },
    },),
    it({
      name: 'lets a later unset line win',
      fn: async function unset() {
        /**
         Predicate under test.
         */
        const tracked = lfsTrackedMatcher(ATTRIBUTES,);
        expect(tracked('package/player/asset/readme/shot.png',),).toBe(false,);
        expect(tracked('package/player/design/shot.png',),).toBe(true,);
      },
    },),
    it({
      name: 'tracks nothing for empty attributes',
      fn: async function empty() {
        expect(lfsTrackedMatcher('',)('shot.png',),).toBe(false,);
      },
    },),
  ],
},);
