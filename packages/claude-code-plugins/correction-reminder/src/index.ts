#!/usr/bin/env node

/**
 * Claude Code UserPromptSubmit hook that detects correction phrases in user
 * input and reminds Claude to re-check evidence before its next substantive
 * response.
 *
 * Thin shim; {@link correctionReminderHandler} handler logic,
 * {@link correctionReminderParser} parser, and {@link correctionReminderWriter}
 * writer live in
 * `@monochromatic-dev/claude-code-plugins-source/handler/correction-reminder`,
 * wired together by {@link runHookPlugin}.
 * This file exists so the standard tsdown build produces an installable plugin
 * entry at `bundle/node/index.mjs` for Claude Code's marketplace install.
 *
 * @example
 * ```jsonc
 * // In .claude/settings.json hooks config:
 * "UserPromptSubmit": [
 *   {
 *     "hooks": [{ "type": "command", "command": "cccr" }]
 *   }
 * ]
 * ```
 *
 * @module
 */

import {
  correctionReminderHandler,
  correctionReminderParser,
  correctionReminderWriter,
} from '@monochromatic-dev/claude-code-plugins-source/handler/correction-reminder';
import { runHookPlugin, } from '@monochromatic-dev/claude-code-plugins-source/runtime';

await runHookPlugin({
  parser: correctionReminderParser,
  handler: correctionReminderHandler,
  writer: correctionReminderWriter,
},);
