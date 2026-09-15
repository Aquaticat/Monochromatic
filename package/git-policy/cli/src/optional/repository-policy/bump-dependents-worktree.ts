// Generated from `package/git-policy/repository/src/bump-dependents-worktree.ts` by file-enforcer; edit canonical source owner.
/**
 Applies the dependent ripple to a worktree whose manifests were bumped outside cli-git, such as by `changeset version`.

 @module
 */
import { execFile, } from 'node:child_process';
import {
  readFile,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';
import { promisify, } from 'node:util';

import {
  MANIFEST_PATHSPEC,
  planWorkspaceBumps,
  type WorkspaceBumpPlan,
  type WorkspaceFileReader,
} from './dependent-bump-workflow.ts';
import { PNPR_CONFIG_PATH, } from './publishable-names.ts';

/**
 Promise form of `execFile`.
 */
const run = promisify(execFile,);

/**
 Largest Git output a listing or blob read may buffer, far above any workspace manifest listing.
 */
const MAX_GIT_OUTPUT_BYTES = 64 * 1024 * 1024;

/**
 Thrown when a manifest changed between planning and writing its bump.
 */
export class WorktreeBumpConflictError extends Error {
  /**
   Creates an error naming the manifest.

   @param path - manifest that changed
   */
  constructor(path: string,) {
    super(`${path} changed while dependent bumps were being applied; rerun the ripple.`,);
    this.name = 'WorktreeBumpConflictError';
  }
}

/**
 Lists tracked paths matching Git pathspecs.

 @param repositoryRoot - worktree root

 @param pathspecs - Git pathspecs

 @returns repository paths
 */
async function listTrackedPaths({
  repositoryRoot,
  pathspecs,
}: Readonly<{
  repositoryRoot: string;
  pathspecs: readonly string[];
}>,): Promise<readonly string[]> {
  /**
   NUL-delimited listing.
   */
  const { stdout, } = await run(
    'git',
    [
      'ls-files',
      '-z',
      '--',
      ...pathspecs,
    ],
    {
      cwd: repositoryRoot,
      maxBuffer: MAX_GIT_OUTPUT_BYTES,
    },
  );
  return stdout.split('\0',).filter(function nonEmpty(path,): boolean {
    return path !== '';
  },);
}

/**
 Reads a file's text at a revision.

 @param repositoryRoot - worktree root

 @param revision - base revision

 @param path - repository path

 @returns text, or nothing when the revision lacks the path
 */
async function textAtRevision({
  repositoryRoot,
  revision,
  path,
}: Readonly<{
  repositoryRoot: string;
  revision: string;
  path: string;
}>,): Promise<readonly string[]> {
  try {
    return [(await run(
      'git',
      [
        'cat-file',
        'blob',
        `${revision}:${path}`,
      ],
      {
        cwd: repositoryRoot,
        maxBuffer: MAX_GIT_OUTPUT_BYTES,
      },
    )).stdout,];
  }
  catch (error: unknown) {
    // A path the base revision lacks is a new manifest, which carries no hand bump.
    if (Error.isError(error,) && ('code' in error) && (error.code === 1 || error.code === 128))
      return [];
    throw error;
  }
}

/**
 Builds a reader comparing the worktree with a base revision.

 @param repositoryRoot - worktree root

 @param baseRevision - revision whose versions count as unbumped

 @returns workspace reader
 */
function worktreeReader({
  repositoryRoot,
  baseRevision,
}: Readonly<{
  repositoryRoot: string;
  baseRevision: string;
}>,): WorkspaceFileReader {
  return {
    manifests: async function listManifests() {
      /**
       Tracked manifest paths.
       */
      const paths = await listTrackedPaths({
        repositoryRoot,
        pathspecs: [MANIFEST_PATHSPEC,],
      },);
      return Promise.all(paths.map(async function readManifest(path,) {
        /**
         Base text, when the base has the manifest.
         */
        const [baseText,] = await textAtRevision({
          repositoryRoot,
          revision: baseRevision,
          path,
        },);
        return {
          path,
          text: await readFile(
            join(
              repositoryRoot,
              path,
            ),
            'utf8',
          ),
          ...(baseText === undefined ? {} : { baseText, }),
        };
      },),);
    },
    sourceFiles: async function listSources(directory,) {
      return (await listTrackedPaths({
        repositoryRoot,
        pathspecs: [`:(glob)${directory}/src/**`,],
      },)).map(function toSource(path,) {
        return {
          path,
          text: function loadText() {
            return readFile(
              join(
                repositoryRoot,
                path,
              ),
              'utf8',
            );
          },
        };
      },);
    },
    pnprConfigText: async function readConfig() {
      try {
        return [await readFile(
          join(
            repositoryRoot,
            PNPR_CONFIG_PATH,
          ),
          'utf8',
        ),];
      }
      catch (error: unknown) {
        if (Error.isError(error,) && ('code' in error) && (error.code === 'ENOENT'))
          return [];
        throw error;
      }
    },
  };
}

/**
 Plans and writes patch bumps for publishable dependents of manifests whose version differs from a base revision.

 @param repositoryRoot - worktree root

 @param baseRevision - revision whose versions count as unbumped

 @returns the applied plan

 @throws WorktreeBumpConflictError when a manifest changed before its bump was written

 @throws UnsupportedVersionError when a dependent needing a bump has a non-release version

 @example
 ```ts
 await bumpWorktreeDependents({ repositoryRoot: '/repo', baseRevision: 'HEAD' });
 ```
 */
export async function bumpWorktreeDependents({
  repositoryRoot,
  baseRevision,
}: Readonly<{
  repositoryRoot: string;
  baseRevision: string;
}>,): Promise<WorkspaceBumpPlan> {
  /**
   Planned ripple.
   */
  const plan = await planWorkspaceBumps(worktreeReader({
    repositoryRoot,
    baseRevision,
  },),);
  for (const bump of plan.bumps) {
    /**
     Absolute manifest path.
     */
    const destination = join(
      repositoryRoot,
      bump.path,
    );
    // oxlint-disable-next-line no-await-in-loop -- Each manifest is re-read immediately before its own write.
    if ((await readFile(destination, 'utf8',)) !== bump.text)
      throw new WorktreeBumpConflictError(bump.path,);
    // oxlint-disable-next-line no-await-in-loop -- Writes follow plan order so a failure names the first unwritten manifest.
    await writeFile(
      destination,
      bump.replacement,
    );
  }
  return plan;
}
