import {
  fs,
  path,
} from '@monochromatic.dev/module-fs-path';
import { mapParallelAsync } from 'rambdax';
import sharp from 'sharp';
import { optimize } from 'svgo';
import { $ } from 'zx';

// Stolen from https://sharp.pixelplumbing.com/api-input
const getNormalSize = function getNormalSize(width: number, height: number, orientation: number = 0) {
  return orientation >= 5
    ? { width: height, height: width }
    : { width, height };
};

export const supportedRasterImageExtsWoDot = ['jpeg', 'jp2', 'jxl', 'png', 'webp', 'avif', 'tiff'];

export const outputSmallIconSizes = [16, 24, 32, 48];

export const outputFaviconSizes = [32, 180, 192, 512];

export const outputPictureSizes = [768, 1024, 1920];

export const genPngFromSvg = async (inputImageAbsPath: string, lang = 'en', outputSizes = outputFaviconSizes) => {
  await Promise.all([
    (async function genPngForOwnSize() {
      await $`rsvg-convert ${[`--output=${inputImageAbsPath.slice(0, -'.svg'.length)}.png`, inputImageAbsPath]}`;
    })(),
    (async function genPngForOutputSizes() {
      await mapParallelAsync(async function genPngForOutputSize(outputSize) {
        await $`rsvg-convert ${[
          `--accept-language=${lang}`,
          '--keep-aspect-ratio',
          `--width=${outputSize}`,
          `--output=${inputImageAbsPath.slice(0, -'.svg'.length)}.${outputSize}.png`,
          inputImageAbsPath,
        ]}`;
      }, outputSizes);
    })(),
  ]);
};

export default async function genOptimizedImages(
  inputImageAbsPath: string,
  outputSizes = outputPictureSizes,
) {
  const inputImageExt = (await path.parseFs(inputImageAbsPath)).ext;

  if (inputImageExt === '.svg') {
    await fs.writeFile(
      `${inputImageAbsPath.slice(0, -inputImageExt.length)}.min.svg`,
      optimize(await fs.readFileU(inputImageAbsPath), { plugins: [{ name: 'preset-default' }] }).data,
    );
  }

  if (supportedRasterImageExtsWoDot.includes(inputImageExt.slice(1))) {
    const inputImage = sharp(inputImageAbsPath, { pages: -1, limitInputPixels: false });

    await Promise.all([
      (async function genOptimizedImageForOwnSize() {
        await inputImage.rotate().avif().toFile(`${inputImageAbsPath.slice(0, -inputImageExt.length)}.min.avif`);
      })(),
      (async function genOptimizedImageForOutputSizes() {
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

        const filteredOutputSizes = outputSizes.filter((outputSize) => outputSize < inputImageWidth);
        await mapParallelAsync(async function genOptimizedImage(outputSize) {
          await inputImage.rotate().avif().toFile(
            `${inputImageAbsPath.slice(0, -inputImageExt.length)}.${outputSize}.avif`,
          );
        }, filteredOutputSizes);
      })(),
    ]);
  }

  throw new TypeError(`unsupported extension ${inputImageExt} of ${inputImageAbsPath}`);
}
