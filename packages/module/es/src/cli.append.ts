#!/usr/bin/env bun

/**
 * Append utility for adding lines to files.
 *
 * This utility appends text lines to a specified file. It validates that the file
 * exists and has write permissions before appending.
 *
 * Usage:
 *   append "my new line" --to myfile.md
 *   append "my new line1" --to myfile.md
 *   append "my new line1\nMy new line2" --to myfile.md
 *   append "my new line1" "my new line2" --to myfile.md
 */

import {
  cli,
  define,
} from '@kazupon/gunshi';
import { existsSync } from 'node:fs';
import { constants } from 'node:fs';
import {
  access,
  appendFile,
} from 'node:fs/promises';

/** Error messages for append operations */
const ERROR_MESSAGES = {
  fileNotFound: (path: string) => `File not found: ${path}`,
  noWritePermission: (path: string) => `No write permission for file: ${path}`,
  noTextProvided: 'No text provided to append',
  noTargetFile: 'No target file specified. Use --to <file>',
} as const;

/** Check if file exists and has write permissions */
async function validateFile(filePath: string): Promise<void> {
  if (!existsSync(filePath)) {
    throw new Error(ERROR_MESSAGES.fileNotFound(filePath));
  }

  try {
    await access(filePath, constants.W_OK);
  } catch {
    throw new Error(ERROR_MESSAGES.noWritePermission(filePath));
  }
}

/** Append lines to file */
async function appendLinesToFile(filePath: string, lines: string[]): Promise<void> {
  const content = lines.join('\n') + '\n';
  await appendFile(filePath, content);
}

// Define the append command with gunshi
const appendCommand = define({
  name: 'append',
  description: 'Append text lines to a file',
  args: {
    to: {
      type: 'string',
      short: 't',
      description: 'Target file to append to',
      required: true,
    },
  },
  examples: `# Append a single line
$ append "my new line" --to myfile.md

# Append multiple lines as separate arguments
$ append "my new line1" "my new line2" --to myfile.md

# Append multiline text
$ append "my new line1\\nMy new line2" --to myfile.md`,
  run: async (ctx) => {
    const { to } = ctx.values;

    // Use positionals for text lines to append
    if (ctx.positionals.length === 0) {
      throw new Error(ERROR_MESSAGES.noTextProvided);
    }

    if (!to) {
      throw new Error(ERROR_MESSAGES.noTargetFile);
    }

    // Validate the target file
    await validateFile(to);

    // Append all lines to the file
    await appendLinesToFile(to, ctx.positionals);
  },
});

// Run the CLI
await cli(process.argv.slice(2), appendCommand);
