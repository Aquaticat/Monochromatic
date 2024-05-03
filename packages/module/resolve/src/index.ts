import c from '@monochromatic.dev/module-console';
import {
  fs,
  path,
} from '@monochromatic.dev/module-fs-path';
import { findUp } from 'find-up';
import JSONC from 'jsonc-simple-parser';
import { minimatch } from 'minimatch';
import { pipedAsync } from 'rambdax';
import { $ } from 'zx';

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
export const packageIdentifierSplitter = {
  [Symbol.split](str: string): [string, string] {
    if (str.startsWith('@')) {
      const scopedSlashPos = str.indexOf('/');
      if (scopedSlashPos >= 2) {
        const terminatingSlashPos = str.indexOf('/', scopedSlashPos + 2);
        if (terminatingSlashPos === -1) {
          return [str, ''];
        }
        return [str.slice(0, terminatingSlashPos), str.slice(terminatingSlashPos)];
      }
      throw new TypeError(`${str} is not a valid package identifier, scoped packages must contain a slash.`);
    }
    const terminatingSlashPos = str.indexOf('/');
    if (terminatingSlashPos >= 1) {
      return [str.slice(0, terminatingSlashPos), str.slice(terminatingSlashPos)];
    }
    return [str, ''];
  },
};

export const packageFilePath = async (potentialPackageWithIdentifier: string): Promise<string> => {
  const [pkg, identifier] = potentialPackageWithIdentifier.split(packageIdentifierSplitter);

  // TODO: Make this not limited to pnpm.
  const filteredPkgJson = JSON.parse((await $`pnpm list --json ${pkg}`).stdout)[0];
  const pkgPath: string = filteredPkgJson?.dependencies?.[pkg!].path || filteredPkgJson.devDependencies?.[pkg!].path;

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
    throw new TypeError(
      `could not find matching exporter in package ${pkgPath}, for ${pkg}/${identifier}, tried exports[${identifier}], exports[./${identifier}] *  , import, default`,
    );
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
  throw new TypeError(
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
    || (await path.parseFs((await findUp('package.json', { cwd: (await path.parseFs(from)).dir }))!)).dir;

  // TODO: Support baseUrl
  const tsconfig: { compilerOptions?: { baseUrl?: string; paths?: { [alias: string]: [string, ...string[]]; }; }; } =
    await pipedAsync(
      await fs.readFileU(path.join(pkgJsonAbsPathLocal, 'tsconfig.json')),
      (tsconfigContent) => JSONC.parse(tsconfigContent),
    );

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
      `${matchingAlias} not found in ${JSON.stringify(tsconfig.compilerOptions.paths)} for ${potentialTsconfigAlias}`,
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
      const aliasedPath = path.join(pkgJsonAbsPathLocal, baseUrl, aliased.replace(aliasSub, specifierSub));
      try {
        await fs.accessM(aliasedPath);
        return aliasedPath;
      } catch {}
    }
    throw new RangeError(`No existing ${baseUrl} ${aliasSub} -> ${specifierSub}, tried ${matchingAliased}`);
  }

  for (const aliased of matchingAliased) {
    const aliasedPath = path.join(pkgJsonAbsPathLocal, aliased.replace(aliasSub, specifierSub));
    try {
      await fs.accessM(aliasedPath);
      return aliasedPath;
    } catch {}
  }
  throw new RangeError(`No existing ${aliasSub} -> ${specifierSub}, tried ${matchingAliased}`);
};

export const importsPath = async (
  potentialImportsSpecifier: string,
  from: string = path.resolve(),
): Promise<string> => {
  const pkgJson: { imports: { [importsSpecifier: string]: string | { import?: string; default: string; }; }; } =
    await pipedAsync(
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
    throw new RangeError(`no matching import found in ${pkgJson.imports} by ${potentialImportsSpecifier} from ${from}`);
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

  if (!path.isAbsolute(from)) {
    c.debug(`Relative path ${from} passed in parameter from, converted to absolute path ${path.resolve(from)}`);
  }

  const absFrom = path.isAbsolute(from) ? from : path.resolve(from);

  if (specifier.startsWith('#')) {
    return await importsPath(specifier, absFrom);
  }

  const pkgJsonAbsPath =
    (await path.parseFs((await findUp('package.json', { cwd: (await path.parseFs(from)).dir }))!)).dir;

  if (specifier.startsWith('/')) {
    return path.join(pkgJsonAbsPath, specifier.slice('/'.length));
  }

  if (specifier.startsWith('@/')) {
    return path.join(pkgJsonAbsPath, specifier.slice('@/'.length));
  }

  const file = path.join(absFrom, '..', specifier);
  try {
    await fs.accessM(file);
    return file;
  } catch (e) {
  }

  try {
    return await tsconfigAliasedPath(specifier, absFrom, pkgJsonAbsPath);
  } catch (e) {
  }

  return await packageFilePath(specifier);
}
