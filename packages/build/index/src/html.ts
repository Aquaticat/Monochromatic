import { getLogger } from '@logtape/logtape';
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
import {
  cpOthers,
  cpSrc,
} from './cp.ts';
import genFavicons from './favicon.ts';
import g, { mdxFilePaths } from './g.ts';
import rehypedHtml from './rehype.ts';
import type { State } from './state.ts';
import genBuildRunVueApps from './vue.ts';

const l = getLogger(['build', 'html']);

const processHtmlsToFinal = async (globCache = g()): Promise<State> => {
  const htmlFilePaths = [...new Glob('dist/temp/html/**/*.html', globCache)];
  l.debug`process *.html ${htmlFilePaths}`;
  return [
    'processHtmlsToFinal',
    'SUCCESS',
    await mapParallelAsync(
      async (htmlFilePath) => {
        return await fs.outputFile(
          path.join(
            'dist',
            'final',
            path.relative(path.join('dist', 'temp', 'html'), htmlFilePath),
          ),
          await pipedAsync(htmlFilePath, fs.readFileU, rehypedHtml),
        );
      },
      htmlFilePaths,
    ),
  ];
};

const ensureHtmlStructure = async function ensureHtmlStructure(): Promise<State> {
  const finalHtmlFilePaths = await glob('dist/final/**/*.html', { ignore: '**/index.html' });
  l.debug`final *.html -> */index.html ${finalHtmlFilePaths}`;
  return [
    'ensureHtmlStructure',
    'SUCCESS',
    await mapParallelAsync(async function cpToDir(finalHtmlFilePath) {
      return await fs.cpFile(
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
    }, finalHtmlFilePaths),
  ];
};

export default async function genHtml(): Promise<State> {
  if (mdxFilePaths.length === 0) {
    return [
      'genHtml',
      'SKIP',
      `skipping mdx, none of ${mdxFilePaths} matched by 'src/**/*.mdx', {ignore: '**/_*/**'} exist.`,
    ];
  }

  const cpedSrc = await cpSrc();
  l.debug`gen html cped src ${cpedSrc}`;

  const genedFinal = await Promise.all([
    (async function genHtmls(): Promise<State> {
      l.debug`gen htmls`;

      const ranVue = await genBuildRunVueApps();
      l.debug`gen htmls ran vue ${ranVue}`;

      const processedHtmlsToFinal = await processHtmlsToFinal();
      l.debug`gen htmls processed htmls to final ${processedHtmlsToFinal}`;

      const ensuredHtmlStructure = await ensureHtmlStructure();
      l.debug`gen htmls ensured html structure ${ensuredHtmlStructure}`;

      return ['genHtmls','SUCCESS', [ranVue, processedHtmlsToFinal, ensuredHtmlStructure]];
    })(),
    (async function genOthers(): Promise<State> {
      l.debug`gen others`;

      const cpedOthers = await cpOthers();
      l.debug`gen others cped others ${cpedOthers}`;

      const genedFavicons = await genFavicons();
      l.debug`gen others gened favicons ${genedFavicons}`;

      return ['genOthers','SUCCESS', [cpedOthers, genedFavicons]];
    })(),
  ]);
  l.debug`gen html gened final ${genedFinal}`;

  // TODO: Generate alternate post (404) pages

  return ['genHtml','SUCCESS', [cpedSrc, genedFinal]];
}
