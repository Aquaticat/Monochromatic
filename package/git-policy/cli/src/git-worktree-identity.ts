import { realpath, } from 'node:fs/promises';

import nanoSpawn, { SubprocessError, } from 'nano-spawn';

/**
 * Repository identity selected by effective Git global options.
 *
 * Canonical administrative paths make main-versus-linked classification stable
 * across symbolic links and relative Git output.
 */
export type GitWorktreeIdentity =
  | Readonly<{
    /**
     * No worktree or bare repository was selected.
     */
    kind: 'outside-worktree';
  }>
  | Readonly<{
    /**
     * Bare repository with no source worktree root.
     */
    kind: 'bare-repository';
    /**
     * Canonical common Git directory.
     */
    commonDir: string;
    /**
     * Canonical invocation-specific Git directory.
     */
    gitDir: string;
  }>
  | Readonly<{
    /**
     * Main worktree whose Git and common directories are identical.
     */
    kind: 'main-worktree';
    /**
     * Canonical common Git directory.
     */
    commonDir: string;
    /**
     * Canonical invocation-specific Git directory.
     */
    gitDir: string;
    /**
     * Canonical selected worktree root.
     */
    worktreeRoot: string;
  }>
  | Readonly<{
    /**
     * Linked worktree with distinct per-worktree Git administration.
     */
    kind: 'linked-worktree';
    /**
     * Canonical common Git directory.
     */
    commonDir: string;
    /**
     * Canonical invocation-specific Git directory.
     */
    gitDir: string;
    /**
     * Canonical selected worktree root.
     */
    worktreeRoot: string;
  }>;

/**
 * Options selecting same repository target as forwarded Git invocation.
 */
type ResolveGitWorktreeIdentityOptions = Readonly<{
  /**
   * Effective cwd after Git global `-C` chaining.
   */
  effectiveCwd: string;
  /**
   * Absolute real-Git executable.
   */
  gitPath: string;
  /**
   * Original Git global option region.
   */
  preSubcommandArgs: readonly string[];
}>;

/**
 * Git metadata output needed to classify repository identity.
 */
type ParsedIdentityMetadata = Readonly<{
  /**
   * Git-reported bare-repository flag.
   */
  isBare: boolean;
  /**
   * Git-reported inside-worktree flag.
   */
  isInsideWorktree: boolean;
  /**
   * Raw Git common-directory path.
   */
  commonDir: string;
  /**
   * Raw invocation-specific Git-directory path.
   */
  gitDir: string;
}>;

/**
 * Removes one Git-produced terminal line break.
 *
 * @param output - captured Git output
 *
 * @returns output without one terminal LF or CRLF
 *
 * @example
 * ```ts
 * stripGitLine('/repo/.git\n');
 * // => '/repo/.git'
 * ```
 */
function stripGitLine(output: string,): string {
  if (output.endsWith('\r\n',)) {
    return output.slice(
      0,
      -2,
    );
  }
  if (output.endsWith('\n',)) {
    return output.slice(
      0,
      -1,
    );
  }
  return output;
}

/**
 * Runs real Git metadata command against exact effective target selection.
 *
 * @param gitPath - absolute real-Git executable
 *
 * @param preSubcommandArgs - original Git global option region
 *
 * @param effectiveCwd - effective cwd after global `-C` chaining
 *
 * @param metadataArgs - arguments after `rev-parse`
 *
 * @returns captured stdout
 *
 * @example
 * ```ts
 * await runIdentityGit({
 *   gitPath: '/usr/bin/git',
 *   preSubcommandArgs: [],
 *   effectiveCwd: '/repo',
 *   metadataArgs: ['--git-dir'],
 * });
 * ```
 */
async function runIdentityGit({
  gitPath,
  preSubcommandArgs,
  effectiveCwd,
  metadataArgs,
}: Readonly<ResolveGitWorktreeIdentityOptions & {
  metadataArgs: readonly string[];
}>,): Promise<string> {
  /**
   * Captured metadata result from real Git.
   */
  const result = await nanoSpawn(
    gitPath,
    [
      ...preSubcommandArgs,
      '-C',
      effectiveCwd,
      'rev-parse',
      '--path-format=absolute',
      ...metadataArgs,
    ],
    {
      stderr: 'pipe',
      stdout: 'pipe',
    },
  );
  return result.stdout;
}

/**
 * Parses fixed-order worktree identity metadata.
 *
 * @param output - four-line real-Git metadata output
 *
 * @returns validated identity metadata
 *
 * @throws when real Git returns incomplete metadata
 *
 * @example
 * ```ts
 * parseIdentityMetadata('true\nfalse\n/repo/.git\n/repo/.git\n');
 * ```
 */
function parseIdentityMetadata(output: string,): ParsedIdentityMetadata {
  /**
   * Fixed-order metadata fields without terminal line break.
   */
  const [
    isInsideWorktreeOutput,
    isBareOutput,
    gitDir,
    commonDir,
  ] = stripGitLine(output,)
    .split('\n',);
  if ((gitDir === undefined) || (commonDir === undefined)) {
    throw new Error(
      'cli-git: could not classify git worktree because git rev-parse returned incomplete metadata.',
    );
  }
  return {
    commonDir,
    gitDir,
    isBare: isBareOutput === 'true',
    isInsideWorktree: isInsideWorktreeOutput === 'true',
  };
}

/**
 * Resolves canonical repository and worktree identity once for package consumers.
 *
 * This module owns replay of Git global repository-selection options,
 * canonical path resolution,
 * bare and outside handling,
 * and main-versus-linked classification.
 * Policy-specific allowlisting remains outside this shared identity seam.
 *
 * @param gitPath - absolute real-Git executable
 *
 * @param preSubcommandArgs - original Git global option region
 *
 * @param effectiveCwd - effective cwd after global `-C` chaining
 *
 * @returns canonical selected repository identity
 *
 * @example
 * ```ts
 * await resolveGitWorktreeIdentity({
 *   gitPath: '/usr/bin/git',
 *   preSubcommandArgs: [],
 *   effectiveCwd: '/repo',
 * });
 * // => { kind: 'main-worktree', gitDir: '/repo/.git', commonDir: '/repo/.git', worktreeRoot: '/repo' }
 * ```
 */
export async function resolveGitWorktreeIdentity({
  gitPath,
  preSubcommandArgs,
  effectiveCwd,
}: ResolveGitWorktreeIdentityOptions,): Promise<GitWorktreeIdentity> {
  /**
   * Raw fixed-order identity metadata or repository absence.
   */
  const metadataOutput = await (async function captureMetadata(): Promise<string | undefined> {
    try {
      return await runIdentityGit({
        gitPath,
        preSubcommandArgs,
        effectiveCwd,
        metadataArgs: [
          '--is-inside-work-tree',
          '--is-bare-repository',
          '--git-dir',
          '--git-common-dir',
        ],
      },);
    }
    catch (error: unknown) {
      if (error instanceof SubprocessError)
        return undefined;
      throw error;
    }
  })();
  if (metadataOutput === undefined)
    return { kind: 'outside-worktree', };
  /**
   * Parsed raw paths and repository-shape flags.
   */
  const metadata = parseIdentityMetadata(metadataOutput,);
  if ((!metadata.isInsideWorktree) && (!metadata.isBare))
    return { kind: 'outside-worktree', };
  /**
   * Canonical administrative paths shared by bare and worktree identities.
   */
  const [
    gitDir,
    commonDir,
  ] = await Promise.all([
    realpath(metadata.gitDir,),
    realpath(metadata.commonDir,),
  ],);
  if (metadata.isBare) {
    return {
      kind: 'bare-repository',
      commonDir,
      gitDir,
    };
  }
  /**
   * Canonical effective worktree root for non-bare identity.
   */
  const worktreeRoot = await realpath(stripGitLine(await runIdentityGit({
    gitPath,
    preSubcommandArgs,
    effectiveCwd,
    metadataArgs: ['--show-toplevel',],
  },),),);
  return {
    kind: gitDir === commonDir
      ? 'main-worktree'
      : 'linked-worktree',
    commonDir,
    gitDir,
    worktreeRoot,
  };
}
