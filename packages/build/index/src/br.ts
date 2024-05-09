import { getLogger } from '@logtape/logtape';
import { path } from '@monochromatic.dev/module-fs-path';
import { Glob } from 'glob';
import { mapParallelAsync } from 'rambdax';
import $c from './child.ts';
import type { State } from './state.ts';
import g from './g.ts';

const l = getLogger(['build', 'br']);

export default async function brStatic(globCache = g()): Promise<State> {
  // TODO: Deprecate glob
  const staticFilePaths = [...new Glob('dist/final/**/*.*', globCache)].filter((staticFilePath) =>
    !['br', 'map', 'd.ts'].some((dotlessNoCompressExt) => staticFilePath.endsWith(`.${dotlessNoCompressExt}`))
  );
  l.debug`br ${staticFilePaths}`;
  return ['brStatic','SUCCESS', await mapParallelAsync(async function brStatic(staticFilePath) {
    return (await $c(`brotli -v -s -f -q 11 ${path.resolve(staticFilePath)}`)).stdout;
  }, staticFilePaths)];
}
