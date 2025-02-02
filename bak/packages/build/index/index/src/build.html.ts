import {
  finalHtmlFilePathsWoExt,
  mdxFilePaths,
  tempHtmlFilePathsWoExt,
} from '@/src/consts.js';
import type { State } from '@/src/state.ts';
import { getLogger } from '@logtape/logtape';
import {
  fs,
  path,
} from '@monochromatic-dev/module-fs-path';
import {
  mapParallelAsync,
  pipedAsync,
} from 'rambdax';
import {
  cpOthers,
  cpSrc,
} from './build.html.cp.ts';
import genFavicons from './build.html.favicon.js';
import rehypedHtml from './build.html.rehype.ts';
import genBuildRunVueApps from './build.html.vue.js';

const l = getLogger(['a', 'html']);

const processHtmlsToFinal = async (): Promise<State> => {
  l.debug`process *.html ${tempHtmlFilePathsWoExt}`;
  return [
    'processHtmlsToFinal',
    'SUCCESS',
    await mapParallelAsync(
      async (tempHtmlFilePathsWoExt) => {
        return await fs.outputFile(
          path.join(
            'dist',
            'final',
            path.relative(
              path.join('dist', 'temp', 'html'),
              `${tempHtmlFilePathsWoExt}.html`,
            ),
          ),
          await pipedAsync(`${tempHtmlFilePathsWoExt}.html`, fs.readFileU, rehypedHtml),
        );
      },
      tempHtmlFilePathsWoExt,
    ),
  ];
};

const ensureHtmlStructure = async function ensureHtmlStructure(): Promise<State> {
  l.debug`final *.html -> */index.html ${finalHtmlFilePathsWoExt}`;
  return [
    'ensureHtmlStructure',
    'SUCCESS',
    await mapParallelAsync(
      async function cpToDir(finalHtmlFilePathWoExt) {
        return await fs.cpFile(
          `${finalHtmlFilePathWoExt}.html`,
          path.join(
            finalHtmlFilePathWoExt,
            'index.html',
          ),
        );
      },
      finalHtmlFilePathsWoExt.filter((finalHtmlFilePathWoExt) =>
        !finalHtmlFilePathWoExt.endsWith('/index')
      ),
    ),
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

      return ['genHtmls', 'SUCCESS', [
        ranVue,
        processedHtmlsToFinal,
        ensuredHtmlStructure,
      ]];
    })(),
    (async function genOthers(): Promise<State> {
      l.debug`gen others`;

      const cpedOthers = await cpOthers();
      l.debug`gen others cped others ${cpedOthers}`;

      const genedFavicons = await genFavicons();
      l.debug`gen others gened favicons ${genedFavicons}`;

      return ['genOthers', 'SUCCESS', [cpedOthers, genedFavicons]];
    })(),
  ]);
  l.debug`gen html gened final ${genedFinal}`;

  // TODO: Generate alternate post (404) pages

  return ['genHtml', 'SUCCESS', [cpedSrc, genedFinal]];
}
