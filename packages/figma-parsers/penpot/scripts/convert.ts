#!/usr/bin/env bun
/**
 * CLI script to convert Figma export files to Penpot format.
 *
 * Usage: bun scripts/convert.ts <input.fig|.deck|.jam> [output.penpot]
 */

import { parseFigmaFile, } from '@monochromatic-dev/figma-kiwi/ts';
import { writeFile, } from 'node:fs/promises';
import {
  convertFigmaToPenpot,
  serializePenpotZip,
} from '../src/index.ts';

/** First positional argument: source Figma export file path that the converter reads. */
const inputPath = process.argv[2];
/** Optional second positional argument: destination `.penpot` path; falls back to the input path with the extension swapped. */
const outputPath = process.argv[3];

if (!inputPath) {
  console.error('Usage: bun scripts/convert.ts <input.fig|.deck|.jam> [output.penpot]',);
  throw new Error('Missing input path',);
}

/** Fully decoded Figma file model that the conversion pipeline consumes. */
const figmaFile = await parseFigmaFile(inputPath,);
/** Intermediate Penpot document model produced by the converter, ready for ZIP serialization. */
const doc = convertFigmaToPenpot(
  figmaFile,
  {
    fileName: figmaFile.meta
      .fileName
      || undefined,
  },
);

/** Final ZIP buffer ready to be written to disk. */
const zipBuffer = await serializePenpotZip(doc,);
/** Resolved output path: caller's argument takes precedence, otherwise the input filename with its extension swapped to `.penpot`. */
const outPath = outputPath ?? inputPath
  .replace(
  /\.(fig|deck|jam)$/,
  '.penpot',
);

await writeFile(
  outPath,
  zipBuffer,
);

/** Count of NodeChange entries logged below as a quick sanity-check of conversion scope. */
const nodeCount = (figmaFile.document
  ?.nodeChanges
  ?? []).length;
console.log(
  `Converted ${figmaFile.fileType} (${nodeCount} nodes) -> ${outPath} (${zipBuffer.length} bytes)`,
);
