#!/usr/bin/env bun

/**
 * Append utility for adding lines to files.
 *
 * This utility appends text lines to a specified file. It validates that the file
 * exists and has write permissions before appending.
 *
 * Usage:
 *   task-append "my new line" --to myfile.md
 *   task-append "my new line1" --to myfile.md
 *   task-append "my new line1\nMy new line2" --to myfile.md
 *   task-append "my new line1" "my new line2" --to myfile.md
 *
 * @example
 * ```bash
 * # Append a single line
 * task-append "my new line" --to myfile.md
 *
 * # Append multiple lines as separate arguments
 * task-append "my new line1" "my new line2" --to myfile.md
 *
 * # Append multiline text
 * task-append "my new line1\\nMy new line2" --to myfile.md
 * ```
 */

import { object, } from '@optique/core/constructs';
import { multiple, } from '@optique/core/modifiers';
import {
  argument,
  option,
} from '@optique/core/primitives';
import { string, } from '@optique/core/valueparser';
import { runSync, } from '@optique/run';
import { existsSync, constants, } from 'node:fs';
import {
  access,
  appendFile,
} from 'node:fs/promises';

export {};

/** Error messages for append operations */
const ERROR_MESSAGES = {
  fileNotFound: function fileNotFound(path: string,): string { return `File not found: ${path}`; },
  noWritePermission: function noWritePermission(path: string,): string { return `No write permission for file: ${path}`; },
  noTextProvided: 'No text provided to append',
} as const;

/**
 * Validates that a file exists and has write permissions.
 *
 * @param filePath - Absolute or relative path to validate
 *
 * @throws When file does not exist or lacks write permissions
 *
 * @example
 * ```ts
 * await validateFile('./output.md');
 * ```
 */
async function validateFile(filePath: string,): Promise<void> {
  if (!existsSync(filePath,))
    throw new Error(ERROR_MESSAGES.fileNotFound(filePath,),);

  try {
    await access(filePath, constants.W_OK,);
  }
  catch {
    throw new Error(ERROR_MESSAGES.noWritePermission(filePath,),);
  }
}

/**
 * Appends lines to a file, joining them with newlines and adding a trailing newline.
 *
 * @param filePath - Absolute or relative path to append to
 *
 * @param lines - Lines of text to append
 *
 * @example
 * ```ts
 * await appendLinesToFile('./output.md', ['line 1', 'line 2']);
 * ```
 */
async function appendLinesToFile(filePath: string, lines: readonly string[],): Promise<void> {
  const content = lines.join('\n',) + '\n';
  await appendFile(filePath, content,);
}

//region Parser definition -- required --to option and variadic positional text lines

/** Optique parser for the task-append CLI */
const parser = object({
  to: option('-t', '--to', string(),),
  lines: multiple(argument(string(),),),
},);

//endregion Parser definition

/** Parsed CLI arguments from process.argv */
const args = runSync(parser, { programName: 'task-append', help: 'option', },);

if (args.lines.length === 0)
  throw new Error(ERROR_MESSAGES.noTextProvided,);

// Validate the target file
await validateFile(args.to,);

// Append all lines to the file
await appendLinesToFile(args.to, args.lines,);
