import { getLogger } from '@logtape/logtape';
import $c from '@monochromatic-dev/module-child';
import {
  fs,
  path,
} from '@monochromatic-dev/module-fs-path';
import { notFalsyOrThrow } from '@monochromatic-dev/module-not-or-throw';
import pm from '@monochromatic-dev/module-pm';
import { parse as jsoncParse } from '@std/jsonc';
import { findUp } from 'find-up';
import { minimatch } from 'minimatch';
import { homedir } from 'node:os';
import { pipedAsync } from 'rambdax';

const l = getLogger(['m', 'resolve']);

/* We can roughly separate importing from a node module into four types:

   First off, we separate the node_module specifier into two types:

   1.  `@scope/name`

   2.  `name`

   Secondly, we separate the things after the node_module specifier into three types:

   1.  ``

       In this case, we look for the module/main/exports/exports`.` field in the module's package.json.

       No `/` is necessary for this case.

   2.  `css` or subcase (`css.css` or `css/css.css`) (ends with a file extension)

       In this case, we look for the exports`./css` or (exports`css.css`) field in the module's package.json.

       If not found, we go into the file system and find the file,
       but only if the subpath specifier looks like a file (ends with a file extension).
 */
export const packageIdentifierSplitter: {
  [Symbol.split]: (str: string) => [string, string];
} = {
  [Symbol.split](str: string): [string, string] {
    if (str.startsWith('@')) {
      const scopedSlashPos = str.indexOf('/');
      if (scopedSlashPos >= 2) {
        const terminatingSlashPos = str.indexOf('/', scopedSlashPos + 2);
        if (terminatingSlashPos === -1) {
          return [str, ''];
        }
        return [str.slice(0, terminatingSlashPos), str.slice(terminatingSlashPos + 1)];
      }
      throw new TypeError(
        `${str} is not a valid package identifier, scoped packages must contain a slash.`,
      );
    }
    const terminatingSlashPos = str.indexOf('/');
    if (terminatingSlashPos >= 1) {
      return [str.slice(0, terminatingSlashPos), str.slice(terminatingSlashPos + 1)];
    }
    return [str, ''];
  },
};

export const packageFilePath = async (
  potentialPackageWithIdentifier: string,
  pkgJsonAbsPath: string,
  fromPm: Awaited<ReturnType<typeof pm>> = pm,
): Promise<string> => {
  l
    .debug`packageFilePath potentialPackageWithIdentifier ${potentialPackageWithIdentifier} pkgJsonAbsPath ${pkgJsonAbsPath} fromPm ${fromPm}`;
  const [pkg, identifier] = potentialPackageWithIdentifier.split(
    packageIdentifierSplitter,
  );

  let pkgPath: string;

  // For pnpm, commands for getting abs target pkg path is the same no matter which node linker it uses.
  if (fromPm.packageManager === 'pnpm') {
    const filteredPkgJson = JSON
      .parse((await $c(`pnpm list --json ${pkg}`)).stdout as string)[0];
    pkgPath = filteredPkgJson?.dependencies?.[pkg!].path
      || filteredPkgJson.devDependencies?.[pkg!].path;
  } else if (['hoisted', 'isolated'].includes(fromPm.nodeLinker)) {
    pkgPath = (await findUp(async (potentialMatchingNodeModuleAbsDir) => {
      const hasPkg = await fs.exists(path.join(potentialMatchingNodeModuleAbsDir, pkg!));
      if (hasPkg) return path.join(potentialMatchingNodeModuleAbsDir, pkg!);
      return undefined;
    }, {
      cwd: path.join(pkgJsonAbsPath, 'node_modules'),
      stopAt: homedir(),
      type: 'directory',
    }))!;
  } else if (fromPm.nodeLinker === 'pnp') {
    const yarnInfo = await pipedAsync(
      await $c(`yarn info --json --cache ${pkg}`),
      (yarnInfoProcessOutput) => yarnInfoProcessOutput.stdout as string,
      JSON.parse,
    );

    if (yarnInfo.value.includes('@workspace:')) {
      const pkgPathRelWorkspace = yarnInfo.value.split('@workspace:').at(-1);
      pkgPath = path.join(fromPm.workspaceAbsDir, pkgPathRelWorkspace);
    } else {
      const pkgZipAbsPathObj = await pipedAsync(
        await $c(`yarn info --json --cache ${pkg}`),
        (yarnInfoProcessOutput) => yarnInfoProcessOutput.stdout as string,
        JSON.parse,
        (yarnInfo) => yarnInfo.children.Cache.Path,
        async (pkgZipAbsPath) => await path.parseFs(pkgZipAbsPath),
      );
      const pkgPathWoNmWoPkg = path.join(pkgZipAbsPathObj.absDir, pkgZipAbsPathObj.name);
      if (!(await fs.exists(pkgPathWoNmWoPkg))) {
        await $c(`unzip ${pkgZipAbsPathObj.absPath} -d ${pkgPathWoNmWoPkg}`);
      }
      pkgPath = path.join(pkgPathWoNmWoPkg, 'node_modules', pkg!);
    }
  } else {
    throw new Error(
      `unknown packageManager ${fromPm.packageManager} or nodeLinker ${fromPm.nodeLinker} for ${pkgJsonAbsPath} while resolving ${potentialPackageWithIdentifier}`,
    );
  }
  l.debug`packageFilePath pkgPath ${pkgPath}`;

  const pkgJson: {
    main?: string;
    module?: string;
    exports?: { [subpath: string]: string | { import?: string; default: string; }; };
  } = JSON.parse(await fs.readFileU(path.join(pkgPath, 'package.json')));

  if (identifier) {
    if (pkgJson.exports) {
      const matchingExport = pkgJson.exports[identifier];
      if (matchingExport) {
        if (typeof matchingExport === 'string') {
          return path.join(pkgPath, matchingExport);
        }
        if (matchingExport.import) {
          return path.join(pkgPath, matchingExport.import);
        }
        return path.join(pkgPath, matchingExport.default);
      }
      const matchingDotSlashExport = pkgJson.exports[`./${identifier}`];
      if (matchingDotSlashExport) {
        if (typeof matchingDotSlashExport === 'string') {
          return path.join(pkgPath, matchingDotSlashExport);
        }
        if (matchingDotSlashExport.import) {
          return path.join(pkgPath, matchingDotSlashExport.import);
        }
        return path.join(pkgPath, matchingDotSlashExport.default);
      }
    }
    l
      .info`could not find matching exporter in package ${pkgPath}, for ${pkg}/${identifier},
      tried exports[${identifier}], exports[./${identifier}] *  , import, default,
      trying resolving identifier as speficier with pkgPath/package.json as from`;
    return await resolve(identifier, `${pkgPath}/package.json`);
  }

  if (pkgJson.exports) {
    const matchingExport = pkgJson.exports['.'];
    if (matchingExport) {
      if (typeof matchingExport === 'string') {
        return path.join(pkgPath, matchingExport);
      }
      if (matchingExport.import) {
        return path.join(pkgPath, matchingExport.import);
      }
      return path.join(pkgPath, matchingExport.default);
    }
    const matchingDotSlashExport = pkgJson.exports['./'];
    if (matchingDotSlashExport) {
      if (typeof matchingDotSlashExport === 'string') {
        return path.join(pkgPath, matchingDotSlashExport);
      }
      if (matchingDotSlashExport.import) {
        return path.join(pkgPath, matchingDotSlashExport.import);
      }
      return path.join(pkgPath, matchingDotSlashExport.default);
    }
  }
  if (pkgJson.module) {
    return path.join(pkgPath, pkgJson.module);
  }
  if (pkgJson.main) {
    return path.join(pkgPath, pkgJson.main);
  }
  throw new Error(
    `could not find matching exporter in package ${pkgPath}, for ${pkg}, tried (exports['.'], exports['./'] *  , import, default), module, main`,
  );
};

// Stolen from https://stackoverflow.com/a/75477650 by https://stackoverflow.com/users/1655245/arik with CC BY-SA 4.0
export const prefixOf = (...strs: [string, ...string[]]): string => {
  const sorted = strs.toSorted() as [string, ...string[]];
  return Array
    // converts shortest word to an array of chars
    .from(sorted[0])
    // replaces non-matching chars with NULL char
    .map((char, i) => (sorted.at(-1)![i] === char ? char : '\0'))
    // converts back to a string
    .join('')
    // splits the string by NULL characters
    .split('\0')
    // returns the first part
    .at(0)!;
};

export const tsconfigAliasedPath = async (
  potentialTsconfigAlias: string,
  from: string = path.resolve(),
  pkgJsonAbsPath: string = '',
): Promise<string> => {
  const pkgJsonAbsPathLocal = pkgJsonAbsPath
    || (await path.parseFs(
      (await findUp('package.json', { cwd: (await path.parseFs(from)).dir }))!,
    ))
      .dir;

  // TODO: Support baseUrl
  // TODO: Check fix of reading tsconfig.json
  const tsconfig: {
    compilerOptions?: {
      baseUrl?: string;
      paths?: { [alias: string]: [string, ...string[]]; };
    };
  } = await pipedAsync(
    path.join(pkgJsonAbsPathLocal, 'tsconfig.json'),
    async (tsconfigAbsPath) =>
      (await $c(`tsc -p ${tsconfigAbsPath} --showConfig`)).stdout,
    String,
    jsoncParse,
    // TODO: Should not need the extra as if I create a function notObjOrThrow
    notFalsyOrThrow,
  ) as {
    compilerOptions?: {
      baseUrl?: string;
      paths?: { [alias: string]: [string, ...string[]]; };
    };
  };

  if (!tsconfig.compilerOptions) {
    throw new RangeError(`compilerOptions not found in ${tsconfig}`);
  }

  if (!tsconfig.compilerOptions.paths) {
    throw new RangeError(`compilerOptions.paths not found in ${tsconfig}`);
  }

  const matchingAlias = Object.keys(tsconfig.compilerOptions.paths).find((alias) =>
    minimatch(potentialTsconfigAlias, alias.replaceAll(/(?<!\*)\*(?!\*)/g, '**'))
  );
  if (!matchingAlias) {
    throw new RangeError(
      `${matchingAlias} not found in ${
        JSON.stringify(tsconfig.compilerOptions.paths)
      } for ${potentialTsconfigAlias}`,
    );
  }

  // TODO: Support cases when the glob isn't just ending with *
  const aliasStarting = prefixOf(potentialTsconfigAlias, matchingAlias);
  const aliasSub = matchingAlias.replace(aliasStarting, '');
  const specifierSub = potentialTsconfigAlias.replace(aliasStarting, '');
  const matchingAliased = tsconfig.compilerOptions.paths[matchingAlias]!;

  const baseUrl = tsconfig.compilerOptions.baseUrl;
  if (baseUrl) {
    for (const aliased of matchingAliased) {
      const aliasedPath = path.join(
        pkgJsonAbsPathLocal,
        baseUrl,
        aliased.replace(aliasSub, specifierSub),
      );
      try {
        await fs.accessM(aliasedPath);
        return aliasedPath;
      } catch {}
    }
    throw new RangeError(
      `No existing ${baseUrl} ${aliasSub} -> ${specifierSub}, tried ${matchingAliased}`,
    );
  }

  for (const aliased of matchingAliased) {
    const aliasedPath = path.join(
      pkgJsonAbsPathLocal,
      aliased.replace(aliasSub, specifierSub),
    );
    try {
      await fs.accessM(aliasedPath);
      return aliasedPath;
    } catch {}
  }
  throw new RangeError(
    `No existing ${aliasSub} -> ${specifierSub}, tried ${matchingAliased}`,
  );
};

export const importsPath = async (
  potentialImportsSpecifier: string,
  from: string = path.resolve(),
): Promise<string> => {
  const pkgJson: {
    imports: {
      [importsSpecifier: string]: string | { import?: string; default: string; };
    };
  } = await pipedAsync(
    path.relative(
      (await path.parseFs(from)).dir,
      (await findUp('package.json', {
        cwd: (await path.parseFs(from)).dir,
      }))!,
    ),
    async (packageJsonPath) => await fs.readFileU(packageJsonPath),
    (packageJsonContent) => JSON.parse(packageJsonContent),
  );

  // TODO: Support globs. priority:low
  const matchingImport = pkgJson.imports[potentialImportsSpecifier];
  if (!matchingImport) {
    throw new RangeError(
      `no matching import found in ${pkgJson.imports} by ${potentialImportsSpecifier} from ${from}`,
    );
  }
  if (typeof matchingImport === 'string') {
    return await resolve(matchingImport, from);
  }
  if (matchingImport.import) {
    return await resolve(matchingImport.import, from);
  }
  return await resolve(matchingImport.default, from);
};

export default async function resolve(
  specifier: string,
  // Must be the abs path of the **file** importing the module.
  from: string = path.resolve(),
): Promise<string> {
  /* WONTFIX: Support resolving implicit file extensions.
     See https://esbuild.github.io/api/#resolve-extensions for what this is. */

  // WONTFIX: Support CJS modules.

  // TODO: We should probably run ESBuild's more performant internal resolution algorithm first
  //       and only do our own when that fails.

  // FIXME: Investigate why it fails
  //        when resolving a packages installed at the top of workspace with Bun.
  //        Okay, I have a suspicion. Probably because we still have Yarn related files at workspace root.
  //        I should go to module/pm and throw an error when multiple package managers could be inferred.
  //        For now I'll delete Yarn related files.

  if (!path.isAbsolute(from)) {
    l.info`Relative path ${from} passed in parameter from, converted to absolute path ${
      path.resolve(from)
    }`;
  }

  const absFrom = path.isAbsolute(from) ? from : path.resolve(from);

  if (specifier.startsWith('#')) {
    return await importsPath(specifier, absFrom);
  }

  const pkgJsonAbsPath = (await path.parseFs(
    (await findUp('package.json', { cwd: (await path.parseFs(from)).currentAbsDir }))!,
  ))
    .dir;

  if (specifier.startsWith('/')) {
    return path.join(pkgJsonAbsPath, specifier.slice('/'.length));
  }

  if (specifier.startsWith('@/')) {
    return path.join(pkgJsonAbsPath, specifier.slice('@/'.length));
  }

  const file = path.join(absFrom, '..', specifier);

  for (
    const implicitFileExtension of [
      '',
      '.mts',
      '.ts',
      '.mjs',
      '.js',
      '.json',
      '/index.mts',
      '/index.ts',
      '/index.mjs',
      '/index.js',
      '/index.json',
    ]
  ) {
    const fileAbsPath = await fs.existsFile(`${file}${implicitFileExtension}`);
    if (fileAbsPath) {
      return String(fileAbsPath);
    }
  }
  l.debug`no file found`;

  try {
    return await tsconfigAliasedPath(specifier, absFrom, pkgJsonAbsPath);
  } catch (e) {
    l.debug`no tsconfig aliased path found ${e}`;
  }

  return await packageFilePath(specifier, pkgJsonAbsPath);
}
