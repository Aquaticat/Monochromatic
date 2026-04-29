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

const inputPath = process.argv[2];
const outputPath = process.argv[3];

if (!inputPath) {
  console.error('Usage: bun scripts/convert.ts <input.fig|.deck|.jam> [output.penpot]',);
  process.exitCode = 1;
  throw new Error('Missing input path',);
}

const figmaFile = await parseFigmaFile(inputPath,);
const doc = convertFigmaToPenpot(
  figmaFile,
  {
    fileName: figmaFile.meta.fileName || undefined,
  },
);

const zipBuffer = await serializePenpotZip(doc,);
const outPath = outputPath ?? inputPath.replace(
  /\.(fig|deck|jam)$/,
  '.penpot',
);

await writeFile(
  outPath,
  zipBuffer,
);

const nodeCount = (figmaFile.document?.nodeChanges ?? []).length;
console.log(
  `Converted ${figmaFile.fileType} (${nodeCount} nodes) -> ${outPath} (${zipBuffer.length} bytes)`,
);
