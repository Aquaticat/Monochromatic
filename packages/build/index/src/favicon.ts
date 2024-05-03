import c from '@monochromatic.dev/module-console';
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
import { $ } from 'zx';
import g, { mdxFilePaths } from './g.ts';
import {
  genPngFromSvg,
  supportedRasterImageExtsWoDot,
} from './image.ts';

const genFaviconsFor = async (indexAbsDir: string, lang = 'en', globCache = g()) => {
  const faviconSvgAbsFilePath = `${indexAbsDir}/favicon.svg`;
  const faviconSvgExists = await fs.exists(faviconSvgAbsFilePath);
  if (!faviconSvgExists) {
    c.warn(faviconSvgAbsFilePath, 'not found', 'only raster images will be used for favicons');
  }
  const faviconIcoAbsFilePath = `${indexAbsDir}/favicon.ico`;
  const faviconIcoExists = await fs.exists(faviconIcoAbsFilePath);
  if (!faviconIcoExists) {
    c.warn(faviconIcoAbsFilePath, 'not found', 'will be generated from an existing raster image or favicon.svg');
  }
  const appleTouchIconAbsFilePath = `${indexAbsDir}/apple-touch-icon.png`;
  const appleTouchIconExists = await fs.exists(appleTouchIconAbsFilePath);
  if (!appleTouchIconExists) {
    c.warn(appleTouchIconAbsFilePath, 'not found', 'will be generated from an existing raster image or favicon.svg');
  }

  /* If all raster images exist, then we're done.
  All that's left is optimization, which we defer to another function down the road. */
  if (faviconIcoExists && appleTouchIconExists) {
    return;
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
    await genPngFromSvg(faviconSvgAbsFilePath, lang);
    await fs.cpFile(`${faviconSvgAbsFilePath.slice(0, -'.svg'.length)}.180.png`, appleTouchIconAbsFilePath);
    await $`convert ${[`${faviconSvgAbsFilePath.slice(0, -'.svg'.length)}.32.png`, faviconIcoAbsFilePath]}`;

    return;
  }

  await Promise.all([
    (async function ensureIco() {
      if (!faviconIcoExists) {
        if (faviconRasterAbsFilePaths.length === 0) {
          await $`convert ${['-resize', '32x32', appleTouchIconAbsFilePath, faviconIcoAbsFilePath]}`;
        } else {
          await $`convert ${[
            '-resize',
            '32x32',
            path.resolve(faviconRasterAbsFilePaths.at(0)!),
            faviconIcoAbsFilePath,
          ]}`;
        }
      }
    })(),
    (async function ensureAppleTouchIcon() {
      if (!appleTouchIconExists) {
        if (faviconRasterAbsFilePaths.length === 0) {
          await $`convert ${['-resize', '180x180', faviconIcoAbsFilePath, appleTouchIconAbsFilePath]}`;
        } else {
          await $`convert ${[
            '-resize',
            '180x180',
            path.resolve(faviconRasterAbsFilePaths.at(0)!),
            appleTouchIconAbsFilePath,
          ]}`;
        }
      }
    })(),
  ]);

  // MAYBE: Also generate a web app manifest.
};

export default async function genFavicons() {
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

  await genFaviconsFor(
    distIndexAbsDirForDefaultLang,
    parse(
      await fs.readFileU(path
        .join('src', path.relative(path.join('dist', 'final'), distIndexDirForDefaultLang!), 'index.toml')),
    )
      .lang as string,
  );

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
    async function genFaviconsForOtherLang(indexAbsDir) {
      try {
        await genFaviconsFor(indexAbsDir, path.split(indexAbsDir).at(-1)!);
      } catch (e) {
        c.warn(e, 'falling back to copying from defaultLang');
        try {
          await fs.cpFile(`${distIndexAbsDirForDefaultLang}/favicon.svg`, `${indexAbsDir}/favicon.svg`);
        } catch (e) {
          c.warn(e, 'only raster images will be used for favicons for', path.split(indexAbsDir).at(-1)!);
        }
        try {
          await fs.cpFile(`${distIndexAbsDirForDefaultLang}/favicon.ico`, `${indexAbsDir}/favicon.ico`);
          await fs.cpFile(
            `${distIndexAbsDirForDefaultLang}/apple-touch-icon.png`,
            `${indexAbsDir}/apple-touch-icon.png`,
          );
        } catch (e) {
          c.warn(e, 'only vector images will be used for favicons for', path.split(indexAbsDir).at(-1)!);
        }
      }
    },
    distIndexAbsDirsForOtherLangs,
  );
}
