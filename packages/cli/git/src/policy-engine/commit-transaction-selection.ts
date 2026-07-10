/**
 * Commit selection parsing and private pathspec materialization.
 *
 * @module
 */
import { writeFile, } from 'node:fs/promises';
import {
  join,
  resolve,
} from 'node:path';
import { arrayBuffer, } from 'node:stream/consumers';
import { runTransactionGit, } from './commit-transaction-git.ts';
import type { CommitTransactionWorkspace, } from './commit-transaction-workspace.ts';

/**
 * No pathspec file participates in current invocation.
 */
export const PATHSPEC_FILE_ABSENT: unique symbol = Symbol('commit pathspec file was absent',);
/**
 * Internal and explicit only-mode tokens removed for complete private tree.
 */
const ONLY_MODE_TOKENS: ReadonlySet<string> = new Set([
  '-o',
  '--only',
],);
/**
 * Private pathspec input mode.
 */
const PRIVATE_FILE_MODE = 0o600;

/**
 * Removes selected pathspec and only controls after private tree exists.
 *
 * @param args - transformed Git arguments
 *
 * @param pathspecs - parsed selected paths
 *
 * @returns private-index commit arguments
 *
 * @example
 * ```ts
 * privateExplicitCommitArgs({ args: ['commit', '-o', 'a'], pathspecs: ['a'] });
 * ```
 */
export function privateExplicitCommitArgs({
  args,
  pathspecs,
}: Readonly<{
  args: readonly string[];
  pathspecs: readonly string[];
}>,): readonly string[] {
  /**
   * Arguments after pathspec-file controls consumed by private setup.
   */
  const withoutPathspecFile: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    /**
     * Current transformed commit token.
     */
    const token = args[index];
    if (token === undefined)
      continue;
    if (token === '--pathspec-from-file') {
      index += 1;
      continue;
    }
    if (token.startsWith('--pathspec-from-file=',) || (token === '--pathspec-file-nul'))
      continue;
    withoutPathspecFile.push(token,);
  }
  /**
   * Mutable local copy used only to remove known path positions.
   */
  const retained = [...withoutPathspecFile,];
  for (const pathspec of [...pathspecs,].toReversed()) {
    /**
     * Last matching token where commit pathspec appears after option value.
     */
    const index = retained.lastIndexOf(pathspec,);
    if (index !== (-1))
      retained.splice(
        index,
        1,
      );
  }
  return retained.filter(function retainToken(token,) {
    return (token !== '--') && (!ONLY_MODE_TOKENS.has(token,));
  },);
}

/**
 * Materializes optional pathspec source exactly once.
 *
 * @param workspace - private transaction workspace
 *
 * @param effectiveCwd - repository cwd for relative source
 *
 * @param source - configured source spelling
 *
 * @returns private or resolved file path, or absence sentinel
 *
 * @example
 * ```ts
 * await materializePathspecFile({ workspace, effectiveCwd: '/repo' });
 * ```
 */
export async function materializePathspecFile({
  workspace,
  effectiveCwd,
  source,
}: Readonly<{
  workspace: CommitTransactionWorkspace;
  effectiveCwd: string;
  source?: string;
}>,): Promise<string | typeof PATHSPEC_FILE_ABSENT> {
  if (source === undefined)
    return PATHSPEC_FILE_ABSENT;
  if (source !== '-')
    return resolve(
      effectiveCwd,
      source,
    );
  /**
   * Private single-consumption stdin snapshot.
   */
  const path = join(
    workspace.directory,
    'pathspec.input',
  );
  await writeFile(
    path,
    new Uint8Array(await arrayBuffer(process.stdin,),),
    { mode: PRIVATE_FILE_MODE, },
  );
  return path;
}

/**
 * Reports active merge, cherry-pick, or revert conclusion.
 *
 * @param gitPath - resolved Git executable
 *
 * @param cwd - effective repository cwd
 *
 * @returns whether any sequencer marker resolves
 *
 * @example
 * ```ts
 * await hasSequencerConclusion({ gitPath: '/usr/bin/git', cwd: '/repo' });
 * ```
 */
export async function hasSequencerConclusion({
  gitPath,
  cwd,
}: Readonly<{
  gitPath: string;
  cwd: string;
}>,): Promise<boolean> {
  /**
   * Active marker probes.
   */
  const results = await Promise.all([
    'MERGE_HEAD',
    'CHERRY_PICK_HEAD',
    'REVERT_HEAD',
  ].map(function inspectSequencer(marker,) {
    return runTransactionGit({
      gitPath,
      cwd,
      args: [
        'rev-parse',
        '--verify',
        marker,
      ],
      allowFailure: true,
    },);
  },),);
  return results.some(function markerExists(result,) {
    return result.exitCode === 0;
  },);
}
