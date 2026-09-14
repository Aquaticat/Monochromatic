import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  filterPnpmOutput,
  isAllowedCycleWarning,
} from '../dist/final/node/testing.mjs';

/** pnpm uses U+2009 THIN SPACE around "WARN" in formatted output. */
const WARN = '\u2009WARN\u2009';

await describe({
  name: '',
  children: [
    describe({
      name: isAllowedCycleWarning.name,
      children: [
        it({
          name: 'returns true for the known build/test utility cycle',
          fn: async () => {
            expect(isAllowedCycleWarning(
              `${WARN} There are cyclic workspace dependencies: /var/home/user/Monochromatic/package/config/tsdown, /var/home/user/Monochromatic/package/module/test, /var/home/user/Monochromatic/package/module/numeric-format, /var/home/user/Monochromatic/package/module/or-throw`,
            ),)
              .toBe(true,);
          },
        },),
        it({
          name: 'returns true for the known module/async-time + module/test cycle',
          fn: async () => {
            expect(isAllowedCycleWarning(
              `${WARN} There are cyclic workspace dependencies: /var/home/user/Monochromatic/package/module/async-time, /var/home/user/Monochromatic/package/module/test`,
            ),)
              .toBe(true,);
          },
        },),
        it({
          name: 'returns true regardless of monorepo root path',
          fn: async () => {
            expect(isAllowedCycleWarning(
              `${WARN} There are cyclic workspace dependencies: /home/alice/projects/mono/package/module/async-time, /home/alice/projects/mono/package/module/test`,
            ),)
              .toBe(true,);
          },
        },),
        it({
          name: 'returns false for unknown packages in the cycle',
          fn: async () => {
            expect(isAllowedCycleWarning(
              `${WARN} There are cyclic workspace dependencies: /var/home/user/Monochromatic/package/foo/bar, /var/home/user/Monochromatic/package/baz/qux`,
            ),)
              .toBe(false,);
          },
        },),
        it({
          name: 'returns false for a mix of known and unknown packages',
          fn: async () => {
            expect(isAllowedCycleWarning(
              `${WARN} There are cyclic workspace dependencies: /var/home/user/Monochromatic/package/module/async-time, /var/home/user/Monochromatic/package/foo/bar`,
            ),)
              .toBe(false,);
          },
        },),
        it({
          name: 'returns false for unrelated warnings',
          fn: async () => {
            expect(isAllowedCycleWarning(
              `${WARN} deprecated package: some-old-pkg@1.0.0`,
            ),)
              .toBe(false,);
          },
        },),
        it({
          name: 'returns false for empty string',
          fn: async () => {
            expect(isAllowedCycleWarning('',),).toBe(false,);
          },
        },),
      ],
    },),
    describe({
      name: filterPnpmOutput.name,
      children: [
        it({
          name: 'removes the allowed cycle warning while keeping other lines',
          fn: async () => {
            const output = [
              `${WARN} There are cyclic workspace dependencies: /abs/package/config/tsdown, /abs/package/module/test, /abs/package/module/numeric-format, /abs/package/module/or-throw`,
              `${WARN} deprecated package: old-pkg@1.0.0`,
              '',
            ]
              .join('\n',);

            const result = filterPnpmOutput(output,);
            expect(result,).not.toContain('cyclic workspace dependencies',);
            expect(result,).toContain('deprecated package',);
          },
        },),
        it({
          name: 'returns empty string for empty input',
          fn: async () => {
            expect(filterPnpmOutput('',),).toBe('',);
          },
        },),
        it({
          name: 'preserves all lines when no cycle warning is present',
          fn: async () => {
            const output = 'some output\nanother line\n';
            expect(filterPnpmOutput(output,),).toBe(output,);
          },
        },),
        it({
          name: 'does not filter unknown cycle warnings',
          fn: async () => {
            const output =
              `${WARN} There are cyclic workspace dependencies: /abs/package/foo, /abs/package/bar\n`;
            expect(filterPnpmOutput(output,),).toBe(output,);
          },
        },),
      ],
    },),
  ],
},);
