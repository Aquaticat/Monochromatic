import c from '@monochromatic.dev/module-console';
import { path } from '@monochromatic.dev/module-fs-path';
import { Glob } from 'glob';
import { mapParallelAsync } from 'rambdax';
import { $ } from 'zx';
import {} from './state.ts';
import g from './g.ts';

export default async function brStatic(globCache = g()) {
  // FIXME: Glob ignore not working?
  const staticFilePaths = [...new Glob('dist/final/**/*.*', globCache)].filter((staticFilePath) =>
    !staticFilePath.endsWith('.br')
  );
  c.log('br', ...staticFilePaths);
  await mapParallelAsync(async function brStatic(staticFilePath) {
    await $`brotli -f -q 11 ${path.resolve(staticFilePath)}`;
  }, staticFilePaths);
}
