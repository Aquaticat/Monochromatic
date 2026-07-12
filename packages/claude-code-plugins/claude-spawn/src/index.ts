#!/usr/bin/env node

/**
 * Claude Code multi-event hook entry point for the claude-spawn plugin.
 *
 * Thin shim; handler logic, parser, writer, the SessionStart helper, and the
 * spawn-state coordination modules live in
 * `@monochromatic-dev/claude-code-plugins-source/handlers/claude-spawn`.
 * This file exists so the standard tsdown build produces an installable plugin
 * entry at `bundle/node/index.mjs` for Claude Code's marketplace install.
 *
 * @module
 */

import {
  claudeSpawnHandler,
  claudeSpawnParser,
  claudeSpawnWriter,
} from '@monochromatic-dev/claude-code-plugins-source/handlers/claude-spawn';
import { runHookPlugin, } from '@monochromatic-dev/claude-code-plugins-source/runtime';

await runHookPlugin({
  parser: claudeSpawnParser,
  handler: claudeSpawnHandler,
  writer: claudeSpawnWriter,
},);
