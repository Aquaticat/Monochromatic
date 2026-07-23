/**
 * Pre-execution self-containment validation for trusted MJS artifacts.
 *
 * @module
 */
import { isBuiltin, } from 'node:module';
import {
  type Diagnostic,
  type ExportAllDeclaration,
  type ExportNamedDeclaration,
  type ImportDeclaration,
  type ImportExpression,
  parse,
} from 'yuku-parser';
import { walk, } from 'yuku-ast';
import type { ReadonlyDeep, } from 'type-fest';
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
   * Complete parse result; yuku-parser recovers from syntax errors, so
   * error-severity diagnostics decide rejection.
   */
  const parsed = parse(sourceText,);
  /**
   * Error-severity syntax diagnostics.
   */
  const parseErrors = parsed.diagnostics
    .filter(function isError(diagnostic: ForeignBorrowed<Diagnostic>,): boolean {
      return diagnostic.severity === 'error';
    },);

  if (parseErrors.length > 0)
    throw new MjsValidationError(
      `Configuration syntax is invalid in ${sourceName}: ${parseErrors
        .map(function toMessage(diagnostic: ForeignBorrowed<Diagnostic>,): string {
          return diagnostic.message;
        },)
        .join('; ',)}`,
    );

  /**
   * Node built-ins retained by artifact.
   */
  const nodeBuiltins = new Set<string>();

  /**
   * Admits one dependency specifier, rejecting everything except Node
   * built-ins.
   *
   * @param specifier - Module specifier under self-containment judgement.
   *
   * @param form - Import form naming for diagnostics.
   *
   * @throws MjsValidationError when the specifier is not a Node built-in.
   *
   * @example
   * ```ts
   * admitBuiltin({ specifier: 'node:fs', form: 'static import' });
   * ```
   */
  function admitBuiltin({
    specifier,
    form,
  }: Readonly<{
    specifier: string;
    form: string;
  }>,): void {
    if (!isBuiltin(specifier,)) {
      throw new MjsValidationError(
        `Configuration must be self-contained; ${form} is not a Node built-in: ${specifier}`,
      );
    }
    nodeBuiltins.add(specifier,);
  }

  /**
   * Admits one static module declaration source.
   *
   * @param source - Declaration source literal.
   *
   * @throws MjsValidationError when the source is not a Node built-in.
   *
   * @example
   * ```ts
   * admitStaticSource(importDeclaration.source);
   * ```
   */
  function admitStaticSource(source: ReadonlyDeep<ImportDeclaration['source']>,): void {
    /**
     * Literal specifier value before the string-shape check.
     */
    const { value, } = source;
    if ((typeof value) !== 'string')
      throw new MjsValidationError('Static imports must use string literal specifiers.',);
    admitBuiltin({
      specifier: value,
      form: 'static import',
    },);
  }

  walk(
    parsed.program,
    {
      ImportDeclaration: function visitImport(node: ReadonlyDeep<ImportDeclaration>,): void {
        admitStaticSource(node.source,);
      },
      ExportNamedDeclaration: function visitNamedExport(node: ReadonlyDeep<ExportNamedDeclaration>,): void {
        /**
         * Re-export source literal, null for local exports.
         */
        const { source, } = node;
        if (source === null)
          return;
        admitStaticSource(source,);
      },
      ExportAllDeclaration: function visitAllExport(node: ReadonlyDeep<ExportAllDeclaration>,): void {
        admitStaticSource(node.source,);
      },
      ImportExpression: function visitDynamicImport(node: ReadonlyDeep<ImportExpression>,): void {
        /**
         * Dynamic import argument before the literal-shape check.
         */
        const { source, } = node;
        if ((source.type !== 'Literal') || ((typeof source.value) !== 'string'))
          throw new MjsValidationError('Dynamic imports must use literal Node built-in specifiers.',);
        admitBuiltin({
          specifier: source.value,
          form: 'dynamic import',
        },);
      },
    },
  );

  return {
    nodeBuiltins: [...nodeBuiltins,].toSorted(),
  };
}
