import { getLogger } from '@logtape/logtape';
import { path } from '@monochromatic.dev/module-fs-path';
import { Glob } from 'glob';
import { mapParallelAsync } from 'rambdax';
import $c from './child.ts';
import g from './g.ts';
import type { State } from './state.ts';

const l = getLogger(['build', 'br']);

export default async function brStatic(globCache = g()): Promise<State> {
  // TODO: Deprecate glob
  const staticFilePaths = [...new Glob('dist/final/**/*.*', globCache)].filter((staticFilePath) =>
    !['br', 'map', 'd.ts'].some((dotlessNoCompressExt) => staticFilePath.endsWith(`.${dotlessNoCompressExt}`))
  );
  l.debug`br ${staticFilePaths}`;
  return [
    'brStatic',
    'SUCCESS',
    await mapParallelAsync(async function brStatic(staticFilePath) {
      // We're not enabling the squash command line flag because ubuntu-latest (22.04) on GitHub Actions still ships with 1.0.9
      return (await $c(`brotli -v -f -q 11 ${path.resolve(staticFilePath)}`)).stdout;
    }, staticFilePaths),
  ];
}
