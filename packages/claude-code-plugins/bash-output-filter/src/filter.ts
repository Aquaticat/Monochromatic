#!/usr/bin/env bun

/**
 * Stdin filter that strips wasteful patterns from Bash tool output before the
 * model sees it. Runs inside the sandbox as the right side of a pipe.
 *
 * Thin shim -- the filter pipeline lives in
 * `@monochromatic-dev/claude-code-plugins-source/handlers/bash-output-filter/filter`.
 * This file is the second tsdown entry of the bash-output-filter plugin and
 * builds to `dist/final/node/filter.mjs`, which the hook's rewritten command
 * invokes via `bun <filterPath>`.
 *
 * @module
 */

import { runFilter, } from '@monochromatic-dev/claude-code-plugins-source/handlers/bash-output-filter/filter';

await runFilter();
