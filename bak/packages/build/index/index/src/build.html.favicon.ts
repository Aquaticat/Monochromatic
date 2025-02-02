import {
  finalOtherFileAbsPaths,
  mdxFilePaths,
} from '@/src/consts.js';
import { getLogger } from '@logtape/logtape';
import {
  fs,
  path,
} from '@monochromatic-dev/module-fs-path';
import { parse } from '@std/toml';
import {
  mapParallelAsync,
  partition,
} from 'rambdax';
import {
  genPngFromSvg,
  supportedRasterImageExtsWoDot,
} from './build.html.image.ts';
const l = getLogger(['a', 'favicon']);
import type { State } from '@/src/state.ts';
import { isLangString as isLang } from '@monochromatic-dev/module-es/ts';
import { exec } from '@monochromatic-dev/module-node/ts';
import type { PathLike } from 'node:fs';

const genFaviconsFor = async (indexAbsDir: string, lang = 'en'): Promise<State> => {
  l.debug`gen favicons for ${indexAbsDir} with lang ${lang}`;

  const faviconSvgAbsFilePath = `${indexAbsDir}/favicon.svg`;
  const faviconSvgExists = await fs.exists(faviconSvgAbsFilePath);
  if (!faviconSvgExists) {
    l
      .warn`${faviconSvgAbsFilePath} not found, only raster images will be used for favicons`;
  }
  const faviconIcoAbsFilePath = `${indexAbsDir}/favicon.ico`;
  const faviconIcoExists = await fs.exists(faviconIcoAbsFilePath);
  if (!faviconIcoExists) {
    l
      .warn`${faviconIcoAbsFilePath} not found, will be generated from an existing raster image or favicon.svg`;
  }
  const appleTouchIconAbsFilePath = `${indexAbsDir}/apple-touch-icon.png`;
  const appleTouchIconExists = await fs.exists(appleTouchIconAbsFilePath);
  if (!appleTouchIconExists) {
    l
      .warn`${appleTouchIconAbsFilePath} not found, will be generated from an existing raster image or favicon.svg`;
  }

  /* If all raster images exist, then we're done.
  All that's left is optimization, which we defer to another function down the road. */
  if (faviconIcoExists && appleTouchIconExists) {
    return ['genFaviconsFor', 'SKIP', 'All raster images exist'];
  }

  // Prefer generating raster images from other raster images.
  const faviconRasterAbsFilePath = supportedRasterImageExtsWoDot
    .map((supportedRasterImageExtWoDot) =>
      path.join(indexAbsDir, `favicon.${supportedRasterImageExtWoDot}`)
    )
    .find((potentialExistingFaviconRasterAbsFilePath) =>
      finalOtherFileAbsPaths.includes(potentialExistingFaviconRasterAbsFilePath)
    );

  if (
    !faviconRasterAbsFilePath
    && !(faviconSvgExists || faviconIcoExists || appleTouchIconExists)
  ) {
    throw new Error(
      `no favicon exist at ${indexAbsDir}, tried ${faviconSvgAbsFilePath}, ${faviconIcoAbsFilePath}, ${appleTouchIconAbsFilePath}, favicon.*`,
    );
  }

  if (
    !faviconRasterAbsFilePath
    && !(faviconIcoExists || appleTouchIconExists)
  ) {
    l.debug`gen rasters from vector ${faviconSvgAbsFilePath} with lang ${lang}`;

    await genPngFromSvg(faviconSvgAbsFilePath, lang);
    const cped = await fs.cpFile(
      `${faviconSvgAbsFilePath.slice(0, -'.svg'.length)}.180.png`,
      appleTouchIconAbsFilePath,
    );
    const { all: converted } = await exec`magick convert
    ${`${faviconSvgAbsFilePath.slice(0, -'.svg'.length)}.32.png`}
    ${faviconIcoAbsFilePath}`;

    return ['genFaviconsFor', 'SUCCESS', [
      `gened rasters ${cped}, ${converted} from vector ${faviconSvgAbsFilePath} with lang ${lang}`,
    ]];
  }

  return await Promise.all([
    (async function ensureIco(): Promise<State> {
      if (!faviconIcoExists) {
        if (!faviconRasterAbsFilePath) {
          return [
            'ensureIco',
            'SUCCESS',
            // TODO: Do we need to first check for if svg exists here?
            (await exec`magick convert
              -resize
              32x32
              ${faviconSvgAbsFilePath}
              ${faviconIcoAbsFilePath}`)
              .all,
          ];
        }
        return [
          'ensureIco',
          'SUCCESS',
          (await exec`magick convert
            -resize
            32x32
            ${faviconRasterAbsFilePath}
            ${faviconIcoAbsFilePath}`)
            .all,
        ];
      }
      return ['ensureIco', 'SKIP', `${faviconIcoAbsFilePath} already exists`];
    })(),
    (async function ensureAppleTouchIcon(): Promise<State> {
      if (!appleTouchIconExists) {
        if (!faviconRasterAbsFilePath) {
          return [
            'ensureAppleTouchIcon',
            'SUCCESS',
            (await exec`magick convert
            -resize
            180x180
            ${faviconIcoAbsFilePath}
            ${appleTouchIconAbsFilePath}`)
              .all,
          ];
        }
        return [
          'ensureAppleTouchIcon',
          'SUCCESS',
          (await exec`magick convert
            -resize
            180x180
            ${faviconRasterAbsFilePath}
            ${appleTouchIconAbsFilePath}`)
            .all,
        ];
      }
      return [
        'ensureAppleTouchIcon',
        'SKIP',
        `${appleTouchIconAbsFilePath} already exists`,
      ];
    })(),
  ]);

  // MAYBE: Also generate a web app manifest.
};

export default async function genFavicons(): Promise<State> {
  const indexMdxFilePaths = mdxFilePaths.filter((mdxFilePath) =>
    mdxFilePath.endsWith('index.mdx')
  );
  const distIndexDirs = await mapParallelAsync(
    async function getDistIndexDirFromIndexFilePath(indexFilePath) {
      return path.join(
        'dist',
        'final',
        path.relative('src', (await path.parseFs(indexFilePath)).dir),
      );
    },
    indexMdxFilePaths,
  );

  const [distIndexDirsForOtherLangs, [distIndexDirForDefaultLang]] = partition(
    (indexDir) => isLang(path.split(indexDir).at(-1)!),
    distIndexDirs,
  );

  const [distIndexAbsDirsForOtherLangs, distIndexAbsDirForDefaultLang] = [
    distIndexDirsForOtherLangs.map((distIndexDirForOtherLang) =>
      path.resolve(distIndexDirForOtherLang)
    ),
    path.resolve(distIndexDirForDefaultLang!),
  ];

  const genedFaviconsForDefault = await genFaviconsFor(
    distIndexAbsDirForDefaultLang,
    parse(
      await fs.readFileU(path
        .join(
          'src',
          path.relative(path.join('dist', 'final'), distIndexDirForDefaultLang!),
          'index.toml',
        )),
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
            l.warn`${e}, only raster images will be used for favicons for', ${path
              .split(indexAbsDir)
              .at(-1)!}`;
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
            l.warn`${e}, only vector images will be used for favicons for', ${path
              .split(indexAbsDir)
              .at(-1)!}`;
          }
          return ['genFaviconsForOtherLang', 'SUCCESS', [
            cpedDefaultSvg,
            cpedDefaultIco,
            cpedDefaultAppleTouchIcon,
          ]];
        }
      },
      distIndexAbsDirsForOtherLangs,
    ),
  ]];
}
