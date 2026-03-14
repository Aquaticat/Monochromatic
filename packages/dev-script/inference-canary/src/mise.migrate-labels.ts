/**
 * Migrates canary-lint artifact directories from model-ID-based names to label-based names.
 *
 * Renames directories and adds `label` field to all meta.json files.
 * Safe to run multiple times -- skips already-migrated directories.
 */
import { readdir, readFile, rename, writeFile, } from 'node:fs/promises';
import { join, } from 'node:path';

import { LINT_DIR, } from './linter-artifacts.ts';

export {};

/**
 * Mapping from old directory name (model slug) to new directory name (model label).
 * Only directories that need renaming are listed.
 */
const DIR_RENAMES: Record<string, string> = {
  'claude-opus-4.6': 'Opus 4.6',
  'claude-opus-4.6-max': 'Opus 4.6 max',
  'claude-sonnet-4.6': 'Sonnet 4.6',
  'claude-haiku-4.5': 'Haiku 4.5',
  'qwen3.5-397b-a17b': 'Qwen 3.5 OSS',
  'gpt-5.2': 'GPT 5.2',
  'glm-5': 'GLM 5',
  'kimi-k2.5': 'Kimi K2.5',
  'minimax-m2.5': 'MiniMax M2.5',
};

/**
 * Mapping from old directory name to the label to write into meta.json.
 * Same as DIR_RENAMES since all dirs need both renaming and label updates.
 */
const DIR_LABELS: Record<string, string> = DIR_RENAMES;

/** Top-level model directories from the canary-lint artifact root */
let modelDirs: string[] = [];
try {
  modelDirs = await readdir(LINT_DIR);
} catch {
  console.log('No canary-lint directory found, nothing to migrate.');
  process.exitCode = 0;
  throw new Error('No canary-lint directory');
}

for (const modelDir of modelDirs) {
  /** Label for this model from the mapping, undefined if no mapping exists */
  const label = DIR_LABELS[modelDir];
  if (label === undefined) {
    console.log(`  skip: ${modelDir} (no mapping)`);
    continue;
  }

  /** Absolute path to this model's artifact directory */
  const modelPath = join(LINT_DIR, modelDir);

  // Update meta.json files inside this model dir
  /** Artifact subdirectories for this model */
  let subdirs: string[] = [];
  try {
    subdirs = await readdir(modelPath);
  } catch {
    continue;
  }

  for (const subdir of subdirs) {
    /** Absolute path to the meta.json file in this artifact */
    const metaPath = join(modelPath, subdir, 'meta.json');
    try {
      /** Raw JSON content of the meta.json file */
      const raw = await readFile(metaPath, 'utf8');
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- meta.json structure is known
      /** Parsed meta.json contents for label injection */
      const meta = JSON.parse(raw) as Record<string, unknown>;
      if (meta['label'] !== undefined) continue;
      meta['label'] = label;
      await writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf8');
      console.log(`  updated: ${modelDir}/${subdir}/meta.json`);
    } catch {
      // Missing or malformed -- skip
    }
  }

  // Rename directory if needed
  /** New directory name from the rename mapping */
  const newName = DIR_RENAMES[modelDir];
  if (newName !== undefined) {
    /** Absolute path for the renamed directory */
    const newPath = join(LINT_DIR, newName);
    try {
      await rename(modelPath, newPath);
      console.log(`  renamed: ${modelDir} -> ${newName}`);
    } catch (error) {
      /** Human-readable error message for rename failures */
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`  failed to rename ${modelDir}: ${errorMsg}`);
    }
  }
}

console.log('Migration complete.');
