#!/usr/bin/env bun

import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const EXCLUDED_FILES = new Set<string>([
  // None currently
]);

const repoRoot = process.argv[2] ?? '/var/home/user/Monochromatic';

async function findFiles(): Promise<string[]> {
  const proc = spawnSync('rg', ['-l', ' -- ', '--type', 'ts', '.'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  return proc.stdout.trim().split('\n').filter(Boolean);
}

function isCommentLine(line: string): boolean {
  // Match lines starting with `//` or `*` (TSDoc/block comment body)
  return /^\s*(\/\/|\*)/.test(line);
}

function shouldSkipLine(line: string): boolean {
  // Skip lines containing disable directives - they use `--` as syntactic separator
  if (/\b(oxlint|eslint|biome|prettier)-disable/.test(line)) return true;
  // Skip @oxlint-disable inside JSDoc
  if (/@(oxlint|eslint|biome|prettier)-disable/.test(line)) return true;
  return false;
}

function replaceLineInComment(line: string): string {
  const positions: number[] = [];
  let pos = 0;
  while ((pos = line.indexOf(' -- ', pos)) !== -1) {
    positions.push(pos);
    pos += 4;
  }

  if (positions.length === 0) return line;

  let result = line;
  for (let i = positions.length - 1; i >= 0; i--) {
    const idx = positions[i]!;

    // Skip if inside a backtick span
    const before = result.slice(0, idx);
    const backtickCount = (before.match(/`/g) ?? []).length;
    if (backtickCount % 2 === 1) continue;

    const prevChar = idx > 0 ? result.charAt(idx - 1) : '';
    const isMarker = /[`\]\)\}]/.test(prevChar)
      || result.slice(0, idx).endsWith('**')
      || result.slice(0, idx).endsWith('~~');

    const replacement = isMarker ? ': ' : '; ';
    result = result.slice(0, idx) + replacement + result.slice(idx + 4);
  }

  return result;
}

async function processFile(relPath: string): Promise<{ before: number; after: number; changed: boolean }> {
  const absPath = `${repoRoot}/${relPath.replace(/^\.\//, '')}`;
  const original = await readFile(absPath, 'utf8');

  const lines = original.split('\n');
  const newLines: string[] = [];

  for (const line of lines) {
    if (isCommentLine(line) && !shouldSkipLine(line)) {
      newLines.push(replaceLineInComment(line));
    } else {
      newLines.push(line);
    }
  }

  const result = newLines.join('\n');
  const beforeCount = (original.match(/ -- /g) ?? []).length;
  const afterCount = (result.match(/ -- /g) ?? []).length;

  if (result !== original) {
    await writeFile(absPath, result);
    return { before: beforeCount, after: afterCount, changed: true };
  }
  return { before: beforeCount, after: afterCount, changed: false };
}

const files = await findFiles();
let totalBefore = 0;
let totalAfter = 0;
let processed = 0;
let skipped = 0;

for (const file of files) {
  const normalized = file.replace(/^\.\//, '');
  if (EXCLUDED_FILES.has(normalized)) {
    console.log(`SKIP ${file}`);
    skipped++;
    continue;
  }

  const stats = await processFile(file);
  totalBefore += stats.before;
  totalAfter += stats.after;
  processed++;
  if (stats.changed) {
    console.log(`${file}: ${stats.before} -> ${stats.after}`);
  }
}

console.log(`\nProcessed ${processed} files, skipped ${skipped}.`);
console.log(`Total: ${totalBefore} -> ${totalAfter} ASCII ' -- '.`);
