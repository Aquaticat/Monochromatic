import { getLogger } from '@logtape/logtape';
import {
  fs,
  path,
} from '@monochromatic.dev/module-fs-path';
import isLang from '@monochromatic.dev/module-is-lang';
import { Glob } from 'glob';
import {
  mapParallelAsync,
  partition,
} from 'rambdax';
import { parse } from 'smol-toml';
import g, { mdxFilePaths } from '@/src/consts.js';
import {
  genPngFromSvg,
  supportedRasterImageExtsWoDot,
} from './image.ts';
const l = getLogger(['build', 'favicon']);
import type { PathLike } from 'node:fs';
import $c, { js } from '@/src/child.ts';
import type { State } from '@/src/state.ts';

const genFaviconsFor = async (indexAbsDir: string, lang = 'en', globCache = g()): Promise<State> => {
  l.debug`gen favicons for ${indexAbsDir} with lang ${lang}`;

  const faviconSvgAbsFilePath = `${indexAbsDir}/favicon.svg`;
  const faviconSvgExists = await fs.exists(faviconSvgAbsFilePath);
  if (!faviconSvgExists) {
    l.warn`${faviconSvgAbsFilePath} not found, only raster images will be used for favicons`;
  }
  const faviconIcoAbsFilePath = `${indexAbsDir}/favicon.ico`;
  const faviconIcoExists = await fs.exists(faviconIcoAbsFilePath);
  if (!faviconIcoExists) {
    l.warn`${faviconIcoAbsFilePath} not found, will be generated from an existing raster image or favicon.svg`;
  }
  const appleTouchIconAbsFilePath = `${indexAbsDir}/apple-touch-icon.png`;
  const appleTouchIconExists = await fs.exists(appleTouchIconAbsFilePath);
  if (!appleTouchIconExists) {
    l.warn`${appleTouchIconAbsFilePath} not found, will be generated from an existing raster image or favicon.svg`;
  }

  /* If all raster images exist, then we're done.
  All that's left is optimization, which we defer to another function down the road. */
  if (faviconIcoExists && appleTouchIconExists) {
    return ['genFaviconsFor', 'SKIP', 'All raster images exist'];
  }

  // Prefer generating raster images from other raster images.
  const faviconRasterAbsFilePaths = [
    ...new Glob(
      `${indexAbsDir}/favicon.{${supportedRasterImageExtsWoDot.join(',')}}`,
      globCache,
    ),
  ];

  if (
    faviconRasterAbsFilePaths.length === 0
    && !(faviconSvgExists || faviconIcoExists || appleTouchIconExists)
  ) {
    throw new Error(
      `no favicon exist at ${indexAbsDir}, tried ${faviconSvgAbsFilePath}, ${faviconIcoAbsFilePath}, ${appleTouchIconAbsFilePath}, favicon.*`,
    );
  }

  if (
    faviconRasterAbsFilePaths.length === 0
    && !(faviconIcoExists || appleTouchIconExists)
  ) {
    l.debug`gen rasters from vector ${faviconSvgAbsFilePath} with lang ${lang}`;

    await genPngFromSvg(faviconSvgAbsFilePath, lang);
    const cped = await fs.cpFile(
      `${faviconSvgAbsFilePath.slice(0, -'.svg'.length)}.180.png`,
      appleTouchIconAbsFilePath,
    );
    const { stdoe: converted } = await $c(
      `magick convert ${
        [js(`${faviconSvgAbsFilePath.slice(0, -'.svg'.length)}.32.png`), js(faviconIcoAbsFilePath)].join(' ')
      }`,
    );

    return ['genFaviconsFor', 'SUCCESS', [
      `gened rasters ${cped}, ${converted} from vector ${faviconSvgAbsFilePath} with lang ${lang}`,
    ]];
  }

  return await Promise.all([
    (async function ensureIco(): Promise<State> {
      if (!faviconIcoExists) {
        if (faviconRasterAbsFilePaths.length === 0) {
          return [
            'ensureIco',
            'SUCCESS',
            (await $c(
              `magick convert ${
                ['-resize', '32x32', js(appleTouchIconAbsFilePath), js(faviconIcoAbsFilePath)].join(' ')
              }`,
            ))
              .stdoe,
          ];
        }
        return [
          'ensureIco',
          'SUCCESS',
          (await $c(`magick convert ${
            [
              '-resize',
              '32x32',
              // CHECK: Very brittle, will probably break.
              js(path.resolve(faviconRasterAbsFilePaths.at(0)!)),
              js(faviconIcoAbsFilePath),
            ]
              .join(' ')
          }`))
            .stdoe,
        ];
      }
      return ['ensureIco', 'SKIP', `${faviconIcoAbsFilePath} already exists`];
    })(),
    (async function ensureAppleTouchIcon(): Promise<State> {
      if (!appleTouchIconExists) {
        if (faviconRasterAbsFilePaths.length === 0) {
          return [
            'ensureAppleTouchIcon',
            'SUCCESS',
            (await $c(
              `magick convert ${
                ['-resize', '180x180', js(faviconIcoAbsFilePath), js(appleTouchIconAbsFilePath)].join(' ')
              }`,
            ))
              .stdoe,
          ];
        }
        return [
          'ensureAppleTouchIcon',
          'SUCCESS',
          (await $c(`convert ${
            [
              '-resize',
              '180x180',
              js(path.resolve(faviconRasterAbsFilePaths.at(0)!)),
              js(appleTouchIconAbsFilePath),
            ]
              .join(' ')
          }`))
            .stdoe,
        ];
      }
      return ['ensureAppleTouchIcon', 'SKIP', `${appleTouchIconAbsFilePath} already exists`];
    })(),
  ]);

  // MAYBE: Also generate a web app manifest.
};

export default async function genFavicons(): Promise<State> {
  const indexMdxFilePaths = mdxFilePaths.filter((mdxFilePath) => mdxFilePath.endsWith('index.mdx'));
  const distIndexDirs = await mapParallelAsync(async function getDistIndexDirFromIndexFilePath(indexFilePath) {
    return path.join('dist', 'final', path.relative('src', (await path.parseFs(indexFilePath)).dir));
  }, indexMdxFilePaths);

  const [distIndexDirsForOtherLangs, [distIndexDirForDefaultLang]] = partition(
    (indexDir) => isLang(path.split(indexDir).at(-1)!),
    distIndexDirs,
  );

  const [distIndexAbsDirsForOtherLangs, distIndexAbsDirForDefaultLang] = [
    distIndexDirsForOtherLangs.map((distIndexDirForOtherLang) => path.resolve(distIndexDirForOtherLang)),
    path.resolve(distIndexDirForDefaultLang!),
  ];

  const genedFaviconsForDefault = await genFaviconsFor(
    distIndexAbsDirForDefaultLang,
    parse(
      await fs.readFileU(path
        .join('src', path.relative(path.join('dist', 'final'), distIndexDirForDefaultLang!), 'index.toml')),
    )
      .lang as string,
  );
  l.debug`gened favicons for default ${genedFaviconsForDefault}`;

  return ['genFavicons', 'SUCCESS', [
    genedFaviconsForDefault,
    await mapParallelAsync(
      /* In total, we need three files for each lang.
    favicon.ico (32x32), favicon.svg, and apple-touch-icon.png (180x180)
    (Credits to https://evilmartians.com/chronicles/how-to-favicon-in-2021-six-files-that-fit-most-needs )

    In the case where the user specified all three files,
    it's simple. Just optimize each and serve.

    If we only found raster image(s),
    then don't generate the svg file.
    MAYBE: Issue a warning.
    Then we generate the missing raster image based on the existing one.

    If we only found a svg image, then generate both favicon.ico and apple-touch-icon.png based on it. */
      async function genFaviconsForOtherLang(indexAbsDir): Promise<State> {
        try {
          return await genFaviconsFor(indexAbsDir, path.split(indexAbsDir).at(-1)!);
        } catch (e) {
          l.warn`${e}, falling back to copying from defaultLang`;
          let cpedDefaultSvg: PathLike = '';
          let cpedDefaultIco: PathLike = '';
          let cpedDefaultAppleTouchIcon: PathLike = '';
          try {
            cpedDefaultSvg = await fs.cpFile(
              `${distIndexAbsDirForDefaultLang}/favicon.svg`,
              `${indexAbsDir}/favicon.svg`,
            );
          } catch (e) {
            l.warn`${e}, only raster images will be used for favicons for', ${path.split(indexAbsDir).at(-1)!}`;
          }
          try {
            cpedDefaultIco = await fs.cpFile(
              `${distIndexAbsDirForDefaultLang}/favicon.ico`,
              `${indexAbsDir}/favicon.ico`,
            );
            cpedDefaultAppleTouchIcon = await fs.cpFile(
              `${distIndexAbsDirForDefaultLang}/apple-touch-icon.png`,
              `${indexAbsDir}/apple-touch-icon.png`,
            );
          } catch (e) {
            l.warn`${e}, only vector images will be used for favicons for', ${path.split(indexAbsDir).at(-1)!}`;
          }
          return ['genFaviconsForOtherLang', 'SUCCESS', [cpedDefaultSvg, cpedDefaultIco, cpedDefaultAppleTouchIcon]];
        }
      },
      distIndexAbsDirsForOtherLangs,
    ),
  ]];
}
