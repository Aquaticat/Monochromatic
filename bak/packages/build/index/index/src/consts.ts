import { getLogger } from '@logtape/logtape';
import {
  fs,
  path,
} from '@monochromatic-dev/module-fs-path';
import type { Dirent } from 'node:fs';
import { piped } from 'rambdax';

const l = getLogger(['a', 'consts']);

const srcDrs = await (async (): Promise<Dirent[]> => {
  try {
    return (await fs.readdir('src', { withFileTypes: true, recursive: true })).filter((
      srcDr,
    ) => !srcDr.parentPath.includes('/_'));
  } catch (e) {
    l.error`src ${e}`;
    return [];
  }
})();

const srcFileDrs = srcDrs.filter((srcDr) => srcDr.isFile());

const indexJsFileDrs = srcFileDrs.filter((srcFileDr) =>
  srcFileDr.name === 'index.js' || srcFileDr.name === 'index.ts'
);

export const indexJsFilePaths: string[] = indexJsFileDrs.map(fs.toPathStr);

const binJsFileDrs = srcFileDrs.filter((srcFileDr) =>
  srcFileDr.name === 'bin.js' || srcFileDr.name === 'bin.ts'
);

export const binJsFilePaths: string[] = binJsFileDrs.map(fs.toPathStr);

const testJsFileDrs = srcFileDrs.filter((srcFileDr) =>
  srcFileDr.name.endsWith('.test.js') || srcFileDr.name.endsWith('.test.ts')
);

export const testJsFilePaths: string[] = testJsFileDrs.map(fs.toPathStr);

export const outTestJsPaths: string[] = testJsFilePaths.map((testJsFilePath) =>
  path.join(
    'dist',
    'final',
    path.relative(
      'src',
      // TODO: Replace this with path.parseFs
      `${testJsFilePath.slice(0, -'ts'.length)}js`,
    ),
  )
);

const mdxFileDrs = srcFileDrs.filter((srcFileDr) => srcFileDr.name.endsWith('.mdx'));

export const mdxFilePaths: string[] = mdxFileDrs.map(fs.toPathStr);

const outMdxPaths = mdxFilePaths.map((mdxFilePath) =>
  path.join(
    'dist',
    'temp',
    'gen-html',
    path.relative(
      'src',
      mdxFilePath,
    ),
  )
);

export const outMdxImportPathToNames: Map<string, string> = new Map(
  outMdxPaths.map((outMdxPath) => [
    `./${
      path
        .relative('dist/temp/gen-html', outMdxPath)
    }`,

    piped(
      path
        .relative('dist/temp/gen-html', outMdxPath),
      path.encodeImportSafeStr,
    ),
  ]),
);

export const outMdxImportStr: string =
  (Array.from(outMdxImportPathToNames).map(([outMdxImportPath, outMdxImportName]) =>
    `import ${outMdxImportName} from '${outMdxImportPath}';`
  ))
    .join(
      '\n',
    );

const outTomlPaths = outMdxPaths.map((outMdxPath) =>
  `${
    outMdxPath.slice(
      0,
      -'.mdx'.length,
    )
  }.toml`
);

export const outTomlImportPathToNames: Map<string, string> = new Map(
  outTomlPaths.map((outTomlPath) => [
    `./${
      path
        .relative('dist/temp/gen-html', outTomlPath)
    }`,

    piped(
      path
        .relative('dist/temp/gen-html', outTomlPath),
      path.encodeImportSafeStr,
    ),
  ]),
);

export const outTomlImportStr: string =
  (Array.from(outTomlImportPathToNames).map(([outTomlImportPath, outTomlImportName]) =>
    `import ${outTomlImportName} from '${outTomlImportPath}';`
  ))
    .join('\n');
l.debug`outTomlImportStr ${outTomlImportStr}`;

const indexVueFileDrs = srcFileDrs.filter((srcFileDr) => srcFileDr.name === 'index.vue');

export const indexVueFilePaths: string[] = indexVueFileDrs.map((indexVueFileDr) =>
  path.join(indexVueFileDr.parentPath, indexVueFileDr.name)
);
l.debug`indexVueFilePaths ${indexVueFilePaths}`;

const outIndexVuePaths = indexVueFilePaths.map((indexVueFilePath) =>
  path.join(
    'dist',
    'temp',
    'gen-html',
    path.relative(
      'src',
      indexVueFilePath,
    ),
  )
);

export const outIndexVueImportPathToNames: Map<string, string> = new Map(
  outIndexVuePaths.map((outIndexVuePath) => [
    `./${
      path
        .relative('dist/temp/gen-html', outIndexVuePath)
    }`,

    piped(
      path
        .relative('dist/temp/gen-html', outIndexVuePath),
      path.encodeImportSafeStr,
    ),
  ]),
);
l.debug`outIndexVueImportPathToNames ${outIndexVueImportPathToNames}`;

export const outIndexVueImportStr: string =
  (Array.from(outIndexVueImportPathToNames).map((
    [outIndexVueImportPath, outIndexVueImportName],
  ) => `import ${outIndexVueImportName} from '${outIndexVueImportPath}';`))
    .join('\n');

const cssFileDrs = srcFileDrs.filter((srcFileDr) => srcFileDr.name === 'index.css');

export const cssFilePaths: string[] = cssFileDrs.map(fs.toPathStr);

export const cssJsFilePaths: string[] = cssFilePaths.concat(
  indexJsFilePaths,
  binJsFilePaths,
);

const otherFileDrs = srcFileDrs.filter((srcFileDr) =>
  ![
    'js',
    'ts',
    'jsx',
    'tsx',
    'vue',
    'html',
    'mdx',
    'toml',
    'mjs',
    'mts',
  ]
    .some((dotlessSrcExt) => srcFileDr.name.endsWith(`.${dotlessSrcExt}`))
);

export const otherFilePaths: string[] = otherFileDrs.map(fs.toPathStr);

l.debug`otherFilePaths ${otherFilePaths}`;

// FIXME: Need to account for automatically generated 404 pages.
export const finalHtmlFilePathsWoExt: string[] = mdxFilePaths.map((mdxFilePath) =>
  path.join('dist', 'final', path.relative('src', mdxFilePath.slice(0, -'.mdx'.length)))
);
export const tempHtmlFilePathsWoExt: string[] = mdxFilePaths.map((mdxFilePath) =>
  path.join(
    'dist',
    'temp',
    'html',
    path.relative('src', mdxFilePath.slice(0, -'.mdx'.length)),
  )
);

export const finalOtherFilePaths: string[] = otherFilePaths.map((otherFilePath) =>
  path.join('dist', 'final', path.relative('src', otherFilePath))
);

export const finalOtherFileAbsPaths: string[] = finalOtherFilePaths.map((
  finalOtherFilePath,
) => path.resolve(finalOtherFilePath));

export const finalJsFilePaths: string[] = indexJsFilePaths.map((indexJsFilePath) =>
  path.join('dist', 'final', path.relative('src', indexJsFilePath))
);

export const finalCssFilePaths: string[] = cssFilePaths.map((cssFilePath) =>
  path.join('dist', 'final', path.relative('src', cssFilePath))
);

export const staticWebServerConfFilePath: string = path.join(
  'dist',
  'temp',
  'server',
  'static-web-server.toml',
);

export { default as external } from './consts.external.ts';

export { default as esbuildOptions } from './consts.esbuildOptions.ts';

export const cacheRootDir: string = path.join('dist', 'temp', 'cache');
