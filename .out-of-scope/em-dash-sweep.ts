#!/usr/bin/env bun

import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const EXCLUDED_FILES = new Set([
  'AUDIT.em-dash.md',
  'PLANNING.forbidden-strings-em-dash.md',
  'packages/cli/forbidden-strings/README.md',
  'AGENTS.md',
  'GLM_LIMITATIONS.md',
  // Test fixtures that intentionally contain unicode dashes as data:
  'packages/module/hyperscript/src/css/index.unit.test.ts',
]);

const fileType = process.argv[3] ?? 'md';
const repoRoot = process.argv[2] ?? '/var/home/user/Monochromatic';

async function findFiles(): Promise<string[]> {
  const proc = spawnSync('rg', ['-l', '—|–', '--type', fileType, '.'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  return proc.stdout.trim().split('\n').filter(Boolean);
}

function replaceEmDashes(text: string): string {
  let result = text;

  // Phase 0: Coordinate / vertex listings: `(a,b) — (c,d)` -> `(a,b), (c,d)`.
  // Run before paired-em-dash matching so triangle-vertex patterns are not
  // incorrectly wrapped in extra parens.
  result = result.replace(/\)\s*[—–]\s*\(/g, '), (');

  // Phase 1: Handle paired em-dashes (asides like "X — Y — Z") with parentheses.
  // Pattern: ` — ` ... ` — ` on the same line. Allow commas in middle phrase.
  result = result.replace(
    /([^\n—]) — ([^—\n]{1,120}) — ([^\n—])/g,
    '$1 ($2) $3'
  );

  // Phase 2: ` —` after a definition-marker character (code/bold/strikethrough/
  // paren / bracket / brace close) followed by space OR newline -> `:` (elaboration).
  // Handles both `marker — text` and `marker —\n  text` (em-dash at end of line).
  result = result.replace(/(`|~~|\*\*|\)|\]|\}) —(\s)/g, '$1:$2');

  // Phase 3: Numeric range en-dash: digit–digit -> digit to digit
  result = result.replace(/(\d+(?:\.\d+)?)–(\d+(?:\.\d+)?)/g, '$1 to $2');

  // Phase 4: Letter range en-dash: A–E -> A to E
  result = result.replace(/\b([A-Za-z])–([A-Za-z])\b/g, '$1 to $2');

  // Phase 5: Generic ` — ` (still remaining) -> `; ` (clause link / fallback)
  result = result.replaceAll(' — ', '; ');

  // Phase 6: Edge case em-dashes at end/start of token
  result = result.replaceAll(' —', ';');
  result = result.replaceAll('— ', '; ');
  result = result.replaceAll('—', ';');

  // Phase 7: Any remaining en-dash -> `,`
  result = result.replaceAll('–', ',');

  return result;
}

async function processFile(relPath: string): Promise<{ before: number; after: number; changed: boolean }> {
  const absPath = `${repoRoot}/${relPath.replace(/^\.\//, '')}`;
  const original = await readFile(absPath, 'utf8');
  const result = replaceEmDashes(original);

  const beforeCount = (original.match(/[—–]/g) ?? []).length;
  const afterCount = (result.match(/[—–]/g) ?? []).length;

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
  } else {
    console.log(`(unchanged) ${file}: ${stats.before}`);
  }
}

console.log(`\nProcessed ${processed} files, skipped ${skipped}.`);
console.log(`Total: ${totalBefore} -> ${totalAfter} em-dashes/en-dashes.`);
