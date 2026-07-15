#!/usr/bin/env node

/**
 * Claude Code UserPromptSubmit hook that injects the current local system
 * time into Claude's conversation context as `<time>HH:MM</time>`.
 *
 * Thin shim; handler logic, parser, and writer live in
 * `@monochromatic-dev/claude-code-plugins-source/handler/prompt-time`.
 * This file exists so the standard tsdown build produces an installable plugin
 * entry at `bundle/node/index.mjs` for Claude Code's marketplace install.
 *
 * @example
 * ```jsonc
 * // In .claude/settings.json hooks config:
 * "UserPromptSubmit": [
 *   {
 *     "hooks": [{ "type": "command", "command": "ccpt" }]
 *   }
 * ]
 * ```
 *
 * @module
 */

import {
  promptTimeHandler,
  promptTimeParser,
  promptTimeWriter,
} from '@monochromatic-dev/claude-code-plugins-source/handler/prompt-time';
import { runHookPlugin, } from '@monochromatic-dev/claude-code-plugins-source/runtime';

await runHookPlugin({
  parser: promptTimeParser,
  handler: promptTimeHandler,
  writer: promptTimeWriter,
},);
