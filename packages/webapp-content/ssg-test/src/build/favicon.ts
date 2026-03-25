/**
 * Favicon generation from SVG source.
 *
 * Generates ICO, PNG, and web manifest files per the Evil Martians favicon guide.
 * Files are written to `public/` only when any are missing, ensuring consistency.
 *
 * @see https://evilmartians.com/chronicles/how-to-favicon-in-2021-six-files-that-fit-most-needs
 */
import { writeFile, } from 'node:fs/promises';
import { join, } from 'node:path';

import { $ as tagged, } from '@monochromatic-dev/module-es/tagged';

import { fileExists, } from '../images/convert.ts';
import type { Logger, } from '../lib/types.ts';
import { createIco, } from './ico.ts';
import {
  renderPadded,
  renderPng,
} from './render.ts';

/** Public directory where favicon files are placed alongside other static assets. */
const PUBLIC = 'public';

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
  const l = tagged({
    tag: ensureFavicons.name,
    l: parentLogger,
  },);

  const checks = await Promise.all(
    TARGETS.map(function checkTarget(name,) {
      return fileExists(join(
        PUBLIC,
        name,
      ),);
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
    renderPadded({
      contentSize: APPLE_CONTENT,
      canvasSize: APPLE_SIZE,
    },),
    renderPadded({
      contentSize: MASKABLE_SAFE,
      canvasSize: 512,
    },),
  ],);

  const manifest = JSON.stringify(
    {
    icons: [
      { src: '/icon-192.png', type: 'image/png', sizes: '192x192', },
      { src: '/icon-512.png', type: 'image/png', sizes: '512x512', },
      { src: '/icon-mask.png', type: 'image/png', sizes: '512x512',
        purpose: 'maskable', },
    ],
  },
    undefined,
    2,
  );

  await Promise.all([
    writeFile(
      join(PUBLIC, 'favicon.ico',),
      createIco({ pngData: png32, },),
    ),
    writeFile(
      join(PUBLIC, 'apple-touch-icon.png',),
      appleTouchIcon,
    ),
    writeFile(
      join(PUBLIC, 'icon-192.png',),
      png192,
    ),
    writeFile(
      join(PUBLIC, 'icon-512.png',),
      png512,
    ),
    writeFile(
      join(PUBLIC, 'icon-mask.png',),
      maskableIcon,
    ),
    writeFile(
      join(PUBLIC, 'manifest.webmanifest',),
      manifest,
      'utf8',
    ),
  ],);

  l.info('favicon files generated',);
}

//region Standalone execution -- allows running via `mise run generate:favicons`
if (import.meta.main) {
  const {
    $: logger,
    initPromise,
  } = await import('@monochromatic-dev/module-es/logger');
  await initPromise;
  await ensureFavicons({ l: logger, },);
}
//endregion
