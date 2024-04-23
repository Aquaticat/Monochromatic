#!/usr/bin/env node

import {
  fs,
  path,
} from '@monochromatic.dev/module-fs-path';

import { z } from 'zod';
import { parser } from 'zod-opts';
import { $ } from 'zx';

import { mapParallelAsync } from 'rambdax';

import c from '@monochromatic.dev/module-console';
import cssnano from 'cssnano';
import { bundleAsync as lightningcssBundle } from 'lightningcss';
import postcss from 'postcss';

import * as esbuild from 'esbuild';

import {
  Extractor,
  ExtractorConfig,
  type ExtractorResult,
} from '@microsoft/api-extractor';
import { findUp } from 'find-up';
import { glob } from 'glob';

import {
  D,
  esbuildOptions,
} from './js.ts';

import {
  cssnanoPreset,
  lightningcssOptions,
} from './css.ts';

$.prefix += 'source ~/.bashrc && ';

try {
  import.meta.env.DEV = D;
  import.meta.env.PROD = !D;
  import.meta.env.MODE = D ? 'development' : 'production';
} catch {
  c.log(`failed to set import.meta.env.* and that's okay.`);
}

type State = 'SUCCESS' | ['SKIP', string] | State[] | PromiseSettledResult<State>[];

const parsed = parser()
  .args([{ name: 'command', type: z.enum(['build', 'watch', 'clean']) }])
  .options({})
  .parse();

if (parsed.command === 'build') {
  c.log('build', path.resolve());

  c.log(
    await Promise.allSettled([
      (async function css(): Promise<State> {
        const cssFilePaths = await glob('src/**/index.css', { ignore: '**/_*/**' });
        if (cssFilePaths.length === 0) {
          return [
            'SKIP',
            `skipping css, none of ${cssFilePaths} matched by 'src/**/index.css', {ignore: '**/_*/**'} exist.`,
          ];
        }
        return await mapParallelAsync(async function lightningcssEach(cssFilePath): Promise<State> {
          c.log(`lightningcss ${cssFilePath}`);
          const options = lightningcssOptions(cssFilePath);
          const { code, map } = await lightningcssBundle(options);
          const outFilePath = path.join('dist', 'final', cssFilePath.slice('src/'.length));
          await fs.outputFile(outFilePath, code);
          c.log(`postcss ${outFilePath}`);
          const { css: minCode } = await postcss([cssnano(cssnanoPreset)]).process(
            await fs.readFileU(outFilePath),
            { from: outFilePath },
          );
          await fs.outputFile(outFilePath, minCode);
          await fs.outputFile(`${outFilePath}.map`, map!);
          return 'SUCCESS';
        }, cssFilePaths);
      })(),
      (async function indexTs(): Promise<State> {
        const indexTsPaths = await glob('src/**/index.ts', { ignore: '**/_*/**' });
        if (indexTsPaths.length === 0) {
          return [
            'SKIP',
            `skipping index.ts, none of ${indexTsPaths} matched by 'src/**/index.css', {ignore: '**/_*/**'} exist`,
          ];
        }

        c.log('esbuild index.ts', ...indexTsPaths);
        const ctx = await esbuild.context(esbuildOptions(indexTsPaths as [string, ...string[]], 'dist/final'));
        const result = await ctx.rebuild();
        await ctx.dispose();
        await fs.outputFile(
          path.join('dist', 'temp', 'esbuild', 'ts.meta.json'),
          JSON.stringify(result.metafile, null, 2),
        );
        return 'SUCCESS';
      })(),
      (async function genHtml(): Promise<State> {
        const mdxFilePaths = await glob('src/**/*.mdx', { ignore: '**/_*/**', withFileTypes: true });
        if (mdxFilePaths.length === 0) {
          return [
            'SKIP',
            `skipping mdx, none of ${mdxFilePaths} matched by 'src/**/*.mdx', {ignore: '**/_*/**'} exist.`,
          ];
        }

        c.log('cp *.mdx', ...mdxFilePaths.map((mdxFilePath) => mdxFilePath.relative()));
        for await (const mdxFilePath of mdxFilePaths) {
          await fs.cpFile(
            mdxFilePath.relative(),
            path.join('dist', 'temp', 'gen-html', path.relative('src', mdxFilePath.relative())),
          );
        }

        const indexVuePaths = await glob('src/**/index.vue', { ignore: '**/_*/**' });
        c.log('cp index.vue', ...indexVuePaths);
        for await (const indexVuePath of indexVuePaths) {
          await fs.cpFile(indexVuePath, path.join('dist', 'temp', 'gen-html', path.relative('src', indexVuePath)));
        }
        const tomlPaths = await glob('src/**/*.toml', { ignore: '**/_*/**' });
        c.log('cp *.toml', ...tomlPaths);
        for await (const tomlPath of tomlPaths) {
          await fs.cpFile(tomlPath, path.join('dist', 'temp', 'gen-html', path.relative('src', tomlPath)));
        }

        c.log(`gen frontmatters`);

        const outTomlPaths = await glob('dist/temp/gen-html/**/*.toml');
        const outTomlImportPaths = outTomlPaths.map((outTomlPath) => `@/${outTomlPath}`);
        const outTomlImportNames = outTomlPaths.map((outTomlPath) =>
          `frontmatter${
            path
              .relative('dist/temp/gen-html', outTomlPath)
              .replaceAll('.', 'ReplacedDot')
              .replaceAll('/', 'ReplacedSlash')
              .replaceAll('-', 'ReplacedHyphen')
          }`
        );
        const outTomlImportStrs = outTomlImportNames.map((outTomlImportName, i) =>
          `import ${outTomlImportName} from '${outTomlImportPaths[i]}';`
        );
        const outTomlImportStr = outTomlImportStrs.join('\n');
        const frontmattersJson = outTomlImportNames.join(',\n');

        await fs.outputFile(
          path.join('dist', 'temp', 'gen-html', '_fms.ts'),
          `
${outTomlImportStr}

export default [${frontmattersJson}]
`,
        );

        c.log(`gen vue apps`);

        for await (const mdxFilePath of mdxFilePaths) {
          const outputFilePath = path.join(
            'dist',
            'temp',
            'gen-html',
            `${
              path.join(
                path.relative('src', path.join(mdxFilePath.relative(), '..')),
                (await path.parseFs(mdxFilePath.name))
                  .name,
              )
            }.html.ts`,
          );

          c.log(`gen vue app for`, mdxFilePath.name);

          await fs.outputFile(
            outputFilePath,
            `
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { MDXProvider } from '@mdx-js/vue';
import { writeFile } from 'node:fs/promises';
import Layout from './${
              path.relative(
                (await path.parseFs(outputFilePath)).dir,
                (await findUp('index.vue', {
                  cwd: (await path.parseFs(outputFilePath)).dir,
                  stopAt: (await findUp('package.json'))!,
                }))!,
              )
            }';
import Post from './${mdxFilePath.name}';
import frontmatter from './${(await path.parseFs(mdxFilePath.name)).name}.toml';
import frontmatters from '@/dist/temp/gen-html/_fms.ts';

const app = createSSRApp({
  template: '<Layout><MDXProvider :components><Post /></MDXProvider></Layout>',
  components: { Layout, MDXProvider, Post },
});

app.provide('frontmatter', frontmatter);

app.provide('frontmatters', frontmatters);

const html = await renderToString(app);

await writeFile('${mdxFilePath.name}.html', html);
`,
          );

          c.log(`gened vue app at`, outputFilePath);
        }

        const htmlTsFilePaths = await glob('dist/temp/gen-html/**/*.html.ts');
        c.log(`esbuild *.html.ts`, ...htmlTsFilePaths);
        const ctx = await esbuild.context(
          esbuildOptions(htmlTsFilePaths as [string, ...string[]], 'dist/temp/gen-html'),
        );
        const result = await ctx.rebuild();
        await ctx.dispose();
        await fs.outputFile(
          path.join('dist', 'temp', 'esbuild', 'html.ts.meta.json'),
          JSON.stringify(result.metafile, null, 2),
        );

        const htmlJsFilePaths = await glob('dist/temp/gen-html/**/*.html.js');
        c.log(`node *.html.ts ${htmlJsFilePaths}`);
        await mapParallelAsync(
          async function renderVueApp(vueAppPath) {
            await $`node ${vueAppPath}`;
          },
          htmlJsFilePaths,
        );
        return 'SUCCESS';
      })(),
      (async function dts(): Promise<State> {
        try {
          await fs.access(path.join('api-extractor.json'));
        } catch {
          return ['SKIP', `skipping dts, api-extractor.json doesn't exist.`];
        }

        c.log('vue-tsc');
        c.log((await $`vue-tsc`).stdout);
        c.log('api-extractor');

        const extractorConfig: ExtractorConfig = ExtractorConfig.loadFileAndPrepare('api-extractor.json');

        const extractorResult: ExtractorResult = Extractor.invoke(extractorConfig, {
          localBuild: true,

          showVerboseMessages: true,
        });
        if (!extractorResult.succeeded) {
          throw new Error(`api-extractor failed with ${extractorResult}`);
        }

        return 'SUCCESS';
      })(),
    ]),
  );
}

if (parsed.command === 'watch') {
  // TODO: Implement this. priority:high
  throw new Error(`watch is not implemented`);
}

if (parsed.command === 'clean') {
  c.log(`clean`, path.resolve());
  await fs.empty('dist');
}
