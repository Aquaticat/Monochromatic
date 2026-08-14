import { existsSync, } from 'node:fs';
import {
  dirname,
  join,
  relative,
  sep,
} from 'node:path';

import type { Node, } from 'typescript/unstable/ast';
import {
  isClassDeclaration,
  isFunctionLikeDeclaration,
  isIdentifier,
  isInterfaceDeclaration,
  isTypeAliasDeclaration,
} from 'typescript/unstable/ast/is';
import type { Project, } from 'typescript/unstable/sync';

import { ancestorDirectories, } from './ancestor-directories.ts';
import { isWorkspaceSourceFileName, } from './workspace-source-path.ts';

/**
 * Workspace marker used to shorten producer locations.
 */
const WORKSPACE_MARKER = 'pnpm-workspace.yaml';

/**
 * Display roots already found for configured projects.
 */
const displayRootsByConfig = new Map<string, string>();

/**
 * Eager immutable description of one editable semantic type origin.
 */
export type ReadonlyTypeOrigin = {
  readonly kind: 'callable' | 'type' | 'expression';
  readonly name?: string;
  readonly location: string;
};

/**
 * Finds repository display root for configured project.
 *
 * @param configFileName - Configured TypeScript project path.
 *
 * @returns nearest pnpm workspace root or configured-project directory.
 *
 * @example
 * ```ts
 * displayRoot('/repo/package/module/example/tsconfig.json');
 * ```
 */
function displayRoot(configFileName: string,): string {
  const cached = displayRootsByConfig.get(configFileName,);
  if (cached !== undefined)
    return cached;
  /**
   * Package-local fallback when consumer has no pnpm workspace marker.
   */
  const fallback = dirname(configFileName,);
  /**
   * Root selected from nearest workspace marker.
   */
  const selected = { value: fallback, };
  for (const directory of ancestorDirectories(fallback,)) {
    /**
     * Marker candidate under current ancestor.
     */
    const marker = join(
      directory,
      WORKSPACE_MARKER,
    );
    // oxlint-disable-next-line no-restricted-syntax/no-sync -- Synchronous rule resolves one cached display root before emitting source guidance.
    if (existsSync(marker,)) {
      selected.value = directory;
      break;
    }
  }
  displayRootsByConfig.set(
    configFileName,
    selected.value,
  );
  return selected.value;
}

/**
 * Normalizes declaration to reader-facing producer boundary.
 *
 * @param declaration - Semantic type declaration.
 *
 * @returns nearest callable or named type owner,
 * otherwise original declaration.
 *
 * @example
 * ```ts
 * originOwner(objectLiteral);
 * ```
 */
function originOwner(declaration: Node,): Node {
  /**
   * Ancestor cursor beginning at semantic declaration.
   */
  const cursor = { current: declaration, };
  while (cursor.current.parent !== undefined) {
    if (isFunctionLikeDeclaration(cursor.current,)
      || isTypeAliasDeclaration(cursor.current,)
      || isInterfaceDeclaration(cursor.current,)
      || isClassDeclaration(cursor.current,))
      return cursor.current;
    cursor.current = cursor.current.parent;
  }
  return declaration;
}

/**
 * Reads stable local name for origin owner.
 *
 * @param owner - Normalized producer boundary.
 *
 * @returns identifier name when boundary declares one.
 *
 * @example
 * ```ts
 * originName(callback);
 * ```
 */
function originName(owner: Node,): string | undefined {
  if (isFunctionLikeDeclaration(owner,)) {
    if (!('name' in owner))
      return undefined;
    /**
     * Optional callable name narrowed outside property access.
     */
    const callableName = owner.name;
    if (callableName === undefined)
      return undefined;
    return isIdentifier(callableName,) ? callableName.text : undefined;
  }
  if (isTypeAliasDeclaration(owner,) || isInterfaceDeclaration(owner,))
    return owner.name.text;
  if (!isClassDeclaration(owner,))
    return undefined;
  /**
   * Optional class name narrowed outside property access.
   */
  const className = owner.name;
  return className?.text;
}

/**
 * Classifies normalized origin boundary for diagnostic wording.
 *
 * @param owner - Normalized producer boundary.
 *
 * @returns reader-facing origin category.
 *
 * @example
 * ```ts
 * originKind(callback);
 * ```
 */
function originKind(owner: Node,): ReadonlyTypeOrigin['kind'] {
  if (isFunctionLikeDeclaration(owner,))
    return 'callable';
  if (isTypeAliasDeclaration(owner,)
    || isInterfaceDeclaration(owner,)
    || isClassDeclaration(owner,))
    return 'type';
  return 'expression';
}

/**
 * Formats eager repository-relative origin location.
 *
 * @param owner - Origin boundary resolved in active semantic snapshot.
 *
 * @param project - Project owning active semantic snapshot.
 *
 * @returns normalized path and one-based line.
 *
 * @example
 * ```ts
 * originLocation({ owner, project });
 * ```
 */
function originLocation({
  owner,
  project,
}: {
  readonly owner: Node;
  readonly project: Project;
},): string {
  /**
   * Source owning producer boundary.
   */
  const sourceFile = owner.getSourceFile();
  /**
   * Path relative to nearest workspace marker.
   */
  const relativePath = relative(
    displayRoot(project.configFileName,),
    sourceFile.fileName,
  )
    .split(sep,)
    .join('/',);
  /**
   * One-based line containing producer boundary.
   */
  const line = sourceFile
    .getLineAndCharacterOfPosition(owner.getStart(sourceFile,),)
    .line + 1;
  return `${relativePath}:${String(line,)}`;
}

/**
 * Tests whether declaration source is editable workspace source.
 *
 * @param node - Resolved declaration or normalized owner.
 *
 * @param project - Project classifying source ownership.
 *
 * @returns whether source belongs to inspectable workspace implementation.
 *
 * @example
 * ```ts
 * workspaceOrigin({ node, project });
 * ```
 */
export function workspaceOrigin({
  node,
  project,
}: {
  readonly node: Node;
  readonly project: Project;
},): boolean {
  /**
   * Source file inspected through active project metadata.
   */
  const sourceFile = node.getSourceFile();
  return isWorkspaceSourceFileName(sourceFile.fileName,)
    && (!project.program.isSourceFileDefaultLibrary(sourceFile,))
    && (!project.program.isSourceFileFromExternalLibrary(sourceFile,));
}

/**
 * Converts resolved declaration into eager reader-facing origin.
 *
 * @param declaration - Declaration resolved in active semantic snapshot.
 *
 * @param project - Project owning active semantic snapshot.
 *
 * @returns immutable origin metadata safe across later snapshots.
 *
 * @example
 * ```ts
 * readonlyTypeOrigin({ declaration, project });
 * ```
 */
export function readonlyTypeOrigin({
  declaration,
  project,
}: {
  readonly declaration: Node;
  readonly project: Project;
},): ReadonlyTypeOrigin {
  /**
   * Reader-facing callable or named type boundary.
   */
  const owner = originOwner(declaration,);
  /**
   * Stable name when boundary declares an identifier.
   */
  const name = originName(owner,);
  return {
    kind: originKind(owner,),
    ...(name === undefined) ? {} : { name, },
    location: originLocation({
      owner,
      project,
    },),
  };
}
