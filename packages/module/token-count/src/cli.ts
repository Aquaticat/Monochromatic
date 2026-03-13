#!/usr/bin/env bun
import { object } from '@optique/core/constructs';
import { multiple, optional } from '@optique/core/modifiers';
import { argument, option } from '@optique/core/primitives';
import { string } from '@optique/core/valueparser';
import { runSync } from '@optique/run';

import { countFileTokens } from './client.ts';

//region CLI -- parses args and counts tokens in files

/**
 * Optique parser for the token-count CLI.
 *
 * @example
 * ```bash
 * token-count CLAUDE.md
 * token-count --model claude-haiku-4-5 file1.md file2.md
 * ```
 */
const parser = object({
  model: optional(option('--model', string({ metavar: 'MODEL' }))),
  files: multiple(argument(string({ metavar: 'FILE' }))),
});

/** Parsed CLI arguments */
const args = runSync(parser, { programName: 'token-count', help: 'option' });

if (args.files.length === 0) {
  throw new Error('At least one FILE argument is required');
}

const model = typeof args.model === 'string' ? args.model : undefined;
const config = model !== undefined ? { model } : {};

const results = await Promise.all(
  args.files.map((filePath: string) => countFileTokens({ filePath, config })),
);

for (const result of results) {
  console.log(`${String(result.inputTokens).padStart(8)} ${result.filePath}`);
}

if (results.length > 1) {
  const total = results.reduce((sum, r) => sum + r.inputTokens, 0);
  console.log(`${String(total).padStart(8)} total`);
}

//endregion CLI
