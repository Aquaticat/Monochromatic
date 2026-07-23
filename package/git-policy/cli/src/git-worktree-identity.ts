import { realpath, } from 'node:fs/promises';

import { SubprocessError, } from 'nano-spawn';

import {
  runMetadataGit,
  stripGitLine,
} from './git-metadata.ts';
import { parseGlobalOptions, } from './parse-global-options.ts';

/**
 * Metadata Git process reports target absence.
 */
const IDENTITY_METADATA_ABSENT: unique symbol = Symbol(
  'Git worktree identity metadata is absent',
);

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
    /**
     * Effective cwd after Git global `-C` chaining.
     */
    effectiveCwd: string;
  }>
  | Readonly<{
    /**
     * Bare repository with no source worktree root.
     */
    kind: 'bare-repository';
    /**
     * Effective cwd after Git global `-C` chaining.
     */
    effectiveCwd: string;
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
     * Effective cwd after Git global `-C` chaining.
     */
    effectiveCwd: string;
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
     * Effective cwd after Git global `-C` chaining.
     */
    effectiveCwd: string;
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
   * Complete forwarded Git arguments.
   */
  args: readonly string[];
  /**
   * Absolute real-Git executable.
   */
  gitPath: string;
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
   * Raw Git common-directory path.
   */
  commonDir: string;
  /**
   * Raw invocation-specific Git-directory path.
   */
  gitDir: string;
}>;

/**
 * Runs real Git metadata command against exact effective target selection.
 *
 * @param gitPath - absolute real-Git executable
 *
 * @param preSubcommandArgs - original Git global option region
 *
 * @param invocationCwd - wrapper process working directory
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
 *   invocationCwd: '/repo',
 *   metadataArgs: ['--git-dir'],
 * });
 * ```
 */
function runIdentityGit({
  gitPath,
  preSubcommandArgs,
  invocationCwd,
  metadataArgs,
}: Readonly<{
  gitPath: string;
  preSubcommandArgs: readonly string[];
  invocationCwd: string;
  metadataArgs: readonly string[];
}>,): Promise<string> {
  return runMetadataGit({
    gitPath,
    args: [
      ...preSubcommandArgs,
      'rev-parse',
      '--path-format=absolute',
      ...metadataArgs,
    ],
    cwd: invocationCwd,
  },);
}

/**
 * Reads fixed-order identity metadata or reports Git target absence.
 *
 * @param gitPath - absolute real-Git executable
 *
 * @param preSubcommandArgs - original Git global option region
 *
 * @param invocationCwd - wrapper process working directory
 *
 * @returns raw identity metadata or absence sentinel
 *
 * @example
 * ```ts
 * await readIdentityMetadata({
 *   gitPath: '/usr/bin/git',
 *   preSubcommandArgs: [],
 *   invocationCwd: '/repo',
 * });
 * ```
 */
async function readIdentityMetadata({
  gitPath,
  preSubcommandArgs,
  invocationCwd,
}: Readonly<{
  gitPath: string;
  preSubcommandArgs: readonly string[];
  invocationCwd: string;
}>,): Promise<string | typeof IDENTITY_METADATA_ABSENT> {
  try {
    return await runIdentityGit({
      gitPath,
      preSubcommandArgs,
      invocationCwd,
      metadataArgs: [
        '--is-bare-repository',
        '--git-dir',
        '--git-common-dir',
      ],
    },);
  }
  catch (error: unknown) {
    if (error instanceof SubprocessError)
      return IDENTITY_METADATA_ABSENT;
    throw error;
  }
}

/**
 * Parses fixed-order worktree identity metadata.
 *
 * @param output - three-line real-Git metadata output
 *
 * @returns validated identity metadata
 *
 * @throws when real Git returns incomplete metadata
 *
 * @example
 * ```ts
 * parseIdentityMetadata('false\n/repo/.git\n/repo/.git\n');
 * ```
 */
function parseIdentityMetadata(output: string,): ParsedIdentityMetadata {
  /**
   * Fixed-order metadata fields without terminal line break.
   */
  const [
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
 * @param args - complete forwarded Git arguments
 *
 * @param gitPath - absolute real-Git executable
 *
 * @returns selected repository identity with canonical repository paths
 *
 * @example
 * ```ts
 * await resolveGitWorktreeIdentity({
 *   args: ['-C', '/repo', 'status'],
 *   gitPath: '/usr/bin/git',
 * });
 * // => {
 * //   kind: 'main-worktree',
 * //   effectiveCwd: '/repo',
 * //   gitDir: '/repo/.git',
 * //   commonDir: '/repo/.git',
 * //   worktreeRoot: '/repo',
 * // }
 * ```
 */
export async function resolveGitWorktreeIdentity({
  args,
  gitPath,
}: ResolveGitWorktreeIdentityOptions,): Promise<GitWorktreeIdentity> {
  /**
   * Effective cwd and subcommand location for forwarded invocation.
   */
  const {
    effectiveCwd,
    subcommandIndex,
  } = parseGlobalOptions(args,);
  /**
   * Exact global option region selecting repository target.
   */
  const preSubcommandArgs = args.slice(
    0,
    subcommandIndex,
  );
  /**
   * Wrapper process cwd from which Git applies original global options.
   */
  const invocationCwd = process.cwd();
  /**
   * Raw fixed-order identity metadata or repository absence.
   */
  const metadataOutput = await readIdentityMetadata({
    gitPath,
    preSubcommandArgs,
    invocationCwd,
  },);
  if ((typeof metadataOutput) === 'symbol') {
    return {
      kind: 'outside-worktree',
      effectiveCwd,
    };
  }
  /**
   * Parsed raw paths and repository-shape flags.
   */
  const metadata = parseIdentityMetadata(metadataOutput,);
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
      effectiveCwd,
      gitDir,
    };
  }
  /**
   * Git-reported effective worktree root with terminal line break.
   */
  const worktreeOutput = await runIdentityGit({
    gitPath,
    preSubcommandArgs,
    invocationCwd,
    metadataArgs: ['--show-toplevel',],
  },);
  /**
   * Canonical effective worktree root for non-bare identity.
   */
  const worktreeRoot = await realpath(stripGitLine(worktreeOutput,),);
  return {
    kind: gitDir === commonDir
      ? 'main-worktree'
      : 'linked-worktree',
    commonDir,
    effectiveCwd,
    gitDir,
    worktreeRoot,
  };
}
