/**
 * Package export to shipped implementation resolution.
 *
 * @module
 */

import { existsSync, } from 'node:fs';
import {
  extname,
  join,
  resolve,
} from 'node:path';

import type {
  InstalledPackageIdentity,
} from './installed-package-identity.ts';
import { implementationAnalysisEvidence, } from './package-source-map-resolution.ts';

/**
 * Sentinel when package export has no inspectable implementation.
 */
export const PACKAGE_IMPLEMENTATION_UNAVAILABLE: unique symbol = Symbol(
  'package export implementation could not be resolved',
);

/**
 * Shipped package implementation selected for one export subpath.
 */
export type PackageImplementation = {
  readonly packageRoot: string;
  readonly packageName: string;
  readonly packageVersion: string;
  readonly exportKey: string;
  readonly implementationPath: string;
  readonly analysisPath: string;
  readonly implementationDigest: string;
};

/**
 * Runtime export conditions accepted by Node ESM analysis.
 */
const RUNTIME_CONDITIONS: ReadonlySet<string> = new Set([
  'import',
  'node',
  'default',
],);

/**
 * Supported inspectable implementation suffixes.
 */
const IMPLEMENTATION_SUFFIXES = [
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.mts',
  '.cts',
  '.jsx',
  '.tsx',
] as const;

/**
 * Supported implementation suffix membership.
 */
const IMPLEMENTATION_SUFFIX_SET: ReadonlySet<string> = new Set(
  IMPLEMENTATION_SUFFIXES,
);

/**
 * Tests whether unknown manifest field is property-bearing record.
 *
 * @param value - Manifest field.
 *
 * @returns whether string-keyed values can be inspected.
 */
function isRecord(value: unknown,): value is Readonly<Record<string, unknown>> {
  return ((typeof value) === 'object')
    && (value !== null)
    && (!Array.isArray(value,));
}

/**
 * Selects runtime path from package export target.
 *
 * @param target - Export target string,
 * condition map,
 * or fallback array.
 *
 * @returns runtime-relative target or unavailable sentinel.
 */
function runtimeTarget(
  target: unknown,
): string | typeof PACKAGE_IMPLEMENTATION_UNAVAILABLE {
  if ((typeof target) === 'string')
    return target;
  if (Array.isArray(target,)) {
    for (const candidate of target) {
      /**
       * First inspectable target selected in authored fallback order.
       */
      const selected = runtimeTarget(candidate,);
      if (selected !== PACKAGE_IMPLEMENTATION_UNAVAILABLE)
        return selected;
    }
    return PACKAGE_IMPLEMENTATION_UNAVAILABLE;
  }
  if (!isRecord(target,))
    return PACKAGE_IMPLEMENTATION_UNAVAILABLE;
  for (const [condition, nestedTarget,] of Object.entries(target,)) {
    if (!RUNTIME_CONDITIONS.has(condition,))
      continue;
    /**
     * Runtime target selected recursively under authored supported condition.
     */
    const selected = runtimeTarget(nestedTarget,);
    if (selected !== PACKAGE_IMPLEMENTATION_UNAVAILABLE)
      return selected;
  }
  return PACKAGE_IMPLEMENTATION_UNAVAILABLE;
}

/**
 * Selects declaration target from package export conditions.
 *
 * @param target - Export target condition map or fallback array.
 *
 * @returns declaration-relative target or unavailable sentinel.
 */
function declarationTarget(
  target: unknown,
): string | typeof PACKAGE_IMPLEMENTATION_UNAVAILABLE {
  if (Array.isArray(target,)) {
    for (const candidate of target) {
      /**
       * First declaration target in authored fallback order.
       */
      const selected = declarationTarget(candidate,);
      if (selected !== PACKAGE_IMPLEMENTATION_UNAVAILABLE)
        return selected;
    }
    return PACKAGE_IMPLEMENTATION_UNAVAILABLE;
  }
  if ((!isRecord(target,)) || (!('types' in target)))
    return PACKAGE_IMPLEMENTATION_UNAVAILABLE;
  return runtimeTarget(target.types,);
}

/**
 * Computes package export key from exact module specifier.
 *
 * @param packageName - Exact package manifest name.
 *
 * @param moduleSpecifier - Authored import module specifier.
 *
 * @returns package export key or unavailable sentinel.
 */
function packageExportKey({
  packageName,
  moduleSpecifier,
}: {
  readonly packageName: string;
  readonly moduleSpecifier: string;
}): string | typeof PACKAGE_IMPLEMENTATION_UNAVAILABLE {
  if (moduleSpecifier === packageName)
    return '.';
  /**
   * Prefix for package subpath imports.
   */
  const prefix = `${packageName}/`;
  return moduleSpecifier.startsWith(prefix,)
    ? `./${moduleSpecifier.slice(prefix.length,)}`
    : PACKAGE_IMPLEMENTATION_UNAVAILABLE;
}

/**
 * Resolves runtime target from package exports or root legacy fields.
 *
 * @param identity - Exact package manifest identity.
 *
 * @param exportKey - Requested package export key.
 *
 * @returns package-relative runtime target or unavailable sentinel.
 */
function manifestRuntimeTarget({
  identity,
  exportKey,
}: {
  readonly identity: InstalledPackageIdentity;
  readonly exportKey: string;
}): string | typeof PACKAGE_IMPLEMENTATION_UNAVAILABLE {
  /**
   * Authored package exports field.
   */
  const exportsField = identity.manifest
    .exports;
  if (exportsField !== undefined) {
    if ((exportKey === '.') && (!isRecord(exportsField,)))
      return runtimeTarget(exportsField,);
    if (isRecord(exportsField,)) {
      /**
       * Whether exports object uses explicit subpath keys.
       */
      const hasSubpathKeys = Object.keys(exportsField,)
        .some(function subpathKey(key,): boolean {
          return key.startsWith('.',);
        },);
      if (hasSubpathKeys)
        return runtimeTarget(exportsField[exportKey],);
      if (exportKey === '.')
        return runtimeTarget(exportsField,);
    }
    return PACKAGE_IMPLEMENTATION_UNAVAILABLE;
  }
  if (exportKey !== '.')
    return PACKAGE_IMPLEMENTATION_UNAVAILABLE;
  /**
   * Legacy ESM entry before CommonJS main fallback.
   */
  const legacyEntry = (typeof identity.manifest
    .module) === 'string'
    ? identity.manifest
      .module
    : identity.manifest
      .main;
  return (typeof legacyEntry) === 'string'
    ? legacyEntry
    : PACKAGE_IMPLEMENTATION_UNAVAILABLE;
}

/**
 * Resolves target file with explicit supported suffix fallback.
 *
 * @param packageRoot - Exact package root.
 *
 * @param relativeTarget - Manifest runtime target.
 *
 * @returns existing implementation path or unavailable sentinel.
 */
function implementationPath({
  packageRoot,
  relativeTarget,
}: {
  readonly packageRoot: string;
  readonly relativeTarget: string;
}): string | typeof PACKAGE_IMPLEMENTATION_UNAVAILABLE {
  /**
   * Absolute target normalized from package root.
   */
  const target = resolve(
    packageRoot,
    relativeTarget,
  );
  if ((!target.startsWith(`${packageRoot}/`,)) && (target !== packageRoot))
    return PACKAGE_IMPLEMENTATION_UNAVAILABLE;
  /**
   * Exact target followed by supported extension and directory-index fallbacks.
   */
  const candidates = [
    target,
    ...IMPLEMENTATION_SUFFIXES.map(function extensionCandidate(suffix,): string {
      return `${target}${suffix}`;
    },),
    ...IMPLEMENTATION_SUFFIXES.map(function indexCandidate(suffix,): string {
      return join(
        target,
        `index${suffix}`,
      );
    },),
  ];
  for (const candidate of candidates) {
    /* oxlint-disable no-restricted-syntax/no-sync -- Synchronous semantic visitor confirms shipped implementation before analysis. */
    if ((extname(candidate,) !== '')
      && IMPLEMENTATION_SUFFIX_SET.has(extname(candidate,))
      && existsSync(candidate,))
      return candidate;
    /* oxlint-enable no-restricted-syntax/no-sync */
  }
  return PACKAGE_IMPLEMENTATION_UNAVAILABLE;
}

/**
 * Resolves declaration file to authored package module specifier.
 *
 * @param identity - Exact package manifest identity.
 *
 * @param declarationFileName - Selected declaration source path.
 *
 * @returns package module specifier or unavailable sentinel.
 *
 * @example
 * ```ts
 * packageModuleSpecifierForDeclaration({ identity, declarationFileName });
 * ```
 */
export function packageModuleSpecifierForDeclaration({
  identity,
  declarationFileName,
}: {
  readonly identity: InstalledPackageIdentity;
  readonly declarationFileName: string;
}): string | typeof PACKAGE_IMPLEMENTATION_UNAVAILABLE {
  /**
   * Declaration path normalized for exact target comparison.
   */
  const declarationPath = resolve(declarationFileName,);
  /**
   * Package exports field containing declaration conditions.
   */
  const exportsField = identity.manifest
    .exports;
  if (isRecord(exportsField,)) {
    /**
     * Explicit subpath entries or root condition map.
     */
    const entries: readonly (readonly [
      string,
      unknown
    ])[] = Object.keys(exportsField,)
      .some(function subpathKey(key,): boolean {
        return key.startsWith('.',);
      },)
      ? Object.entries(exportsField,)
      : [[
        '.',
        exportsField,
      ],];
    for (const [exportKey, target,] of entries) {
      /**
       * Declaration target selected from current export entry.
       */
      const relativeTarget = declarationTarget(target,);
      if ((relativeTarget !== PACKAGE_IMPLEMENTATION_UNAVAILABLE)
        && (resolve(
          identity.root,
          relativeTarget,
        ) === declarationPath)) {
        return exportKey === '.'
          ? identity.name
          : `${identity.name}/${exportKey.slice(2,)}`;
      }
    }
  }
  if (((typeof identity.manifest
    .types) === 'string')
    && (resolve(
      identity.root,
      identity.manifest
        .types,
    ) === declarationPath))
    return identity.name;
  if (((typeof identity.manifest
    .typings) === 'string')
    && (resolve(
      identity.root,
      identity.manifest
        .typings,
    ) === declarationPath))
    return identity.name;
  return PACKAGE_IMPLEMENTATION_UNAVAILABLE;
}

/**
 * Resolves exact module export to shipped inspectable implementation.
 *
 * @param identity - Exact package identity from declaration provenance.
 *
 * @param moduleSpecifier - Authored package import specifier.
 *
 * @returns shipped implementation identity or unavailable sentinel.
 *
 * @example
 * ```ts
 * resolvePackageImplementation({ identity, moduleSpecifier: 'pkg/subpath' });
 * ```
 */
export function resolvePackageImplementation({
  identity,
  moduleSpecifier,
}: {
  readonly identity: InstalledPackageIdentity;
  readonly moduleSpecifier: string;
}): PackageImplementation | typeof PACKAGE_IMPLEMENTATION_UNAVAILABLE {
  /**
   * Requested package export key.
   */
  const exportKey = packageExportKey({
    packageName: identity.name,
    moduleSpecifier,
  },);
  if (exportKey === PACKAGE_IMPLEMENTATION_UNAVAILABLE)
    return PACKAGE_IMPLEMENTATION_UNAVAILABLE;
  /**
   * Runtime target selected from exact package export.
   */
  const relativeTarget = manifestRuntimeTarget({
    identity,
    exportKey,
  },);
  if (relativeTarget === PACKAGE_IMPLEMENTATION_UNAVAILABLE)
    return PACKAGE_IMPLEMENTATION_UNAVAILABLE;
  /**
   * Existing shipped implementation path.
   */
  const path = implementationPath({
    packageRoot: identity.root,
    relativeTarget,
  },);
  if (path === PACKAGE_IMPLEMENTATION_UNAVAILABLE)
    return PACKAGE_IMPLEMENTATION_UNAVAILABLE;
  /**
   * Runtime and source-map evidence selecting analysis source.
   */
  const evidence = implementationAnalysisEvidence({
    packageRoot: identity.root,
    implementationPath: path,
  },);
  return {
    packageRoot: identity.root,
    packageName: identity.name,
    packageVersion: identity.version,
    exportKey,
    implementationPath: path,
    analysisPath: evidence.analysisPath,
    implementationDigest: evidence.digest,
  };
}
