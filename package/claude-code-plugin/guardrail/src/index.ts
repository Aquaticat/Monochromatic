#!/usr/bin/env node

/**
 * Claude Code PreToolUse hook that guards Agent tool calls.
 *
 * Thin shim; handler logic, parser, and writer live in
 * `@monochromatic-dev/claude-code-plugin-source/handler/guardrail`.
 * This file exists so the standard tsdown build produces an installable plugin
 * entry at `bundle/node/index.mjs` for Claude Code's marketplace install.
 *
 * @example
 * ```jsonc
 * // In .claude/settings.json hooks config:
 * "PreToolUse": [
 *   {
 *     "hooks": [{ "type": "command", "command": "ccgr" }]
 *   }
 * ]
 * ```
 *
 * @module
 */

import {
  guardrailHandler,
  guardrailParser,
  guardrailWriter,
} from '@monochromatic-dev/claude-code-plugin-source/handler/guardrail';
import { runHookPlugin, } from '@monochromatic-dev/claude-code-plugin-source/runtime';

await runHookPlugin({
  parser: guardrailParser,
  handler: guardrailHandler,
  writer: guardrailWriter,
},);
