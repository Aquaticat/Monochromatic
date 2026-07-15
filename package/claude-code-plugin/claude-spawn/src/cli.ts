#!/usr/bin/env node

/**
 * spawn-claude CLI shim. The real CLI implementation lives at
 * `@monochromatic-dev/claude-code-plugin-source/cli/spawn-claude` and is
 * also exposed on PATH via the source package's `bin` field after
 * `pnpm install`.
 *
 * This shim is preserved here so the SessionStart hook's auto-symlink target
 * (`${PLUGIN_ROOT}/src/cli.ts`) continues to resolve for marketplace
 * installations that do not run pnpm.
 *
 * @module
 */

// oxlint-disable-next-line eslint-plugin-import/no-unassigned-import -- entrypoint shim: source module's CLI runs at top level via shebang
import '@monochromatic-dev/claude-code-plugin-source/cli/spawn-claude';
