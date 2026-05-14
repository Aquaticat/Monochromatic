/**
 * Git-derived publication and update dates for MDX posts.
 *
 * Probes `git log --follow` for the oldest and newest commits touching
 * each post file. Falls back to file mtime when the file is untracked
 * or uncommitted. When the local repository is a shallow clone,
 * the oldest commit is fetched via the GitHub REST API through `gh`
 * because shallow history does not contain it.
 *
 * Authorship note: dev previews of pre-commit posts will show mtime-based
 * dates; first commit snaps both dates to commit author timestamps.
 * Authoring without committing is undefined behavior.
 */
import { stat, } from 'node:fs/promises';
import { resolve, } from 'node:path';

import spawn, { type Result, } from 'nano-spawn';

import { findMonorepoRootCached, } from '@monochromatic-dev/module-fs-path/find-monorepo-root';

import type { Logger, } from './types.ts';

//region Helpers

/** Result of running a git (or gh) command with stdout captured as UTF-8. */
type CommandResult = Pick<Result, 'stdout' | 'stderr'>;

/**
 * Executes a command, returning captured stdout and stderr strings.
 *
 * Wraps `nano-spawn` so callers see a narrow return type containing only
 * the stream fields they consume.
 *
 * @param cmd - executable name or absolute path
 *
 * @param args - argument vector passed without shell interpretation
 *
 * @returns captured stdout and stderr as strings
 *
 * @throws when the command exits with a non-zero status
 *
 * @example
 * ```ts
 * const { stdout } = await runCapture('git', ['rev-parse', 'HEAD']);
 * ```
 */
async function runCapture(
  cmd: string,
  args: readonly string[],
  { cwd, }: { cwd?: string; } = {},
): Promise<CommandResult> {
  /** Destructured spawn result; only stdout and stderr are forwarded to the caller. */
  const {
    stdout,
    stderr,
  } = await spawn(
    cmd,
    args,
    { cwd, },
  );
  return {
    stdout,
    stderr,
  };
}

/**
 * Runs git with the cwd pinned to the repository root.
 *
 * @param args - git subcommand and arguments
 *
 * @returns captured stdout and stderr
 *
 * @example
 * ```ts
 * const { stdout } = await runGit(['rev-parse', 'HEAD']);
 * ```
 */
async function runGit(args: readonly string[],): Promise<CommandResult> {
  /** Repository root cached lookup pinning the git cwd. */
  const root = await findMonorepoRootCached();
  return runCapture(
    'git',
    args,
    { cwd: root, },
  );
}

//endregion Helpers

//region Repository probes

/**
 * Reads the current `HEAD` commit SHA of the working repository.
 *
 * Used as a coarse invalidation key for cached git-derived dates: when the
 * SHA matches the one stored in the build manifest, cached dates are still
 * accurate and no per-file git probing is needed.
 *
 * @returns 40-character hexadecimal commit SHA
 *
 * @example
 * ```ts
 * const sha = await getHeadSha();
 * ```
 */
export async function getHeadSha(): Promise<string> {
  /** Captured stdout from `git rev-parse HEAD` containing the 40-char SHA plus newline. */
  const { stdout, } = await runGit([
    'rev-parse',
    'HEAD',
  ],);
  return stdout.trim();
}

/**
 * Checks whether the current repository is a shallow clone.
 *
 * Shallow clones lack the oldest commits that `git log --reverse --follow`
 * needs to derive the publication date. When shallow, `getPostDates` falls
 * back to the GitHub REST API through `gh` for the "published" lookup.
 *
 * @returns `true` when the repository is shallow, `false` otherwise
 *
 * @example
 * ```ts
 * const shallow = await detectShallow();
 * ```
 */
export async function detectShallow(): Promise<boolean> {
  /** Captured stdout from `git rev-parse --is-shallow-repository`; trimmed to `true`/`false`. */
  const { stdout, } = await runGit([
    'rev-parse',
    '--is-shallow-repository',
  ],);
  return stdout.trim() === 'true';
}

/**
 * Parses `owner/repo` from the `origin` remote URL.
 *
 * Accepts both SSH (`git@github.com:owner/repo.git`) and HTTPS
 * (`https://github.com/owner/repo.git`) remotes. Strips the optional
 * trailing `.git` suffix.
 *
 * @returns `owner/repo` identifier, or `undefined` when the remote is not GitHub
 *
 * @example
 * ```ts
 * const slug = await getGithubSlug(); // 'Aquaticat/Monochromatic'
 * ```
 */
async function getGithubSlug(): Promise<string | undefined> {
  try {
    /** Captured stdout from `git remote get-url origin`; may be SSH or HTTPS form. */
    const { stdout, } = await runGit([
      'remote',
      'get-url',
      'origin',
    ],);
    /** Trimmed remote URL fed to the slug regex. */
    const url = stdout.trim();
    /** Regex capture extracting `owner/repo` from either supported URL form. */
    const match = /github\.com[:/]([^/]+\/[^/.]+)(?:\.git)?$/.exec(url,);
    return match?.[1];
  }
  catch {
    return undefined;
  }
}

//endregion Repository probes

//region Local git lookups

/**
 * Runs `git log --follow` and returns commit author dates as ISO-8601 strings
 * in reverse-chronological order (newest first, oldest last).
 *
 * `--follow` traces the file across renames so a post that moved directories
 * still reports its original first-commit date.
 *
 * Intentionally fetches the full history rather than combining `--reverse`
 * with `-n 1`: git applies `-n` during traversal before `--reverse` reverses
 * the already-limited set, so `--reverse -n 1` silently returns no lines.
 * For blog posts with modest commit counts, fetching all lines is negligible.
 *
 * @param filePath - path to the file whose history to query
 *
 * @returns array of ISO-8601 author dates newest-first, empty when the file has no history
 *
 * @example
 * ```ts
 * const dates = await gitLogDates({ filePath: 'post.mdx' });
 * // dates[0] is newest, dates.at(-1) is oldest
 * ```
 */
async function gitLogDates(
  { filePath, }: { filePath: string; },
): Promise<string[]> {
  /** Absolute file path passed to git so `--follow` can trace renames consistently. */
  const absolute = resolve(
    process.cwd(),
    filePath,
  );
  /** Captured stdout: newline-separated ISO-8601 author dates newest-first. */
  const { stdout, } = await runGit([
    'log',
    '--follow',
    '--format=%aI',
    '--',
    absolute,
  ],);
  return stdout.split('\n',).filter(function keepNonEmpty(line,) {
    return line.trim().length > 0;
  },);
}

//endregion Local git lookups

//region GitHub API fallback

/**
 * Resolves the repository-relative path for a file, as required by the
 * GitHub REST API's `path` query parameter.
 *
 * @param filePath - absolute or cwd-relative path to the file
 *
 * @returns path relative to the repository root using forward slashes
 *
 * @example
 * ```ts
 * const rel = await getRepoRelativePath('src/content/en/post.mdx');
 * // → 'packages/webapp-content/ssg-test/src/content/en/post.mdx'
 * ```
 */
async function getRepoRelativePath(filePath: string,): Promise<string> {
  /** Repository root cached lookup pinning the git cwd. */
  const root = await findMonorepoRootCached();
  /** Absolute path normalised before handing to `git ls-files --full-name`. */
  const absolute = resolve(
    process.cwd(),
    filePath,
  );
  /** Captured stdout containing the repo-relative path with forward slashes. */
  const { stdout, } = await runCapture(
    'git',
    [
      'ls-files',
      '--full-name',
      '--',
      absolute,
    ],
    { cwd: root, },
  );
  return stdout.trim();
}

/**
 * Fetches the oldest commit author date for a file via the GitHub REST API.
 *
 * Pages through `GET /repos/{owner}/{repo}/commits?path=<path>` with
 * `--paginate`; the response is ordered newest-first, so the last entry
 * is the oldest commit that touched the path.
 *
 * @param slug - GitHub `owner/repo` identifier
 *
 * @param repoRelPath - path relative to the repository root
 *
 * @returns ISO-8601 author date string, or `undefined` when the API returns
 * no commits for the path (e.g., path exists only in a local branch)
 *
 * @example
 * ```ts
 * const first = await ghApiFirstCommitDate({
 *   slug: 'Aquaticat/Monochromatic',
 *   repoRelPath: 'packages/webapp-content/ssg-test/src/content/en/post.mdx',
 * });
 * ```
 */
async function ghApiFirstCommitDate(
  {
    slug,
    repoRelPath,
  }: {
    slug: string;
    repoRelPath: string;
  },
): Promise<string | undefined> {
  /** Captured stdout from `gh api` containing concatenated JSON pages. */
  const { stdout, } = await runCapture(
    'gh',
    [
      'api',
      '--paginate',
      `repos/${slug}/commits?path=${encodeURIComponent(repoRelPath,)}&per_page=100`,
    ],
  );

  /* `--paginate` concatenates JSON arrays with no separator between pages.
   * Parse by splitting on `][` and re-bracketing; single-page output parses
   * directly as JSON. */
  /** Trimmed JSON payload returned from `gh api --paginate`. */
  const raw = stdout.trim();
  if (raw.length === 0)
    return undefined;

  /**
   * Each commit object from the GitHub REST API exposes the relevant
   * `commit.author.date` field; other fields are ignored.
   */
  type GhCommit = { commit: { author: { date: string; }; }; };

  /** Flat list of commits across all returned pages. */
  const commits: GhCommit[] = raw.includes('][',)
    // oxlint-disable-next-line typescript-eslint(no-unsafe-type-assertion) -- JSON.parse returns any; shape is validated by the access below
    ? (raw.split('][',).flatMap(function parseChunk(
      chunk,
      i,
      arr,
    ) {
      /** Opening bracket re-inserted on every chunk except the first to rebuild the JSON array boundary. */
      const prefix = i === 0 ? '' : '[';
      /** Closing bracket re-inserted on every chunk except the last to rebuild the JSON array boundary. */
      const suffix = i === arr.length - 1 ? '' : ']';
      // oxlint-disable-next-line typescript-eslint(no-unsafe-return) -- see above
      return JSON.parse(`${prefix}${chunk}${suffix}`,);
    },) as GhCommit[])
    // oxlint-disable-next-line typescript-eslint(no-unsafe-type-assertion) -- see above
    : (JSON.parse(raw,) as GhCommit[]);

  /** Oldest commit in the API response (last entry per GitHub's newest-first ordering). */
  const last = commits.at(-1,);
  return last?.commit.author.date;
}

//endregion GitHub API fallback

//region Public API

/**
 * Dates derived for a single post from git history, with fallbacks.
 */
type PostDates = {
  /** Author date of the oldest commit touching the file. */
  published: Date;
  /** Author date of the newest commit touching the file. */
  updated: Date;
};

/**
 * Resolves `published` and `updated` dates for a single post.
 *
 * Strategy:
 * - `updated`: newest commit author date from local `git log --follow`
 * - `published`: oldest commit author date from local `git log --follow --reverse`,
 *   or GitHub REST API when the clone is shallow
 * - Fallback on both; file mtime when the file has no git history (untracked or uncommitted)
 *
 * @param filePath - absolute or cwd-relative path to the MDX file
 *
 * @param isShallow - pre-computed shallow-clone flag (from `detectShallow`)
 *
 * @param githubSlug - pre-resolved `owner/repo`; required when shallow
 *
 * @param l - tagged logger used for fallback diagnostics
 *
 * @returns derived `published` and `updated` dates
 *
 * @throws when the repository is shallow but no GitHub slug is available
 *
 * @example
 * ```ts
 * const dates = await getPostDates({
 *   filePath: 'src/content/en/post.mdx',
 *   isShallow: false,
 *   githubSlug: undefined,
 *   l,
 * });
 * ```
 */
export async function getPostDates(
  {
    filePath,
    isShallow,
    githubSlug,
    l,
  }: {
    filePath: string;
    isShallow: boolean;
    githubSlug: string | undefined;
    l: Logger;
  },
): Promise<PostDates> {
  /** Newest-first list of author dates for every commit touching the file. */
  const localHistory = await gitLogDates({ filePath, },);
  /** Author date of the most recent commit, if any. */
  const [latestIso,]: readonly (string | undefined)[] = localHistory;
  /**
   * Author date of the oldest commit from local history.
   * Shallow clones omit the true first commit, so this value is unreliable
   * when `isShallow` is set; in that case the gh-api fallback replaces it.
   */
  const oldestLocalIso: string | undefined = isShallow
    ? undefined
    : localHistory.at(-1,);

  /** Final `published` ISO string, resolved through shallow/gh fallback when needed. */
  let publishedIso: string | undefined = oldestLocalIso;
  if (publishedIso === undefined && isShallow && latestIso !== undefined) {
    if (githubSlug === undefined) {
      throw new Error(
        `Shallow clone detected but no GitHub remote configured; cannot resolve published date for ${filePath}. Fetch with --unshallow or configure an origin on github.com.`,
      );
    }
    /** Repo-relative form required by the GitHub commits API `path` query param. */
    const repoRelPath = await getRepoRelativePath(filePath,);
    publishedIso = await ghApiFirstCommitDate({
      slug: githubSlug,
      repoRelPath,
    },);
    l.info(
      `shallow clone: resolved published date for ${filePath} via gh api`,
    );
  }

  if (latestIso !== undefined && publishedIso !== undefined) {
    return {
      published: new Date(publishedIso,),
      updated: new Date(latestIso,),
    };
  }

  /** File mtime fallback for untracked or uncommitted files. */
  const stats = await stat(filePath,);
  /** Date-typed mtime used to fill in whichever field is missing from git history. */
  const mtime = new Date(stats.mtimeMs,);
  /** Names of fields filled in from mtime, surfaced in the diagnostic log line. */
  const missing: string[] = [];
  if (publishedIso === undefined)
    missing.push('published',);
  if (latestIso === undefined)
    missing.push('updated',);
  l.info(
    `git history incomplete for ${filePath} (missing ${
      missing.join(', ',)
    }); falling back to file mtime for missing fields`,
  );
  return {
    published: publishedIso !== undefined ? new Date(publishedIso,) : mtime,
    updated: latestIso !== undefined ? new Date(latestIso,) : mtime,
  };
}

/**
 * Pre-resolved repository-level context shared across all post-date lookups.
 *
 * One instance is built at the start of a build and threaded through
 * `loadContent` and cache-overlay paths so per-file work is bounded
 * to at most two git invocations plus one optional `gh api` call.
 */
export type GitDatesContext = {
  /** Current `HEAD` commit SHA. */
  headSha: string;
  /** Whether the repository is a shallow clone. */
  isShallow: boolean;
  /** GitHub `owner/repo` slug when origin is on github.com. */
  githubSlug: string | undefined;
};

/**
 * Resolves the shared git-dates context for the current build.
 *
 * Runs all repository-level probes concurrently.
 *
 * @returns populated git-dates context
 *
 * @example
 * ```ts
 * const ctx = await resolveGitDatesContext();
 * ```
 */
export async function resolveGitDatesContext(): Promise<GitDatesContext> {
  /** Repository-level probes gathered concurrently into a single context object. */
  const [headSha, isShallow, githubSlug,] = await Promise.all([
    getHeadSha(),
    detectShallow(),
    getGithubSlug(),
  ],);
  return {
    headSha,
    isShallow,
    githubSlug,
  };
}

//endregion Public API
