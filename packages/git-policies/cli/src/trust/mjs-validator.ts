/**
 * Pre-execution self-containment validation for trusted MJS artifacts.
 *
 * @module
 */
import { isBuiltin, } from 'node:module';
import { parse, } from 'acorn';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

/**
 * Rejected MJS artifact.
 */
export class MjsValidationError extends Error {
  /**
   * Creates MJS validation failure.
   *
   * @param message - safe failure explanation
   */
  public constructor(message: string,) {
    super(message,);
    this.name = 'MjsValidationError';
  }
}

/**
 * Validated static dependency summary.
 */
export type MjsValidation = Readonly<{
  /**
   * Node built-ins retained by artifact.
   */
  nodeBuiltins: readonly string[];
}>;

/**
 * Read-only top-level syntax fields needed by validator.
 */
type StaticNodeInput = Readonly<{
  /**
   * ESTree node kind.
   */
  type: string;
  /**
   * Optional external module literal.
   */
  source?: unknown;
}>;

/**
 * Static declaration has no module source.
 */
const STATIC_MODULE_ABSENT: unique symbol = Symbol('static module declaration has no source',);

/**
 * Reads static module specifier from top-level ESM declaration.
 *
 * @param node - Acorn top-level AST node
 *
 * @returns literal specifier or absence
 */
function staticModuleSpecifier(node: StaticNodeInput,): string | typeof STATIC_MODULE_ABSENT {
  if ((node.type !== 'ImportDeclaration')
    && (node.type !== 'ExportNamedDeclaration')
    && (node.type !== 'ExportAllDeclaration'))
    return STATIC_MODULE_ABSENT;
  if ((!('source' in node)) || ((typeof node.source) !== 'object')
    || (node.source === null)
    || (!('value' in node.source))
    || ((typeof node.source
      .value) !== 'string'))
    return STATIC_MODULE_ABSENT;
  return node.source
    .value;
}

/**
 * Collects literal dynamic-import targets from bounded Acorn syntax tree.
 *
 * @param value - syntax node, child collection, or scalar
 *
 * @returns literal dynamic-import targets in source order
 */
function dynamicModuleSpecifiers(value: unknown,): readonly string[] {
  if (Array.isArray(value,))
    return value.flatMap(dynamicModuleSpecifiers,);
  if (((typeof value) !== 'object') || (value === null))
    return [];
  if (('type' in value) && (value.type === 'ImportExpression')) {
    if ((!('source' in value))
      || ((typeof value.source) !== 'object')
      || (value.source === null)
      || (!('value' in value.source))
      || ((typeof value.source
        .value) !== 'string'))
      throw new MjsValidationError('Dynamic imports must use literal Node built-in specifiers.',);
    return [value.source
      .value,];
  }
  return Object.values(value,)
    .flatMap(dynamicModuleSpecifiers,);
}

/**
 * Validates syntax and dependency self-containment without execution.
 *
 * @param bytes - exact candidate MJS bytes
 *
 * @param sourceName - diagnostic-only source name
 *
 * @returns retained Node built-in imports
 *
 * @example
 * ```ts
 * validateMjs({ bytes: new TextEncoder().encode('export default {}'), sourceName: 'config.mjs' });
 * ```
 */
export function validateMjs({
  bytes,
  sourceName,
}: Readonly<{
  bytes: Uint8Array;
  sourceName: string;
}>,): MjsValidation {
  /**
   * UTF-8 source decoded without replacement characters.
   */
  const sourceText = (function decodeSource(): string {
    try {
      return new TextDecoder(
        'utf-8',
        { fatal: true, },
      ).decode(bytes,);
    }
    catch (error: unknown) {
      throw new MjsValidationError(`Configuration is not valid UTF-8: ${String(error,)}`,);
    }
  })();
  /**
   * Complete parsed ECMAScript module.
   */
  const program = (function parseModule(): ReturnType<typeof parse> {
    try {
      return parse(
        sourceText,
        {
        ecmaVersion: 'latest',
        sourceType: 'module',
        allowHashBang: true,
      },
      );
    }
    catch (error: unknown) {
      throw new MjsValidationError(`Configuration syntax is invalid in ${sourceName}: ${String(error,)}`,);
    }
  })();
  /**
   * Static Node built-ins retained by artifact.
   */
  const nodeBuiltins = new Set<string>();
  program.body
    .forEach(function inspectTopLevelNode(node: ForeignBorrowed<StaticNodeInput>,) {
    /**
     * Static dependency specifier when declaration has one.
     */
    const specifier = staticModuleSpecifier(node,);
    if (specifier === STATIC_MODULE_ABSENT)
      return;
    if (!isBuiltin(specifier,)) {
      throw new MjsValidationError(
        `Configuration must be self-contained; static import is not a Node built-in: ${specifier}`,
      );
    }
    nodeBuiltins.add(specifier,);
  },);
  dynamicModuleSpecifiers(program,)
    .forEach(function inspectDynamicImport(specifier,) {
    if (!isBuiltin(specifier,)) {
      throw new MjsValidationError(
        `Configuration must be self-contained; dynamic import is not a Node built-in: ${specifier}`,
      );
    }
    nodeBuiltins.add(specifier,);
  },);
  return {
    nodeBuiltins: [...nodeBuiltins,].toSorted(),
  };
}
