import { getLogger } from '@logtape/logtape';
import {
  mapIterableAsync,
  notUndefinedOrThrow,
  pipedAsync,
  throws,
} from '@monochromatic-dev/module-es/ts';
import { parse as jsoncParse } from '@std/jsonc';
import { findUp } from 'find-up';
import { homedir } from 'node:os';
import type {
  PackageJson,
  TsConfigJson,
} from 'type-fest';
import { exec } from './child_process.ts';
import {
  fs,
  path,
} from './fs-path.ts';

const l = getLogger(['m', 'pm']);

export type PackageInfo =
  & (
    // TODO: Support inferring current runtime.
    // Consider if to support Deno depending on how well it handles package.json files.
    | {
      packageManager: 'pnpm';
      pe: 'pnpm exec';
      pr: 'pnpm run';
      nodeLinker: 'isolated' | 'hoisted' | 'pnp';
      runtime: 'node';
    }
    | {
      packageManager: 'bun';
      pe: 'bun run';
      pr: 'bun run';
      nodeLinker: 'hoisted';
      runtime: 'bun';
    }
    | {
      packageManager: 'yarn';
      pe: 'yarn run -T -B';
      pr: 'yarn run';
      nodeLinker: 'isolated' | 'hoisted' | 'pnp';
      runtime: 'yarn node';
    }
    | {
      packageManager: 'npm';
      pe: 'npm exec --';
      pr: 'npm run';
      nodeLinker: 'hoisted';
      runtime: 'node';
    }
  )
  & ({
    isInWorkspace: boolean;
    packageAbsDir: string;
    workspaceAbsDir: string;
    tsconfigJson: false | TsConfigJson;
    packageJson: PackageJson;
    // TODO: Add runtime args
    runtimeArgs: string[];
  });

// TODO: Make this more modular.
//       Support defining new package managers separately.

/** Detect which pm and install strategy is used for the specified file or folder inside a npm package

 @remarks
 Does not support yarn classic.
 Supports independent packages or package in workspace.

 @param fileOrFolderInPkgAbsPath - string of absolute path of any file or folder in package, defaults to path.resolve()

 @returns an object containing:
  packageManager and nodeLinker, as specified by https://pnpm.io/npmrc#node-linker
  pe - command prefix of current package manager to execute a binary
  pr - command prefix of current package manager to execute a npm script
 */
async function packageInfoFn(
  fileOrFolderInPkgAbsPath: string = path.resolve(),
): Promise<PackageInfo> {
  const fileOrFolderInPkgAbsPathObj = await path.parseFs(fileOrFolderInPkgAbsPath);
  /* First, we check packageManager field in package.json, stopping at any workspace or user home dir.
   Special case: if any workspace specification file is found, we use that package manager. */

  const result:
    & Partial<PackageInfo>
    & Pick<PackageInfo, 'packageAbsDir'> = {
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

  const [tsconfigJson, packageJson]: [
    typeof result.tsconfigJson,
    typeof result.packageJson,
  ] = await Promise.all([
    (async function getTsConfigJson() {
      return await fs.existsFile(path.join(result.packageAbsDir, 'tsconfig.json'))
        ? jsoncParse(
          String((await exec(`tsc -p ${
            path.join(result
              .packageAbsDir, 'tsconfig.json')
          } --showConfig`))
            .stdout),
        ) as TsConfigJson
        : false;
    })(),
    (async function getPackageJson() {
      return await fs.existsFile(path.join(result.packageAbsDir, 'package.json'))
        ? (await pipedAsync(path.join(result
          .packageAbsDir, 'package.json'), fs.readFileU, JSON.parse)) as PackageJson
        : throws(
          `No package.json found at ${path.join(result.packageAbsDir, 'package.json')}`,
        );
    })(),
  ]);

  const potentialWorkspaceAbsDir: string | undefined = await findUp(
    async (potentialWorkspaceDir) => {
      if (!await fs.exists(path.join(potentialWorkspaceDir, 'package.json'))) {
        return;
      }
      if (
        packageJson.workspaces
        && !await fs.exists(path.join(potentialWorkspaceDir, 'pnpm-workspace.yaml'))
      ) {
        return;
      }
      return potentialWorkspaceDir;
    },
    {
      cwd: fileOrFolderInPkgAbsPathObj.currentAbsDir,
      stopAt: homedir(),
      type: 'directory',
    },
  );

  const resultWWorkspaceWTsConfigJson:
    & typeof result
    & Pick<PackageInfo,
      'tsconfigJson' | 'packageJson' | 'isInWorkspace' | 'workspaceAbsDir'> =
      potentialWorkspaceAbsDir
        ? {
          ...result,
          tsconfigJson,
          packageJson,
          isInWorkspace: true,
          workspaceAbsDir: potentialWorkspaceAbsDir,
        }
        : {
          ...result,
          tsconfigJson,
          packageJson,
          isInWorkspace: false,
          workspaceAbsDir: result.packageAbsDir,
        };
  l.debug`resultWWorkspaceWTsConfigJson ${resultWWorkspaceWTsConfigJson}`;

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
  ] = await // TODO: Change mapParallelAsync here to my own map
  mapIterableAsync(
    async (base: string) =>
      await fs.exists(path.join(resultWWorkspaceWTsConfigJson.workspaceAbsDir, base)),
    [
      'pnpm-lock.yaml',
      'bun.lock',
      'yarn.lock',
      'package-json.lock',
      '.pnp.cjs',
      path.join('node_modules', '.pnpm'),
      path.join('node_modules', '.store'),
    ],
  );

  if (bunLockExists) {
    return {
      ...resultWWorkspaceWTsConfigJson,
      packageManager: 'bun',
      pe: 'bun run',
      pr: 'bun run',
      nodeLinker: 'hoisted',
      runtime: 'bun',

      // Probably wrong here.
      runtimeArgs: process.execArgv,
    };
  }

  if (packageLockExists) {
    return {
      ...resultWWorkspaceWTsConfigJson,
      packageManager: 'npm',
      pe: 'npm exec --',
      pr: 'npm run',
      nodeLinker: 'hoisted',
      runtime: 'node',
      runtimeArgs: process.execArgv,
    };
  }

  if (nodeModulesPnpmExists) {
    return {
      ...resultWWorkspaceWTsConfigJson,
      packageManager: 'pnpm',
      pe: 'pnpm exec',
      pr: 'pnpm run',
      nodeLinker: 'isolated',
      runtime: 'node',
      runtimeArgs: process.execArgv,
    };
  }

  if (nodeModulesYarnExists) {
    return {
      ...resultWWorkspaceWTsConfigJson,
      packageManager: 'yarn',
      pe: 'yarn run -T -B',
      pr: 'yarn run',
      nodeLinker: 'isolated',
      runtime: 'yarn node',
      runtimeArgs: process.execArgv,
    };
  }

  if (pnpExists) {
    const resultWLinker = {
      ...resultWWorkspaceWTsConfigJson,
      nodeLinker: 'pnp',
    } as const;
    if (pnpmLockExists) {
      return {
        ...resultWLinker,
        packageManager: 'pnpm',
        pe: 'pnpm exec',
        pr: 'pnpm run',
        runtime: 'node',
        runtimeArgs: process.execArgv,
      };
    }
    if (yarnLockExists) {
      return {
        ...resultWLinker,
        packageManager: 'yarn',
        pe: 'yarn run -T -B',
        pr: 'yarn run',
        runtime: 'yarn node',
        runtimeArgs: process.execArgv,
      };
    }
    throw new Error(
      `unable to determine package manager at ${fileOrFolderInPkgAbsPath} of workspace ${resultWLinker.workspaceAbsDir}, .pnp.cjs exists but neither pnpm-lock.yaml nor yarn.lock exists.`,
    );
  }

  if (pnpmLockExists) {
    return {
      ...resultWWorkspaceWTsConfigJson,
      packageManager: 'pnpm',
      nodeLinker: 'hoisted',
      pe: 'pnpm exec',
      pr: 'pnpm run',
      runtime: 'node',
      runtimeArgs: process.execArgv,
    };
  }

  if (yarnLockExists) {
    return {
      ...resultWWorkspaceWTsConfigJson,
      packageManager: 'yarn',
      nodeLinker: 'hoisted',
      pe: 'yarn run -T -B',
      pr: 'yarn run',
      runtime: 'yarn node',
      runtimeArgs: process.execArgv,
    };
  }

  throw new Error(
    `unable to determine package manager
    at ${fileOrFolderInPkgAbsPath} of workspace ${resultWWorkspaceWTsConfigJson},
    none of
    pnpm-lock.yaml, bun.lock, yarn.lock, package-json.lock, .pnp.cjs, node_modules/.pnpm, node_modules/.yarn
    exists.`,
  );

  /* If there's .pnpm folder in node_modules, we know for sure pnpm installed it and the node linker is isolated. */

  /* If any package manager specific configuration file or configuration is found, we use that package manager.
   Not making this a first check since the configuration file may just be placed there but unused. */
}

export const packageInfo: typeof packageInfoFn & PackageInfo = Object.assign(
  packageInfoFn,
  await packageInfoFn(),
);
