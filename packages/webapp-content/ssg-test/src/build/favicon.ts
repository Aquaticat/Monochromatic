/**
 * Favicon generation from SVG source.
 *
 * Generates ICO, PNG, and web manifest files per the Evil Martians favicon guide.
 * Files are written to `public/` only when any are missing, ensuring consistency.
 *
 * @see https://evilmartians.com/chronicles/how-to-favicon-in-2021-six-files-that-fit-most-needs
 */
// File justification: ~185 lines -- single-purpose generation pipeline;
// ICO encoding, PNG rendering, and orchestration form a cohesive unit.
import { writeFile, } from 'node:fs/promises';
import { join, } from 'node:path';

import { $ as tagged, } from '@monochromatic-dev/module-es/tagged';
import sharp from 'sharp';

import { fileExists, } from '../images/convert.ts';
import type { Logger, } from '../lib/types.ts';

/** Public directory where favicon files are placed alongside other static assets. */
const PUBLIC = 'public';

/** Path to the SVG favicon source file. */
const SVG_SOURCE = join(PUBLIC, 'favicon.svg',);

/** Background color for apple-touch-icon and maskable icon (dark purple). */
const BACKGROUND = { r: 45, g: 27, b: 78, alpha: 1, };

/** SVG render density for high-quality rasterization. */
const RENDER_DENSITY = 384;

/** Apple touch icon total size (px). */
const APPLE_SIZE = 180;

/** Apple touch icon content size after 20px padding per side. */
const APPLE_CONTENT = 140;

/** Maskable icon safe zone diameter within a 512px canvas. */
const MASKABLE_SAFE = 409;

/** Favicon file names that must all exist in public/. */
const TARGETS = [
  'favicon.ico',
  'apple-touch-icon.png',
  'icon-192.png',
  'icon-512.png',
  'icon-mask.png',
  'manifest.webmanifest',
] as const;

/**
 * Creates an ICO container wrapping a single 32x32 PNG image.
 *
 * @param pngData - PNG buffer to embed in the ICO container
 *
 * @returns ICO file buffer
 *
 * @example
 * ```ts
 * const ico = createIco({ pngData: png32Buffer });
 * ```
 */
function createIco({ pngData, }: { pngData: Buffer; },): Buffer {
  const header = Buffer.alloc(6,);
  header.writeUInt16LE(1, 2,); // type: 1 = ICO
  header.writeUInt16LE(1, 4,); // image count

  const entry = Buffer.alloc(16,);
  entry.writeUInt8(32, 0,); // width
  entry.writeUInt8(32, 1,); // height
  entry.writeUInt16LE(1, 4,); // color planes
  entry.writeUInt16LE(32, 6,); // bits per pixel
  entry.writeUInt32LE(pngData.length, 8,); // image data size
  /** ICO header (6 bytes) + directory entry (16 bytes) = 22 bytes before image data. */
  entry.writeUInt32LE(22, 12,); // data offset

  return Buffer.concat([header, entry, pngData,],);
}

/**
 * Renders the source SVG to PNG at the specified square dimensions.
 *
 * @param size - target width and height in pixels
 *
 * @returns PNG buffer
 */
async function renderPng({ size, }: { size: number; },): Promise<Buffer> {
  return sharp(SVG_SOURCE, { density: RENDER_DENSITY, },)
    .resize(size, size,)
    .png()
    .toBuffer();
}

/**
 * Renders the source SVG centered on a padded background canvas.
 *
 * @param contentSize - SVG render size for inner content
 *
 * @param canvasSize - final output dimensions
 *
 * @returns PNG buffer with content centered on colored background
 */
async function renderPadded(
  { contentSize, canvasSize, }: { contentSize: number; canvasSize: number; },
): Promise<Buffer> {
  const content = await renderPng({ size: contentSize, },);
  return sharp({
    create: {
      width: canvasSize,
      height: canvasSize,
      channels: 4,
      background: BACKGROUND,
    },
  },)
    .composite([{ input: content, gravity: 'centre', },],)
    .png()
    .toBuffer();
}

/**
 * Generates all favicon files into `public/` when any target is missing.
 *
 * Regenerates the complete set from SVG source to ensure consistency
 * across ICO, PNG, and manifest files.
 *
 * @param l - parent logger for tagged output
 *
 * @example
 * ```ts
 * await ensureFavicons({ l: rootLogger });
 * ```
 */
export async function ensureFavicons(
  { l: parentLogger, }: { l: Logger; },
): Promise<void> {
  const l = tagged({ tag: ensureFavicons.name, l: parentLogger, },);

  const checks = await Promise.all(
    TARGETS.map(function checkTarget(name,) {
      return fileExists(join(PUBLIC, name,),);
    },),
  );

  if (checks.every(Boolean,)) {
    l.info('all favicon files present',);
    return;
  }

  l.info('generating favicon files from SVG source',);

  const [png32, png192, png512, appleTouchIcon, maskableIcon,] = await Promise.all([
    renderPng({ size: 32, },),
    renderPng({ size: 192, },),
    renderPng({ size: 512, },),
    renderPadded({ contentSize: APPLE_CONTENT, canvasSize: APPLE_SIZE, },),
    renderPadded({ contentSize: MASKABLE_SAFE, canvasSize: 512, },),
  ],);

  const manifest = JSON.stringify({
    icons: [
      { src: '/icon-192.png', type: 'image/png', sizes: '192x192', },
      { src: '/icon-512.png', type: 'image/png', sizes: '512x512', },
      { src: '/icon-mask.png', type: 'image/png', sizes: '512x512',
        purpose: 'maskable', },
    ],
  }, undefined, 2,);

  await Promise.all([
    writeFile(join(PUBLIC, 'favicon.ico',), createIco({ pngData: png32, },),),
    writeFile(join(PUBLIC, 'apple-touch-icon.png',), appleTouchIcon,),
    writeFile(join(PUBLIC, 'icon-192.png',), png192,),
    writeFile(join(PUBLIC, 'icon-512.png',), png512,),
    writeFile(join(PUBLIC, 'icon-mask.png',), maskableIcon,),
    writeFile(join(PUBLIC, 'manifest.webmanifest',), manifest, 'utf8',),
  ],);

  l.info('favicon files generated',);
}

//region Standalone execution -- allows running via `mise run generate:favicons`
if (import.meta.main) {
  const { $: logger, initPromise, } = await import('@monochromatic-dev/module-es/logger');
  await initPromise;
  await ensureFavicons({ l: logger, },);
}
//endregion
