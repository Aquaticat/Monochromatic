#!/usr/bin/env node

/**
 * Claude Code SessionStart hook that performs housekeeping on session startup or resume.
 *
 * Thin shim; handler logic, parser, and writer live in
 * `@monochromatic-dev/claude-code-plugins-source/handler/session-start-housekeeping`.
 * This file exists so the standard tsdown build produces an installable plugin
 * entry at `bundle/node/index.mjs` for Claude Code's marketplace install.
 *
 * @example
 * ```jsonc
 * // In .claude/settings.json hooks config:
 * "SessionStart": [
 *   {
 *     "matcher": "startup|resume",
 *     "hooks": [{ "type": "command", "command": "ccssh" }]
 *   }
 * ]
 * ```
 *
 * @module
 */

import {
  sessionStartHousekeepingHandler,
  sessionStartHousekeepingParser,
  sessionStartHousekeepingWriter,
} from '@monochromatic-dev/claude-code-plugins-source/handler/session-start-housekeeping';
import { runHookPlugin, } from '@monochromatic-dev/claude-code-plugins-source/runtime';

await runHookPlugin({
  parser: sessionStartHousekeepingParser,
  handler: sessionStartHousekeepingHandler,
  writer: sessionStartHousekeepingWriter,
},);
