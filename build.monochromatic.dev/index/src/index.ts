// import meow from 'meow';

import closestPath from '@monochromatic.dev/closest-path-built';

import copyBuiltPackage from '@monochromatic.dev/copy-built-package-built';

import increaseVersion from '@monochromatic.dev/increase-version-built';

import fs from 'fs';

import shell from 'shelljs';

import * as esbuild from 'esbuild';

import path from 'path';

import {
  minify,
} from 'terser';

import {
  Extractor,
  ExtractorConfig,
} from '@microsoft/api-extractor';

/*
// Currently it doesn't matter.
const cli = meow(`
node build.js

low-level:
node index.js build src (your index.js dir)
`,);
*/

const ROOT_DIR = closestPath();

const INTERMEDIATE_DIR = path.join(ROOT_DIR, 'dist', 'intermediate');

const ensureDirExist = (dir: string): void => {
  fs.existsSync(path.join(dir)) || fs.mkdirSync(path.join(dir), { recursive: true });
};

// eslint-disable-next-line @typescript-eslint/require-await
const compileTsGenDts = async () => {
  ensureDirExist(path.join(INTERMEDIATE_DIR, '1.  tsc'));

  const { code: exitCode } = shell.exec('tsc', { fatal: true });

  if (exitCode) {
    throw Error(`
1.  tsc
compileTsGenDts
exitCode = ${exitCode}
`);
  }

  console.log(`
1.  tsc
compileTsGenDts
`);
};

const bundleJs = async () => {
  ensureDirExist(path.join(INTERMEDIATE_DIR, '1.  esbuild'));

  const result = await esbuild.build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    outdir: 'dist/intermediate/1.  esbuild',

    platform: 'node',
    external: [
      'shelljs',
      'esbuild',
      'terser',
      '@microsoft/api-extractor',
    ],
    format: 'esm',
    target: 'esnext',

    metafile: true,
    sourcemap: 'external',
  });

  if (result.errors.length > 0) {
    throw Error(`
1.  esbuild
bundleJs
result.errors = ${result.errors.toString()}
`);
  }

  fs.writeFileSync(
    path.join(INTERMEDIATE_DIR, '1.  esbuild', 'meta.json'),
    JSON.stringify(result.metafile, null, 2),
  );

  console.log(`
1.  esbuild
bundleJs
result.metafile = ${await esbuild.analyzeMetafile(result.metafile)}
`);
};

// eslint-disable-next-line @typescript-eslint/require-await
const bundleDts = async (): Promise<void> => {
  ensureDirExist(path.join(INTERMEDIATE_DIR, '2.  api-extractor'));

  const extractorResult = Extractor.invoke(
    ExtractorConfig.loadFileAndPrepare(path.join(ROOT_DIR, 'api-extractor.json')),
    {
      // showVerboseMessages: true,
      typescriptCompilerFolder: path.join(ROOT_DIR, 'node_modules', 'typescript'),
    },
  );

  if (extractorResult.errorCount > 0) {
    throw Error(`
2.  api-extractor
bundleDts
extractorResult.errorCount = ${extractorResult.errorCount}
extractorResult.warningCount = ${extractorResult.warningCount}
`);
  }

  console.log(`
2.  api-extractor
bundleDts
`);
};

const minifyJs = async (): Promise<void> => {
  const { code: codeWithMap, map } = await minify({
    'index.js': fs.readFileSync(path.join(INTERMEDIATE_DIR, '1.  esbuild', 'index.js'), {
      encoding: 'utf8',
    }),
  }, {
    sourceMap: {
      filename: 'index.js',
      content: fs.readFileSync(path.join(INTERMEDIATE_DIR, '1.  esbuild', 'index.js.map'), 'utf8'),
      url: 'index.js.map',
    },
    ecma: 2020,
    compress: false,
    mangle: false,
    module: true,
    format: {
      indent_level: 2,
      keep_numbers: true,
      keep_quoted_props: true,
      quote_style: 3,
    },
    keep_classnames: true,
    keep_fnames: true,
  });

  const { code } = await minify({
    'index.js': fs.readFileSync(path.join(INTERMEDIATE_DIR, '1.  esbuild', 'index.js'), {
      encoding: 'utf8',
    }),
  }, {
    ecma: 2020,
    compress: false,
    mangle: false,
    module: true,
    format: {
      indent_level: 2,
      keep_numbers: true,
      keep_quoted_props: true,
      quote_style: 3,
    },
    keep_classnames: true,
    keep_fnames: true,
  });

  ensureDirExist(path.join(INTERMEDIATE_DIR, '2.  terser'));

  fs.writeFileSync(path.join(ROOT_DIR, 'dist', 'intermediate', '2.  terser', 'mapped.js'), codeWithMap!);

  fs.writeFileSync(path.join(ROOT_DIR, 'dist', 'intermediate', '2.  terser', 'mapped.js.map'), map);

  fs.writeFileSync(path.join(INTERMEDIATE_DIR, '2.  terser', 'index.js'), code!);
};

const build1 = async (): Promise<void> => {
  await Promise.all([compileTsGenDts(), bundleJs()]);
};

const build2 = async (): Promise<void> => {
  await Promise.all([bundleDts(), minifyJs()]);
};

const postBuild = (): void => {
  copyBuiltPackage();
  increaseVersion();
};

// Monochromatic dev build system, technically applicable not just to monochromatic.dev
const build = async (): Promise<void> => {
  await build1();

  await build2();

  // await build3();

  ensureDirExist(path.join(ROOT_DIR, 'dist', 'final'));

  fs.copyFileSync(
    path.join(ROOT_DIR, 'dist', 'intermediate', '2.  api-extractor', 'index.d.ts'),
    path.join(ROOT_DIR, 'dist', 'final', 'index.d.ts'),
  );
  fs.copyFileSync(
    path.join(ROOT_DIR, 'dist', 'intermediate', '2.  terser', 'index.js'),
    path.join(ROOT_DIR, 'dist', 'final', 'index.js'),
  );

  postBuild();
};

const clean = (): void => {
  // await ctx.dispose();

  /*
  throw new Error(`
Not implemented!
There's little need to clean output dir programmatically.
  `);
  */

  fs.rmSync(path.join(ROOT_DIR, 'dist', 'final'), { recursive: true, force: true });
  fs.rmSync(path.join(ROOT_DIR, 'dist', 'intermediate'), { recursive: true, force: true });
  fs.mkdirSync(path.join(ROOT_DIR, 'dist', 'final'));
  fs.mkdirSync(path.join(ROOT_DIR, 'dist', 'intermediate'));
};

const run = (): void => {
  shell.exec('node dist/final/index.js');
};

const buildAndRun = async (): Promise<void> => {
  await build();

  run();
};

const cleanAndBuild = async (): Promise<void> => {
  clean();

  await build();
};

const cleanAndBuildAndRun = async (): Promise<void> => {
  await cleanAndBuild();

  run();
};

export {
  build,
  clean,
  run,
  buildAndRun,
  cleanAndBuild,
  cleanAndBuildAndRun,
};
