/**
 * Package-level path constants shared across subsystems.
 *
 * Both the linter artifact system and history I/O need the package root directory.
 * Centralizing the resolution avoids duplicating `new URL('..', import.meta.url)`.
 */
import { join, } from 'node:path';

/** Absolute path to this package's root directory */
export const PACKAGE_DIR: string = new URL('..', import.meta.url).pathname;

/** Absolute path to the JSONL history file */
export const HISTORY_PATH: string = join(PACKAGE_DIR, 'canary-history.jsonl');
