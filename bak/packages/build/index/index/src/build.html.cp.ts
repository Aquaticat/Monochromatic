import {
  indexVueFilePaths,
  mdxFilePaths,
  otherFilePaths,
} from '@/src/consts.js';
import type { State } from '@/src/state.js';
import { getLogger } from '@logtape/logtape';
import {
  fs,
  path,
} from '@monochromatic-dev/module-fs-path';
import { mapParallelAsync } from 'rambdax';
const l = getLogger(['a', 'cp']);

const cpMdxToml = async (): Promise<State> => {
  l.debug`cp *.mdx && cp *.toml ${mdxFilePaths}`;
  return [
    'cpMdxToml',
    'SUCCESS',
    await mapParallelAsync(async (mdxFilePath) =>
      await Promise.all([
        await fs.cpFile(
          mdxFilePath,
          path.join('dist', 'temp', 'gen-html', path.relative('src', mdxFilePath)),
        ),
        (async function cpToml() {
          const tomlFilePath = `${
            mdxFilePath.slice(
              0,
              -'.mdx'.length,
            )
          }.toml`;
          return await fs.cpFile(
            tomlFilePath,
            path.join(
              'dist',
              'temp',
              'gen-html',
              path.relative(
                'src',
                tomlFilePath,
              ),
            ),
          );
        })(),
      ]), mdxFilePaths),
  ];
};

const cpIndexVue = async (): Promise<State> => {
  l.debug`cp index.vue ${indexVueFilePaths}`;
  return [
    'cpIndexVue',
    'SUCCESS',
    await mapParallelAsync(async (indexVueFilePath) => {
      return await fs.cpFile(
        indexVueFilePath,
        path.join('dist', 'temp', 'gen-html', path.relative('src', indexVueFilePath)),
      );
    }, indexVueFilePaths),
  ];
};

export const cpSrc = async (): Promise<State> => {
  l.debug`cp src`;
  return [
    'cpSrc',
    'SUCCESS',
    await Promise.all([
      cpMdxToml(),
      cpIndexVue(),
    ]),
  ];
};

export const cpOthers = async (): Promise<State> => {
  l.debug`cp others`;
  return [
    'cpOthers',
    'SUCCESS',
    await mapParallelAsync(async function cpOther(otherFilePath) {
      return fs.cpFile(
        otherFilePath,
        path.join('dist', 'final', path.relative('src', otherFilePath)),
      );
    }, otherFilePaths),
  ];
};
