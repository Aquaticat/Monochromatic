#!/usr/bin/env bun

/**
 * Claude Code SessionStart hook that performs housekeeping tasks on session startup or resume.
 *
 * Runs the following cleanup steps in parallel:
 * - Creates `/tmp/claude` and `/tmp/claude-1000` directories
 * - Removes stale git metadata leaked into `dist/final/` directories
 * - Removes ephemeral `.mcp.json` from the workspace root
 *
 * @example
 * ```jsonc
 * // In .claude/settings.json hooks config:
 * "SessionStart": [{ "matcher": "startup|resume", "hooks": [{ "type": "command", "command": "ccssh" }] }]
 * ```
 *
 * @module
 */

import {
  glob,
  mkdir,
  rm,
} from 'node:fs/promises';
import type {
  SessionStartInput,
} from '@monochromatic-dev/claude-code-plugins-hook-types';
import {
  readStdin,
} from '@monochromatic-dev/claude-code-plugins-hook-utils';

export {}

//region Housekeeping tasks

/**
 * Creates a directory if it does not already exist.
 * Equivalent to `mkdir -p`.
 *
 * @param dirPath - Absolute path of directory to ensure exists.
 *
 * @example
 * ```ts
 * await ensureDir('/tmp/claude')
 * ```
 */
async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

/**
 * Stale artifact names that git metadata or Claude config can leak into `dist/final/` directories.
 * These are removed on session start to prevent build contamination.
 */
const STALE_DIST_ARTIFACTS = [
  'HEAD',
  'config',
  'hooks',
  'objects',
  'refs',
  '.claude',
];

/**
 * Removes stale git metadata and Claude config directories from all nested `dist/final/` paths under `packages/`.
 * Uses `node:fs/promises` glob to find matching paths and removes them recursively.
 *
 * @param workspaceRoot - Absolute path to the monorepo root.
 *
 * @example
 * ```ts
 * await cleanDistArtifacts('/var/home/user/Monochromatic')
 * ```
 */
async function cleanDistArtifacts(workspaceRoot: string): Promise<void> {
  const removals: Array<Promise<void>> = [];

  for await (const finalDir of glob('packages/*/*/dist/final', { cwd: workspaceRoot, })) {
    for (const artifact of STALE_DIST_ARTIFACTS) {
      removals.push(
        rm(`${workspaceRoot}/${finalDir}/${artifact}`, { recursive: true, force: true }),
      );
    }
  }

  await Promise.all(removals);
}

/**
 * Removes the ephemeral `.mcp.json` file from the workspace root.
 * This file is regenerated each session and should not persist.
 *
 * @param workspaceRoot - Absolute path to the monorepo root.
 *
 * @example
 * ```ts
 * await removeMcpJson('/var/home/user/Monochromatic')
 * ```
 */
async function removeMcpJson(workspaceRoot: string): Promise<void> {
  await rm(`${workspaceRoot}/.mcp.json`, { force: true });
}

//endregion

//region Main

/** Raw JSON string read from stdin containing the hook event payload. */
const raw = await readStdin();

/**
 * Parsed SessionStart event.
 *
 * Input is trusted -- it comes from Claude Code's hook dispatch system.
 */
/* eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- trusted input from Claude Code hook system */
const event = JSON.parse(raw) as SessionStartInput;

/** Workspace root derived from the session's working directory. */
const workspaceRoot = event.cwd;

await Promise.all([
  ensureDir('/tmp/claude'),
  ensureDir('/tmp/claude-1000'),
  cleanDistArtifacts(workspaceRoot),
  removeMcpJson(workspaceRoot),
]);

//endregion
