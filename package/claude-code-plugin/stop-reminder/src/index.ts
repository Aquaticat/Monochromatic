#!/usr/bin/env node

/**
 * Claude Code Stop hook that detects uncertain language and trailing questions
 * in Claude's responses, and that refuses a stop whenever pushing could
 * plausibly help, so a turn cannot end on an announced-but-unperformed next
 * action. Releases are decided from state, never from the response text.
 *
 * Thin shim; handler logic, parser, and writer live in
 * `@monochromatic-dev/claude-code-plugin-source/handler/stop-reminder`.
 * This file exists so the standard tsdown build produces an installable plugin
 * entry at `bundle/node/index.mjs` for Claude Code's marketplace install.
 *
 * @example
 * ```jsonc
 * // In .claude/settings.json hooks config:
 * "Stop": [
 *   {
 *     "hooks": [{ "type": "command", "command": "ccsr" }]
 *   }
 * ]
 * ```
 *
 * @module
 */

import {
  stopRemindersHandler,
  stopRemindersParser,
  stopRemindersWriter,
} from '@monochromatic-dev/claude-code-plugin-source/handler/stop-reminder';
import { runHookPlugin, } from '@monochromatic-dev/claude-code-plugin-source/runtime';

await runHookPlugin({
  parser: stopRemindersParser,
  handler: stopRemindersHandler,
  writer: stopRemindersWriter,
},);
