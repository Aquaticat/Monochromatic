#!/usr/bin/env node

/**
 * Claude Code PreToolUse hook that pipes Bash tool output through a filter
 * to strip wasteful patterns (git boilerplate, long lines, repeated diagnostics).
 *
 * Thin shim; handler logic, validation, and the filter pipeline live in
 * `@monochromatic-dev/claude-code-plugins-source/handler/bash-output-filter`.
 * This file exists so the standard tsdown build produces an installable plugin
 * entry at `bundle/node/index.mjs`. The companion shim `src/filter.ts`
 * builds to `bundle/node/filter.mjs`, which the rewritten command pipes
 * Bash output through.
 *
 * @example
 * ```jsonc
 * "PreToolUse": [
 *   {
 *     "matcher": "Bash",
 *     "hooks": [{ "type": "command", "command": "ccbof" }]
 *   }
 * ]
 * ```
 *
 * @module
 */

import {
  bashOutputFilterHandler,
  bashOutputFilterParser,
  bashOutputFilterWriter,
} from '@monochromatic-dev/claude-code-plugins-source/handler/bash-output-filter';
import { runHookPlugin, } from '@monochromatic-dev/claude-code-plugins-source/runtime';

await runHookPlugin({
  parser: bashOutputFilterParser,
  handler: bashOutputFilterHandler,
  writer: bashOutputFilterWriter,
},);
