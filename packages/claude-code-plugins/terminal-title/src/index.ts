#!/usr/bin/env node

/**
 * Claude Code multi-event hook that sets the terminal tab title to reflect
 * current Claude Code activity. Listens on PreToolUse, PostToolUse, SessionStart,
 * SessionEnd, Stop, UserPromptSubmit, and Notification.
 *
 * Thin shim; handler logic, parser, writer, and the tool-title registry live in
 * `@monochromatic-dev/claude-code-plugins-source/handlers/terminal-title`.
 * This file exists so the standard tsdown build produces an installable plugin
 * entry at `bundle/node/index.mjs` for Claude Code's marketplace install.
 *
 * @module
 */

import {
  terminalTitleHandler,
  terminalTitleParser,
  terminalTitleWriter,
} from '@monochromatic-dev/claude-code-plugins-source/handlers/terminal-title';
import { runHookPlugin, } from '@monochromatic-dev/claude-code-plugins-source/runtime';

await runHookPlugin({
  parser: terminalTitleParser,
  handler: terminalTitleHandler,
  writer: terminalTitleWriter,
},);
