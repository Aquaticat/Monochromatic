/**
 * Syncs TypeScript project references across the monorepo.
 *
 * This script replaces moon's automatic TypeScript project reference syncing.
 * Moon automatically managed project references based on workspace dependencies,
 * but mise doesn't have this capability, so we need to do it manually.
 *
 * What this script does:
 * - Discovers all packages in the monorepo (packages/*\/*) - Reads each package's dependencies from package.json
 * - Updates tsconfig.json files with proper project references
 * - Respects special cases (like module/es which doesn't use project references)
 */

import {
  readdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

const WORKSPACE_ROOT = join(import.meta.dirname, '../../..',);
const PACKAGES_ROOT = join(WORKSPACE_ROOT, 'packages',);

/**
 * Package information extracted from package.json
 */
type PackageInfo = {
  /**
   * Package name from package.json
   */
  name: string;

  /**
   * Absolute path to the package directory
   */
  path: string;

  /**
   * Dependencies from package.json (both dependencies and devDependencies)
   */
  dependencies: Set<string>;

  /**
   * Whether this package should sync project references
   */
  shouldSync: boolean;
};

/**
 * Discovers all packages in the monorepo.
 */
async function discoverPackages(): Promise<PackageInfo[]> {
  const packages: PackageInfo[] = [];

  const categories = await readdir(PACKAGES_ROOT, { withFileTypes: true, },);

  for (const category of categories) {
    if (!category.isDirectory())
      continue;

    const categoryPath = join(PACKAGES_ROOT, category.name,);
    const packageDirs = await readdir(categoryPath, { withFileTypes: true, },);

    for (const packageDir of packageDirs) {
      if (!packageDir.isDirectory())
        continue;

      const packagePath = join(categoryPath, packageDir.name,);
      const packageJsonPath = join(packagePath, 'package.json',);

      try {
        const packageJsonContent = await readFile(packageJsonPath, 'utf-8',);
        const packageJson = JSON.parse(packageJsonContent,) as {
          name: string;
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
        };

        const dependencies = new Set<string>([
          ...Object.keys(packageJson.dependencies ?? {},),
          ...Object.keys(packageJson.devDependencies ?? {},),
        ],);

        // Check if this package should sync project references
        // module/es is special - it doesn't use project references
        const shouldSync = packageJson.name !== '@monochromatic-dev/module-es';

        packages.push({
          name: packageJson.name,
          path: packagePath,
          dependencies,
          shouldSync,
        },);
      }
      catch (error) {
        console.error(`Failed to read package.json for ${packagePath}:`, error,);
      }
    }
  }

  return packages;
}

/**
 * Builds a map of package names to their paths for quick lookup.
 */
function buildPackageMap(packages: PackageInfo[],): Map<string, string> {
  const packageMap = new Map<string, string>();

  for (const pkg of packages)
    packageMap.set(pkg.name, pkg.path,);

  return packageMap;
}

/**
 * Updates tsconfig.json with project references for a package.
 */
async function updateTsConfig(
  pkg: PackageInfo,
  packageMap: Map<string, string>,
): Promise<void> {
  if (!pkg.shouldSync) {
    console.log(`Skipping ${pkg.name} (project references disabled)`,);
    return;
  }

  const tsconfigPath = join(pkg.path, 'tsconfig.json',);

  try {
    const tsconfigContent = await readFile(tsconfigPath, 'utf-8',);
    const tsconfig = JSON.parse(tsconfigContent,) as {
      references?: Array<{ path: string; }>;
      [key: string]: unknown;
    };

    // Build new references based on dependencies
    const references: Array<{ path: string; }> = [];

    for (const dep of pkg.dependencies) {
      const depPath = packageMap.get(dep,);
      if (depPath) {
        // Calculate relative path from this package to the dependency
        const relativePath = getRelativePath(pkg.path, depPath,);
        references.push({ path: relativePath, },);
      }
    }

    // Sort references for consistent output
    references.sort((first, second,) => first.path.localeCompare(second.path,));

    // Only update if references have changed
    const existingRefs = JSON.stringify(tsconfig.references ?? [],);
    const newRefs = JSON.stringify(references,);

    if (existingRefs !== newRefs) {
      tsconfig.references = references;

      // Write back with proper formatting
      const newContent = JSON.stringify(tsconfig, null, 2,) + '\n';
      await writeFile(tsconfigPath, newContent, 'utf-8',);
      console.log(`Updated ${pkg.name}`,);
    }
    else {
      console.log(`No changes for ${pkg.name}`,);
    }
  }
  catch (error) {
    console.error(`Failed to update tsconfig.json for ${pkg.name}:`, error,);
  }
}

/**
 * Gets the relative path from one directory to another.
 */
function getRelativePath(from: string, to: string,): string {
  const fromParts = from.split(/[\\/]/u,);
  const toParts = to.split(/[\\/]/u,);

  // Find common base
  let commonLength = 0;
  const minLength = Math.min(fromParts.length, toParts.length,);

  for (let index = 0; index < minLength; index++) {
    if (fromParts[index] === toParts[index])
      commonLength++;
    else
      break;
  }

  // Build relative path
  const upLevels = fromParts.length - commonLength;
  const downPath = toParts.slice(commonLength,);

  const relativeParts = [
    ...Array.from({ length: upLevels, }, () => '..',),
    ...downPath,
  ];

  return relativeParts.join('/',);
}

/**
 * Main entry point.
 */
console.log('Syncing TypeScript project references...',);

const packages = await discoverPackages();
console.log(`Found ${packages.length} packages`,);

const packageMap = buildPackageMap(packages,);

for (const pkg of packages)
  await updateTsConfig(pkg, packageMap,);

console.log('Done!',);
