/**
 Command-line entry: patch-bumps publishable dependents of manifests bumped since a base revision.

 Usage: `node src/bump-dependents.ts [base-revision]` from anywhere inside the repository; the base defaults to `HEAD`.
 The changesets `version` job runs it after `changeset version` so the Version Packages commit carries the ripple.

 @module
 */
import { execFile, } from 'node:child_process';
import { promisify, } from 'node:util';

import { bumpWorktreeDependents, } from './bump-dependents-worktree.ts';

/**
 Node's `promisify` specialized to `execFile`'s declared promise contract.

 See `doc/troubleshooting/oxlint-promisify-void-return.md`.
 */
const promisifyExecFile: (original: typeof execFile) => typeof execFile.__promisify__ = promisify;

/**
 Promise form of `execFile`.
 */
const run = promisifyExecFile(execFile,);

/**
 Worktree root of the current directory.
 */
const repositoryRoot = (await run(
  'git',
  [
    'rev-parse',
    '--show-toplevel',
  ],
)).stdout
  .trim();

/**
 Revision whose versions count as unbumped.
 */
const baseRevision = process.argv[2] ?? 'HEAD';

/**
 Applied ripple.
 */
const plan = await bumpWorktreeDependents({
  repositoryRoot,
  baseRevision,
},);

// Raw console output: this is the command's user-facing report.
console.log(`bump-dependents: ${String(plan.bumpedNames
  .length,)} package(s) differ from ${baseRevision}: ${plan.bumpedNames
    .join(', ',)
    || 'none'}`,);
plan.bumps
  .forEach(function report(bump,) {
  console.log(`bump-dependents: ${bump.name} ${bump.from} -> ${bump.to} (${bump.path})`,);
},);
