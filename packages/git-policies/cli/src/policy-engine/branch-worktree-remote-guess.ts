import nanoSpawn, { SubprocessError, } from 'nano-spawn';

//region Remote-guess probes

/**
 * Sentinel returned when git query fails before stdout can be read.
 */
const GIT_QUERY_FAILED: unique symbol = Symbol('git query failed before stdout could be read');

/**
 * Sentinel returned when remote ref short name does not contain remote separator.
 */
const MALFORMED_REMOTE_REF: unique symbol = Symbol('for-each-ref output lacks slash separator after fetch source');

/**
 * Local part used by remote default-branch symbolic refs, for example `origin/HEAD`.
 */
const REMOTE_HEAD_LOCAL_NAME = 'HEAD';

/**
 * Options for a read-only git query.
 */
type GitQueryOptions = {
  /**
   * Absolute path to real git binary.
   */
  readonly gitPath: string;
  /**
   * Pre-subcommand global options from caller argv.
   */
  readonly preSubcommandArgs: readonly string[];
  /**
   * Read-only git subcommand argv to append after caller global options.
   */
  readonly args: readonly string[];
};

/**
 * Runs read-only git query and reports whether it exits successfully.
 *
 * @param gitPath - Absolute path to real git binary.
 *
 * @param preSubcommandArgs - Caller global options that select repository.
 *
 * @param args - Read-only git argv appended after global options.
 *
 * @returns `true` when query exits zero.
 *
 * @throws When the query fails for a reason nano-spawn does not model as a {@link SubprocessError}.
 */
async function gitQuerySucceeds({
  gitPath,
  preSubcommandArgs,
  args,
}: GitQueryOptions,): Promise<boolean> {
  try {
    await nanoSpawn(
      gitPath,
      [
        ...preSubcommandArgs,
        ...args,
      ],
    );
    return true;
  }
  catch (error) {
    if (!(error instanceof SubprocessError))
      throw error;

    return false;
  }
}

/**
 * Runs read-only git query and returns stdout, or sentinel when git rejects it.
 *
 * @param gitPath - Absolute path to real git binary.
 *
 * @param preSubcommandArgs - Caller global options that select repository.
 *
 * @param args - Read-only git argv appended after global options.
 *
 * @returns Captured stdout when query exits zero, otherwise {@link GIT_QUERY_FAILED}.
 *
 * @throws When the query fails for a reason nano-spawn does not model as a {@link SubprocessError}.
 */
async function gitQueryStdout({
  gitPath,
  preSubcommandArgs,
  args,
}: GitQueryOptions,): Promise<string | typeof GIT_QUERY_FAILED> {
  try {
    /**
     * Captured git query result.
     */
    const result = await nanoSpawn(
      gitPath,
      [
        ...preSubcommandArgs,
        ...args,
      ],
    );
    return result.stdout;
  }
  catch (error) {
    if (!(error instanceof SubprocessError))
      throw error;

    return GIT_QUERY_FAILED;
  }
}

/**
 * Extracts branch-name portion from `<remote>/<branch>` ref short name.
 *
 * @param remoteRef - Remote-tracking ref short name from git for-each-ref.
 *
 * @returns Branch-name portion after remote name, or {@link MALFORMED_REMOTE_REF} for malformed refs.
 */
function remoteLocalName(remoteRef: string,): string | typeof MALFORMED_REMOTE_REF {
  /**
   * Separator between remote name and branch name.
   */
  const slashIndex = remoteRef.indexOf('/',);

  if (slashIndex === (-1))
    return MALFORMED_REMOTE_REF;

  return remoteRef.slice(slashIndex + 1,);
}

/**
 * Reports whether switch/checkout would implicitly create local branch from
 * one remote. Checks for an existing local branch with
 * {@link gitQuerySucceeds}, lists matching remote-tracking refs with
 * {@link gitQueryStdout} (treating a failed query as {@link GIT_QUERY_FAILED}),
 * and extracts each ref's branch name with {@link remoteLocalName}, excluding
 * the {@link REMOTE_HEAD_LOCAL_NAME} symbolic ref.
 *
 * @param gitPath - Absolute path to real git binary.
 *
 * @param preSubcommandArgs - Caller global options that select repository.
 *
 * @param target - Branch-like target passed to switch/checkout.
 *
 * @returns `true` when no local branch exists and exactly one matching remote branch exists.
 *
 * @example
 * ```ts
 * await implicitRemoteGuessCreatesBranch({
 *   gitPath: '/usr/bin/git',
 *   preSubcommandArgs: ['-C', '/repo'],
 *   target: 'topic',
 * });
 * // => true when only origin/topic exists and no local topic exists
 * ```
 */
export async function implicitRemoteGuessCreatesBranch({
  gitPath,
  preSubcommandArgs,
  target,
}: {
  readonly gitPath: string;
  readonly preSubcommandArgs: readonly string[];
  readonly target: string;
},): Promise<boolean> {
  /**
   * Whether target already names a local branch, so switch/checkout does not create one.
   */
  const hasLocalBranch = await gitQuerySucceeds({
    gitPath,
    preSubcommandArgs,
    args: [
      'show-ref',
      '--verify',
      '--quiet',
      `refs/heads/${target}`,
    ],
  },);

  if (hasLocalBranch)
    return false;

  /**
   * Remote-tracking branch refs visible in selected repository.
   */
  const remoteRefs = await gitQueryStdout({
    gitPath,
    preSubcommandArgs,
    args: [
      'for-each-ref',
      '--format=%(refname:short)',
      `refs/remotes/*/${target}`,
    ],
  },);

  /**
   * Whether remote refs query failed before producing stdout.
   */
  const remoteRefsUnavailable = (typeof remoteRefs) === 'symbol';

  if (remoteRefsUnavailable)
    return false;

  /**
   * Remote branches whose local branch name equals switch/checkout target.
   */
  const matchingRemoteRefs = remoteRefs
    .split('\n',)
    .map(function mapRemoteLocalName(remoteRef,): string | typeof MALFORMED_REMOTE_REF {
      return remoteLocalName(remoteRef,);
    },)
    .filter(function isMatchingRemote(localName,): boolean {
      /**
       * Whether parsed remote ref local name is real branch text.
       */
      const isRemoteBranchName = (typeof localName) === 'string';

      return isRemoteBranchName
        && (localName === target)
        && (localName !== REMOTE_HEAD_LOCAL_NAME);
    },);

  return matchingRemoteRefs.length === 1;
}

//endregion Remote-guess probes
