import closestPath from '@monochromatic.dev/closest-path-built';

import copyBuiltPackage from '@monochromatic.dev/copy-built-package-built';

import increaseVersion from '@monochromatic.dev/increase-version-built';

import * as fs from 'fs';

import * as esbuild from 'esbuild';

import * as path from 'path';

import * as process from 'process';

import {
  Extractor,
  ExtractorConfig,
} from '@microsoft/api-extractor';

import {
  execa,
  execaNode
} from 'execa';

import {
  getBinPathSync,
} from 'get-bin-path';

const ROOT_DIR = closestPath();

const INTERMEDIATE_DIR = path.join(ROOT_DIR, 'dist', 'intermediate');

const ensureDirExist = (...dir: string[]): void => {
  fs.existsSync(path.join(...dir)) || fs.mkdirSync(path.join(...dir), { recursive: true });
};

const compileTsGenDts = async () => {
  ensureDirExist(INTERMEDIATE_DIR, '1.  tsc');

  const { exitCode } = await execa('tsc');

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

const buildJs = async () => {
  ensureDirExist(INTERMEDIATE_DIR, '1.  esbuild');

  const result = await esbuild.build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    outdir: 'dist/intermediate/1.  esbuild',

    platform: 'node',
    external: [
      'esbuild',
      '@microsoft/api-extractor',
      'typescript',
      'eslint',
      'execa',
      'prettier',
      'dprint',
      'get-bin-path',
      'semver',
      '@ltd/j-toml',
    ],
    format: 'esm',
    target: 'node20',

    metafile: true,
    sourcemap: 'external',

    minifyWhitespace: true,
    minifySyntax: true,
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

const bundleDts = () => {
  ensureDirExist(INTERMEDIATE_DIR, '2.  api-extractor');

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

const buildDts = async (): Promise<void> => {
  await compileTsGenDts();
  bundleDts();
}

const postBuild = (): void => {
  copyBuiltPackage();
  increaseVersion();
};

// Monochromatic dev build system, technically applicable not just to monochromatic.dev
const build = async (): Promise<void> => {
  await Promise.all([buildDts(), buildJs()]);

  ensureDirExist(ROOT_DIR, 'dist', 'final');

  fs.copyFileSync(
    path.join(ROOT_DIR, 'dist', 'intermediate', '2.  api-extractor', 'index.d.ts'),
    path.join(ROOT_DIR, 'dist', 'final', 'index.d.ts'),
  );
  fs.copyFileSync(
    path.join(ROOT_DIR, 'dist', 'intermediate', '1.  esbuild', 'index.js'),
    path.join(ROOT_DIR, 'dist', 'final', 'index.js'),
  );

  postBuild();
};

const clean = (): void => {
  fs.rmSync(path.join(ROOT_DIR, 'dist', 'final'), { recursive: true, force: true });
  fs.rmSync(path.join(ROOT_DIR, 'dist', 'intermediate'), { recursive: true, force: true });
  fs.mkdirSync(path.join(ROOT_DIR, 'dist', 'final'));
  fs.mkdirSync(path.join(ROOT_DIR, 'dist', 'intermediate'));
};

const run = async (): Promise<void> => {
  await execaNode(getBinPathSync() as string);
};

const buildAndRun = async (): Promise<void> => {
  await build();

  await run();
};

const cleanAndBuild = async (): Promise<void> => {
  clean();

  await build();
};

const cleanAndBuildAndRun = async (): Promise<void> => {
  await cleanAndBuild();

  await run();
};

const args = process.argv.slice(2);

switch (args.at(0)) {
  case 'build' || 'b':
    build();
    break;

  case 'clean' || 'c':
    clean();
    break;

  case 'run' || 'r':
    run();
    break;

  case 'build-and-run' || 'bar':
    buildAndRun();
    break;

  case 'clean-and-build' || 'cab':
    cleanAndBuild();
    break;

  case 'clean-and-build-and-run' || 'cabar':
    cleanAndBuildAndRun();
    break;

  default:
    throw TypeError(`first arg ${args.at(0)} not one of build, clean, build-and-run, clean-and-build, clean-and-build-and-run`);
}

export {
  build,
  clean,
  run,
  buildAndRun,
  cleanAndBuild,
  cleanAndBuildAndRun,
};
