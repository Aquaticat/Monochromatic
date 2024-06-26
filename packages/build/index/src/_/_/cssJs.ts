import * as esbuild from 'esbuild';

import { getLogger } from '@logtape/logtape';
import {
  fs,
  path,
} from '@monochromatic.dev/module-fs-path';

import {
  cssFilePaths,
  cssJsFilePaths,
  esbuildOptions,
} from '@/src/consts.ts';
import type { State } from '@/src/state.ts';
import postcssCustomUnits from '@csstools/custom-units';
import postcssColorMixFunction from '@csstools/postcss-color-mix-function';
import postcssOklabFunction from '@csstools/postcss-oklab-function';
import postcssRelativeColorSyntax from '@csstools/postcss-relative-color-syntax';
import postcss from 'postcss';
import postcssCustomMedia from 'postcss-custom-media';
import postcssCustomSelectors from 'postcss-custom-selectors';
import postcssMixins from 'postcss-mixins';
import { mapParallelAsync } from 'rambdax';

const l = getLogger(['app', 'cssJs']);

export default async (): Promise<State> => {
  if (cssJsFilePaths.length === 0) {
    return [
      'cssJs',
      'SKIP',
      `skipping index.ts and index.css, none of ${cssJsFilePaths} matched by src/**/index.{ts,js,css} , {ignore: '**/_*/**'} exist`,
    ];
  }

  l.debug`esbuild index.js index.css ${cssJsFilePaths}`;
  const ctx = await esbuild.context(esbuildOptions(cssJsFilePaths as [string, ...string[]], 'dist/final'));
  const result = await ctx.rebuild();
  l.debug`esbuild built index.js index.css ${cssJsFilePaths}`;

  const [postcssRes, _esbuildDispose, esbuildMetaPath] = await Promise.all([
    await mapParallelAsync(
      async function cssEach(cssFilePath): Promise<State> {
        const outFilePath = path.join('dist', 'final', path.relative('src', cssFilePath));

        l.debug`postcss ${outFilePath}`;

        const { css } = await postcss([
          postcssCustomMedia(),
          postcssCustomSelectors(),
          postcssCustomUnits(),
          postcssColorMixFunction({ preserve: true }),
          postcssRelativeColorSyntax({ preserve: true }),
          postcssOklabFunction({ preserve: true }),
          postcssMixins(),
        ])
          .process(
            await fs.readFileU(outFilePath),
            { from: outFilePath },
          );

        l.debug`css ${cssFilePath} finished at ${outFilePath}`;
        return ['cssEach', 'SUCCESS', await fs.outputFile(outFilePath, css)];
      },
      cssFilePaths,
    ),
    ctx.dispose(),
    await fs.outputFile(
      path.join('dist', 'temp', 'esbuild', 'cssJs.meta.json'),
      JSON.stringify(result.metafile, null, 2),
    ),
  ]);

  return [
    'cssJs',
    'SUCCESS',
    [['postcssRes', 'SUCCESS', postcssRes], ['esbuildMetaPath', 'SUCCESS', esbuildMetaPath]],
  ];
};
