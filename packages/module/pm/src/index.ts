import {
  fs,
  path,
} from '@monochromatic.dev/module-fs-path';
import { notUndefinedOrThrow } from '@monochromatic.dev/module-not-or-throw';
import { findUp } from 'find-up';
import { homedir } from 'node:os';
import {
  mapParallelAsync,
  pipedAsync,
} from 'rambdax';
import {getLogger} from'@logtape/logtape';
const l = getLogger(['module', 'pm']);

/** Detect which pm and install strategy is used for the specified file or folder inside a npm package

@remarks
Does not support yarn classic.
Supports independent packages or package in workspace.

@param fileOrFolderInPkgAbsPath - string of absolute path of any file or folder in package, defaults to path.resolve()

@returns an object containing packageManager and nodeLinker, as specified by https://pnpm.io/npmrc#node-linker
 */
export default async function pm(fileOrFolderInPkgAbsPath = path.resolve()): Promise<
  & (
    | { packageManager: 'pnpm'; nodeLinker: 'isolated' | 'hoisted' | 'pnp'; }
    | { packageManager: 'bun'; nodeLinker: 'hoisted'; }
    | { packageManager: 'yarn'; nodeLinker: 'isolated' | 'hoisted' | 'pnp'; }
    | { packageManager: 'npm'; nodeLinker: 'hoisted'; }
  )
  & ({ isInWorkspace: boolean; packageAbsDir: string; workspaceAbsDir: string; })
> {
  const fileOrFolderInPkgAbsPathObj = await path.parseFs(fileOrFolderInPkgAbsPath);
  /* First, we check packageManager field in package.json, stopping at any workspace or user home dir.
  Special case: if any workspace specification file is found, we use that package manager. */

  const result: Partial<Awaited<ReturnType<typeof pm>>> & Pick<Awaited<ReturnType<typeof pm>>, 'packageAbsDir'> = {
    packageAbsDir: notUndefinedOrThrow(
      await findUp(async (potentialPackageDir) => {
        if (!await fs.exists(path.join(potentialPackageDir, 'package.json'))) {
          return;
        }
        return potentialPackageDir;
      }, {
        cwd: fileOrFolderInPkgAbsPathObj.currentAbsDir,
        stopAt: homedir(),
        type: 'directory',
      }),
    ),
  };
  l.debug`result ${result}`;


  const workspaceAbsDir = await findUp(async (potentialWorkspaceDir) => {
    if (!await fs.exists(path.join(potentialWorkspaceDir, 'package.json'))) {
      return;
    }
    if (
      !(await pipedAsync(path.join(potentialWorkspaceDir, 'package.json'), fs.readFileU, JSON.parse)?.workspaces)
      && !await fs.exists(path.join(potentialWorkspaceDir, 'pnpm-workspace.yaml'))
    ) {
      return;
    }
    return potentialWorkspaceDir;
  }, { cwd: fileOrFolderInPkgAbsPathObj.currentAbsDir, stopAt: homedir(), type: 'directory' });

  const resultWWorkspace: typeof result & Pick<Awaited<ReturnType<typeof pm>>, 'isInWorkspace' | 'workspaceAbsDir'> =
    workspaceAbsDir
      ? { ...result, isInWorkspace: true, workspaceAbsDir }
      : { ...result, isInWorkspace: false, workspaceAbsDir: result.packageAbsDir };
  l.debug`resultWWorkspace ${resultWWorkspace}`;

  const [
    pnpmLockExists,
    bunLockExists,
    /* Just because yarn.lock exists doesn't mean it's yarn.
    Could be bun, when the option to generate a yarn.lock file is enabled. */
    yarnLockExists,
    packageLockExists,
    pnpExists,
    nodeModulesPnpmExists,
    nodeModulesYarnExists,
  ] = await mapParallelAsync(
    async (base: string) => await fs.exists(path.join(resultWWorkspace.workspaceAbsDir, base)),
    [
      'pnpm-lock.yaml',
      'bun.lockb',
      'yarn.lock',
      'package-json.lock',
      '.pnp.cjs',
      path.join('node_modules', '.pnpm'),
      path.join('node_modules', '.store'),
    ],
  );

  if (bunLockExists) {
    return { ...resultWWorkspace, packageManager: 'bun', nodeLinker: 'hoisted' };
  }

  if (packageLockExists) {
    return { ...resultWWorkspace, packageManager: 'npm', nodeLinker: 'hoisted' };
  }

  if (nodeModulesPnpmExists) {
    return { ...resultWWorkspace, packageManager: 'pnpm', nodeLinker: 'isolated' };
  }

  if (nodeModulesYarnExists) {
    return { ...resultWWorkspace, packageManager: 'yarn', nodeLinker: 'isolated' };
  }

  if (pnpExists) {
    const resultWLinker = { ...resultWWorkspace, nodeLinker: 'pnp' } as const;
    if (pnpmLockExists) {
      return { ...resultWLinker, packageManager: 'pnpm' };
    }
    if (yarnLockExists) {
      return { ...resultWLinker, packageManager: 'yarn' };
    }
    throw new Error(
      `unable to determine package manager at ${fileOrFolderInPkgAbsPath} of workspace ${resultWLinker.workspaceAbsDir}, .pnp.cjs exists but neither pnpm-lock.yaml nor yarn.lock exists.`,
    );
  }

  if (pnpmLockExists) {
    return { ...resultWWorkspace, packageManager: 'pnpm', nodeLinker: 'hoisted' };
  }

  if (yarnLockExists) {
    return { ...resultWWorkspace, packageManager: 'yarn', nodeLinker: 'hoisted' };
  }

  throw new Error(
    `unable to determine package manager at ${fileOrFolderInPkgAbsPath} of workspace ${resultWWorkspace}, none of pnpm-lock.yaml, bun.lockb, yarn.lock, package-json.lock, .pnp.cjs, node_modules/.pnpm, node_modules/.yarn exists.`,
  );

  /* If there's .pnpm folder in node_modules, we know for sure pnpm installed it and the node linker is isolated. */

  /* If any package manager specific configuration file or configuration is found, we use that package manager.
  Not making this a first check since the configuration file may just be placed there but unused. */
}
