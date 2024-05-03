import c from '@monochromatic.dev/module-console';
import {
  fs,
  path,
} from '@monochromatic.dev/module-fs-path';
import {
  Glob,
  glob,
} from 'glob';
import {
  mapParallelAsync,
  pipedAsync,
} from 'rambdax';
import rehypedHtml from './rehype.ts';
import {
  cpOthers,
  cpSrc,
} from './cp.ts';
import genFavicons from './favicon.ts';
import g, { mdxFilePaths } from './g.ts';
import type { State } from './state.ts';
import genBuildRunVueApps from './vue.ts';

const processHtmlsToFinal = async (globCache = g()) => {
  const htmlFilePaths = [...new Glob('dist/temp/html/**/*.html', globCache)];
  c.log(`process *.html`, ...htmlFilePaths);
  await mapParallelAsync(
    async (htmlFilePath) => {
      await fs.outputFile(
        path.join(
          'dist',
          'final',
          path.relative(path.join('dist', 'temp', 'html'), htmlFilePath),
        ),
        await pipedAsync(htmlFilePath, fs.readFileU, rehypedHtml),
      );
    },
    htmlFilePaths,
  );
};

const ensureHtmlStructure = async function ensureHtmlStructure() {
  const finalHtmlFilePaths = await glob('dist/final/**/*.html', { ignore: '**/index.html' });
  c.log(`final *.html -> */index.html`, ...finalHtmlFilePaths);
  await mapParallelAsync(async function cpToDir(finalHtmlFilePath) {
    await fs.cpFile(
      finalHtmlFilePath,
      path.join(
        finalHtmlFilePath,
        '..',
        (await path.parseFs(
          path
            .split(finalHtmlFilePath)
            .at(-1)!,
        ))
          .name,
        'index.html',
      ),
    );
  }, finalHtmlFilePaths);
};

export default async function genHtml(): Promise<State> {
  if (mdxFilePaths.length === 0) {
    return [
      'SKIP',
      `skipping mdx, none of ${mdxFilePaths} matched by 'src/**/*.mdx', {ignore: '**/_*/**'} exist.`,
    ];
  }

  await cpSrc();

  await Promise.all([
    (async function genHtmls() {
      await genBuildRunVueApps();

      await processHtmlsToFinal();

      await ensureHtmlStructure();
    })(),
    (async function genOthers() {
      await cpOthers();
      await genFavicons();
    })(),
  ]);

  // TODO: Generate alternate post (404) pages

  return 'SUCCESS';
}
