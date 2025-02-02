// TODO: Extract this into module/node

import type { State } from '@/src/state.ts';
import { getLogger } from '@logtape/logtape';
import {
  fs,
  path,
} from '@monochromatic-dev/module-fs-path';
import { exec } from '@monochromatic-dev/module-node/ts';
import { mapParallelAsync } from 'rambdax';
import sharp from 'sharp';
import { optimize } from 'svgo';
const l = getLogger(['a', 'image']);

// Stolen from https://sharp.pixelplumbing.com/api-input
const getNormalSize = function getNormalSize(
  width: number,
  height: number,
  orientation: number = 0,
) {
  return orientation >= 5
    ? { width: height, height: width }
    : { width, height };
};

export const supportedRasterImageExtsWoDot: string[] = [
  'jpeg',
  'jp2',
  'jxl',
  'png',
  'webp',
  'avif',
  'tiff',
];

export const outputSmallIconSizes: number[] = [16, 24, 32, 48];

export const outputFaviconSizes: number[] = [32, 180, 192, 512];

export const outputPictureSizes: number[] = [768, 1024, 1920];

export const genPngFromSvg = async (
  inputImageAbsPath: string,
  lang = 'en',
  outputSizes: number[] = outputFaviconSizes,
): Promise<State> => {
  return [
    'genPngFromSvg',
    'SUCCESS',
    await Promise.all([
      (async function genPngForOwnSize(): Promise<State> {
        l.debug`gen png for own size`;

        // Execa auto quotes paths as long as they're in ${}
        // No extra JSON.stringify needed.
        // However, wrapping them in ${} is needed.
        const { all } = await exec`rsvg-convert
          --output=${`${inputImageAbsPath.slice(0, -'.svg'.length)}.png`}
          ${inputImageAbsPath}`;

        return ['genPngForOwnSize', 'SUCCESS', ['gen png for own size', all]];
      })(),
      (async function genPngForOutputSizes(): Promise<State> {
        return await mapParallelAsync(async function genPngForOutputSize(outputSize) {
          l.debug`gen png for output size ${outputSize}`;

          const { all } = await exec`rsvg-convert
            --accept-language=${lang}
            --keep-aspect-ratio
            --width=${outputSize}
            --output=${`${inputImageAbsPath.slice(0, -'.svg'.length)}.${outputSize}.png`}
            ${inputImageAbsPath}`;

          return [`gen png for output size ${outputSize}`, 'SUCCESS', all];
        }, outputSizes);
      })(),
    ]),
  ];
};

export default async function genOptimizedImages(
  inputImageAbsPath: string,
  outputSizes: number[] = [...outputPictureSizes],
): Promise<State> {
  const inputImageExt = (await path.parseFs(inputImageAbsPath)).ext;

  if (inputImageExt === '.svg') {
    return [
      'genOptimizedImages',
      'SUCCESS',
      await fs.outputFile(
        `${inputImageAbsPath.slice(0, -inputImageExt.length)}.min.svg`,
        optimize(await fs.readFileU(inputImageAbsPath), {
          plugins: [{ name: 'preset-default' }],
        })
          .data,
      ),
    ];
  }

  if (supportedRasterImageExtsWoDot.includes(inputImageExt.slice(1))) {
    const inputImage = sharp(inputImageAbsPath, { pages: -1, limitInputPixels: false });

    return [
      'genOptimizedImages',
      'SUCCESS',
      await Promise.all([
        (async function genOptimizedImageForOwnSize(): Promise<State> {
          await inputImage.rotate().avif().toFile(
            `${inputImageAbsPath.slice(0, -inputImageExt.length)}.min.avif`,
          );
          return ['genOptimizedImagesForOwnSize', 'SUCCESS', [
            inputImageAbsPath,
            `${inputImageAbsPath.slice(0, -inputImageExt.length)}.min.avif`,
          ]];
        })(),
        (async function genOptimizedImageForOutputSizes(): Promise<State> {
          const metadata = await inputImage.metadata();

          const metadataWSize = {
            ...metadata,
            width: metadata.width || Math.max(...outputSizes),
            height: metadata.height || Math.max(...outputSizes),
          };

          const inputImageWidth = getNormalSize(
            metadataWSize.width,
            metadataWSize.height,
            metadataWSize.orientation,
          )
            .width;

          const filteredOutputSizes = outputSizes.filter((outputSize) =>
            outputSize < inputImageWidth
          );
          return await mapParallelAsync(
            async function genOptimizedImage(outputSize): Promise<State> {
              await inputImage.rotate().avif().toFile(
                `${inputImageAbsPath.slice(0, -inputImageExt.length)}.${outputSize}.avif`,
              );
              return [`gen optimized image for size ${outputSize}`, 'SUCCESS', [
                inputImageAbsPath,
                `${inputImageAbsPath.slice(0, -inputImageExt.length)}.${outputSize}.avif`,
              ]];
            },
            filteredOutputSizes,
          );
        })(),
      ]),
    ];
  }

  throw new TypeError(`unsupported extension ${inputImageExt} of ${inputImageAbsPath}`);
}
