#!/usr/bin/env bun

import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const EXCLUDED_FILES = new Set([
  'AUDIT.em-dash.md',
  'PLANNING.forbidden-strings-em-dash.md',
  'packages/cli/forbidden-strings/README.md',
  'AGENTS.md',
  'GLM_LIMITATIONS.md',
  // Word reference doc that intentionally lists em-dash-style definitions
  'TODO.claude-code-words.md',
  // Audit/forbidden-strings infrastructure that intentionally has examples
  'TODO.forbidden-strings.md',
]);

const fileType = process.argv[3] ?? 'md';
const repoRoot = process.argv[2] ?? '/var/home/user/Monochromatic';

async function findFiles(): Promise<string[]> {
  const proc = spawnSync('rg', ['-l', ' -- ', '--type', fileType, '.'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  return proc.stdout.trim().split('\n').filter(Boolean);
}

/**
 * Tokens after which ` -- ` is likely a CLI argument separator,
 * not a prose em-dash. We do NOT replace in these contexts.
 */
const CLI_TOOLS = new Set([
  'mise', 'pnpm', 'npm', 'yarn', 'bun', 'deno', 'node',
  'git', 'gh', 'hk', 'cargo', 'rustup', 'rustc',
  'watchexec', 'docker', 'podman', 'kubectl',
  'sed', 'awk', 'find', 'xargs', 'grep', 'rg',
  'jq', 'jaq', 'curl', 'wget', 'ssh', 'scp', 'rsync',
  'oxlint', 'biome', 'dprint', 'prettier', 'eslint',
  'tsc', 'tsgo', 'tsx', 'tsdown', 'rolldown', 'esbuild',
  'forbidden-strings',
]);

function looksLikeCliInvocation(line: string, dashIndex: number): boolean {
  // Look at tokens before the dash; if the line starts with a known CLI tool
  // (optionally inside backticks/code spans), treat as CLI invocation.
  const before = line.slice(0, dashIndex).trim();
  if (before.length === 0) return false;

  // First token of the line (or first token after a comment marker or bullet)
  const stripped = before
    .replace(/^[#>\-*+]\s*/, '')  // bullet or quote
    .replace(/^`+/, '')           // open backticks
    .replace(/^\$\s*/, '')        // shell prompt
    .replace(/^[A-Z][A-Z_]*\s*=\s*\S+\s+/, '')  // env var assignment
    .trim();
  const firstToken = stripped.split(/\s+/)[0] ?? '';
  // Strip trailing backticks/punctuation off the token
  const cleanToken = firstToken.replace(/[`'"]+$/, '');
  return CLI_TOOLS.has(cleanToken);
}

function isFenceLine(line: string): boolean {
  return /^\s*```/.test(line);
}

function replaceLine(line: string): string {
  // Find all positions of ` -- ` in the line
  // Process from end to beginning to keep indices valid as we replace
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

    // Skip if inside a backtick span (count backticks before idx; if odd, inside)
    const before = result.slice(0, idx);
    const backtickCount = (before.match(/`/g) ?? []).length;
    if (backtickCount % 2 === 1) continue;

    // Skip if this is a CLI invocation (anywhere on the line before this dash
    // a known CLI tool appears as the first token)
    if (looksLikeCliInvocation(result, idx)) continue;

    // Check the character immediately before ` -- ` to decide replacement.
    // Examine the character at idx (which is a space). The char at idx-1 is the
    // last char of the previous token (or whitespace).
    const prevChar = idx > 0 ? result.charAt(idx - 1) : '';
    const isMarker = /[`\]\)\}]/.test(prevChar) || result.slice(0, idx).endsWith('**') || result.slice(0, idx).endsWith('~~');

    const replacement = isMarker ? ': ' : '; ';
    result = result.slice(0, idx) + replacement + result.slice(idx + 4);
  }

  return result;
}

async function processFile(relPath: string): Promise<{ before: number; after: number; changed: boolean }> {
  const absPath = `${repoRoot}/${relPath.replace(/^\.\//, '')}`;
  const original = await readFile(absPath, 'utf8');

  const lines = original.split('\n');
  let inFence = false;
  const newLines: string[] = [];

  for (const line of lines) {
    if (isFenceLine(line)) {
      inFence = !inFence;
      newLines.push(line);
      continue;
    }
    if (inFence) {
      newLines.push(line);
      continue;
    }
    newLines.push(replaceLine(line));
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
  } else {
    console.log(`(unchanged) ${file}: ${stats.before}`);
  }
}

console.log(`\nProcessed ${processed} files, skipped ${skipped}.`);
console.log(`Total: ${totalBefore} -> ${totalAfter} ASCII ' -- '.`);
