#!/usr/bin/env bun

/**
 * spawn-claude CLI shim. The real CLI implementation lives at
 * `@monochromatic-dev/claude-code-plugins-source/cli/spawn-claude` and is
 * also exposed on PATH via the source package's `bin` field after
 * `pnpm install`.
 *
 * This shim is preserved here so the SessionStart hook's auto-symlink target
 * (`${PLUGIN_ROOT}/src/cli.ts`) continues to resolve for marketplace
 * installations that do not run pnpm.
 *
 * @module
 */

import '@monochromatic-dev/claude-code-plugins-source/cli/spawn-claude';
