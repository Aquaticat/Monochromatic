/**
 * Resolved TypeScript symbol provenance for intrinsic effect catalog lookups.
 *
 * @module
 */

import { readFileSync, } from 'node:fs';
import { basename, } from 'node:path';

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type {
  Project,
  Symbol as TypeScriptSymbol,
  Type,
} from 'typescript/unstable/sync';

import type {
  IntrinsicEffectQuery,
  IntrinsicProvenance,
} from './intrinsic-effect-catalog.ts';

/**
 * Package logger for provenance resolution failures.
 */
const l = tagged({ tag: 'intrinsic-effect-query', },);

/**
 * Sentinel for declarations outside audited provenance classes.
 */
export const NO_INTRINSIC_PROVENANCE: unique symbol = Symbol('no IntrinsicProvenance for declaration source',);

/**
 * Sentinel for callable symbols that cannot form exact intrinsic query.
 */
export const NO_INTRINSIC_QUERY: unique symbol = Symbol('no IntrinsicEffectQuery for resolved callable',);

/**
 * Parsed package identity from declaration path.
 */
type PackageIdentity = {
  readonly packageName: string;
  readonly major: number;
};

/**
 * Sentinel when declaration path has no readable package identity.
 */
const NO_PACKAGE_IDENTITY: unique symbol = Symbol('no PackageIdentity for declaration path',);

/**
 * Parsed package identities cached by package root.
 */
const packageIdentityByRoot = new Map<string, PackageIdentity | typeof NO_PACKAGE_IDENTITY>();

/**
 * Narrows parsed package metadata to required fields.
 *
 * @param value - JSON value from package manifest.
 *
 * @returns whether value has string name and version.
 */
function hasPackageIdentityFields(value: unknown,): value is {
  readonly name: string;
  readonly version: string;
} {
  if (((typeof value) !== 'object') || (value === null))
    return false;
  return ('name' in value)
    && ((typeof value.name) === 'string')
    && ('version' in value)
    && ((typeof value.version) === 'string');
}

/**
 * Locates package root and name from final `node_modules` segment.
 *
 * @param fileName - Declaration source path.
 *
 * @returns package root plus package name or sentinel.
 */
function packageRootAndName(fileName: string,): {
  readonly packageRoot: string;
  readonly packageName: string;
} | typeof NO_PACKAGE_IDENTITY {
  /**
   * Portable separators normalized for segment scanning.
   */
  const normalized = fileName.replaceAll(
    '\\',
    '/',
  );
  /**
   * Final package boundary handles pnpm virtual stores and flat installs.
   */
  const marker = '/node_modules/';
  /**
   * Offset of final installed-package boundary.
   */
  const markerIndex = normalized.lastIndexOf(marker,);
  if (markerIndex === (-1))
    return NO_PACKAGE_IDENTITY;
  /**
   * Path beginning with package name after final boundary.
   */
  const packagePath = normalized.slice(markerIndex + marker.length,);
  /**
   * Package path segments used for scoped-name reconstruction.
   */
  const segments = packagePath.split('/',);
  /**
   * First package segment and optional scoped-name suffix.
   */
  const [firstSegment, secondSegment,] = segments;
  if ((firstSegment === undefined) || (firstSegment.length === 0))
    return NO_PACKAGE_IDENTITY;
  /**
   * Package name candidate initialized to unscoped first segment.
   */
  const packageNameResult: { value: string | typeof NO_PACKAGE_IDENTITY; } = {
    value: firstSegment,
  };
  if (firstSegment.startsWith('@',)) {
    packageNameResult.value = secondSegment === undefined
      ? NO_PACKAGE_IDENTITY
      : `${firstSegment}/${secondSegment}`;
  }
  /**
   * Final package name or missing-identity sentinel.
   */
  const packageName = packageNameResult.value;
  if (packageName === NO_PACKAGE_IDENTITY)
    return NO_PACKAGE_IDENTITY;
  return {
    packageRoot: normalized.slice(
      0,
      markerIndex
        + marker.length
        + packageName.length,
    ),
    packageName,
  };
}

/* oxlint-disable no-restricted-syntax/no-sync -- Oxlint visitors and TypeScript synchronous API require synchronous package provenance lookup. */
/**
 * Reads exact package name and major for declaration source.
 *
 * @param fileName - Declaration file inside installed package.
 *
 * @returns package identity or sentinel when unavailable.
 */
function packageIdentity(fileName: string,): PackageIdentity | typeof NO_PACKAGE_IDENTITY {
  /**
   * Installed package root and name derived from declaration path.
   */
  const rootAndName = packageRootAndName(fileName,);
  if (rootAndName === NO_PACKAGE_IDENTITY)
    return NO_PACKAGE_IDENTITY;
  /**
   * Previously parsed package identity for package root.
   */
  const cached = packageIdentityByRoot.get(rootAndName.packageRoot,);
  if (cached !== undefined)
    return cached;

  /**
   * Function-tagged package metadata logger.
   */
  const rl = tagged({
    tag: packageIdentity.name,
    l,
  },);
  try {
    /**
     * Unknown package manifest JSON narrowed before field access.
     */
    const parsed: unknown = JSON.parse(readFileSync(
      `${rootAndName.packageRoot}/package.json`,
      'utf8',
    ),);
    if (!hasPackageIdentityFields(parsed,)) {
      packageIdentityByRoot.set(
        rootAndName.packageRoot,
        NO_PACKAGE_IDENTITY,
      );
      return NO_PACKAGE_IDENTITY;
    }
    /**
     * Major-version segment from package semantic version.
     */
    const [majorText,] = parsed.version
      .split('.',);
    if (majorText === undefined) {
      packageIdentityByRoot.set(
        rootAndName.packageRoot,
        NO_PACKAGE_IDENTITY,
      );
      return NO_PACKAGE_IDENTITY;
    }
    /**
     * Numeric package major used as strict effect gate.
     */
    const major = Math.trunc(Number(majorText,),);
    if (Number.isNaN(major,)) {
      packageIdentityByRoot.set(
        rootAndName.packageRoot,
        NO_PACKAGE_IDENTITY,
      );
      return NO_PACKAGE_IDENTITY;
    }
    /**
     * Audited package identity retained by root.
     */
    const identity = {
      packageName: parsed.name,
      major,
    };
    packageIdentityByRoot.set(
      rootAndName.packageRoot,
      identity,
    );
    return identity;
  }
  catch (error) {
    rl.debug(`could not read package identity for ${fileName}: ${String(error,)}`,);
    packageIdentityByRoot.set(
      rootAndName.packageRoot,
      NO_PACKAGE_IDENTITY,
    );
    return NO_PACKAGE_IDENTITY;
  }
}
/* oxlint-enable no-restricted-syntax/no-sync */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- Project mirrors TypeScript semantic API identity required for source classification. */
/**
 * Classifies declaration source as ECMAScript, DOM, Node, or package major.
 *
 * @param project - TypeScript project owning declaration source.
 *
 * @param fileName - Declaration source path.
 *
 * @returns intrinsic provenance or sentinel.
 *
 * @example
 * ```ts
 * const provenance = intrinsicProvenance({ project, fileName });
 * ```
 */
export function intrinsicProvenance({
  project,
  fileName,
}: {
  readonly project: Project;
  readonly fileName: string;
},): IntrinsicProvenance | typeof NO_INTRINSIC_PROVENANCE {
  /**
   * Declaration source loaded by semantic project when available.
   */
  const sourceFile = project
    .program
    .getSourceFile(fileName,);
  if (sourceFile !== undefined) {
    /**
     * Whether source belongs to compiler's bundled standard libraries.
     */
    const isDefaultLibrary = project
      .program
      .isSourceFileDefaultLibrary(sourceFile,);
    if (isDefaultLibrary) {
      /**
       * Default-library basename distinguishing host APIs from ECMAScript.
       */
      const fileBaseName = basename(fileName,);
      if (fileBaseName.startsWith('lib.dom.',)
        || fileBaseName.startsWith('lib.webworker.',))
        return { kind: 'dom', };
      return { kind: 'ecmascript', };
    }
  }
  /**
   * Installed package identity for non-default declaration source.
   */
  const identity = packageIdentity(fileName,);
  if (identity === NO_PACKAGE_IDENTITY)
    return NO_INTRINSIC_PROVENANCE;
  if (identity.packageName === '@types/node')
    return { kind: 'node', };
  return {
    kind: 'package',
    packageName: identity.packageName,
    major: identity.major,
  };
}
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- Type and Symbol mirror TypeScript semantic API identities required for exact matching. */
/**
 * Creates exact catalog query from receiver type and callable property symbol.
 *
 * @param project - TypeScript project owning semantic objects.
 *
 * @param receiverType - Resolved call receiver type.
 *
 * @param memberSymbol - Resolved callable member symbol.
 *
 * @returns exact query or sentinel when owner/provenance is unavailable.
 *
 * @example
 * ```ts
 * const query = intrinsicEffectQuery({ project, receiverType, memberSymbol });
 * ```
 */
export function intrinsicEffectQuery({
  project,
  receiverType,
  memberSymbol,
}: {
  readonly project: Project;
  readonly receiverType: Type;
  readonly memberSymbol: TypeScriptSymbol;
},): IntrinsicEffectQuery | typeof NO_INTRINSIC_QUERY {
  /**
   * Receiver owner symbol preserving declared API type identity.
   */
  const ownerSymbol = receiverType.getSymbol() ?? receiverType.getAliasSymbol();
  if (ownerSymbol === undefined)
    return NO_INTRINSIC_QUERY;
  /**
   * First exact declaration for callable member symbol.
   */
  const declarationHandle = memberSymbol
    .declarations
    .at(0,);
  if (declarationHandle === undefined)
    return NO_INTRINSIC_QUERY;
  /**
   * Resolved declaration node providing source provenance.
   */
  const declaration = declarationHandle.resolve(project,);
  if (declaration === undefined)
    return NO_INTRINSIC_QUERY;
  /**
   * Declaration provenance after source-file classification.
   */
  const provenance = intrinsicProvenance({
    project,
    fileName: declaration
      .getSourceFile()
      .fileName,
  },);
  if (provenance === NO_INTRINSIC_PROVENANCE)
    return NO_INTRINSIC_QUERY;
  return {
    provenance,
    ownerType: ownerSymbol.name,
    member: memberSymbol.name,
  };
}
/* oxlint-enable typescript/prefer-readonly-parameter-types */
