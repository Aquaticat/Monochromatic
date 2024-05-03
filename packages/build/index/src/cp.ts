import c from '@monochromatic.dev/module-console';
import {
  fs,
  path,
} from '@monochromatic.dev/module-fs-path';
import { mapParallelAsync } from 'rambdax';
import { indexVueFilePaths, mdxFilePaths, otherFilePaths } from './g.ts';

const cpMdxToml = async () => {
  c.log('cp *.mdx && cp *.toml', ...mdxFilePaths);
  await mapParallelAsync(async (mdxFilePath) =>
    await Promise.all([
      (async function cpMdx() {
        await fs.cpFile(
          mdxFilePath,
          path.join('dist', 'temp', 'gen-html', path.relative('src', mdxFilePath)),
        );
      })(),
      (async function cpToml() {
        const tomlFilePath = `${
          mdxFilePath.slice(
            0,
            -'.mdx'.length,
          )
        }.toml`;
        await fs.cpFile(
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
    ]), mdxFilePaths);
};

const cpIndexVue = async () => {
  c.log('cp index.vue', ...indexVueFilePaths);
  await mapParallelAsync(async function cpIndexVue(indexVueFilePath) {
    await fs.cpFile(
      indexVueFilePath,
      path.join('dist', 'temp', 'gen-html', path.relative('src', indexVueFilePath)),
    );
  }, indexVueFilePaths);
};

export const cpSrc = async () => {
  await Promise.all([
    (async () => {
      await cpMdxToml();
    })(),
    (async () => {
      await cpIndexVue();
    })(),
  ]);
};

export const cpOthers = async () => {
  await mapParallelAsync(async function cpOther(otherFilePath) {
    fs.cpFile(otherFilePath, path.join('dist', 'final', path.relative('src', otherFilePath)));
  }, otherFilePaths);
};
