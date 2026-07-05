/**
 * `unbash` specifiers for `typescript/prefer-readonly-parameter-types`.
 *
 * @module
 */

//region Source-backed type names: Keep vendor AST names exact.

/**
 * Package specifier object shape accepted by oxlint's `allow` option.
 *
 * @example
 * ```typescript
 * const specifier: UnbashPackageSpecifier = unbashPackageAllowSpecifiers[0];
 * ```
 */
type UnbashPackageSpecifier = {
  readonly from: 'package';
  readonly name: readonly string[];
  readonly package: string;
};

/**
 * Exported `unbash` AST type and interface names whose mutable shape is owned
 * by the parser package.
 *
 * These names come from `unbash/src/types.ts` in the audited `unbash@3.0.0`
 * source and from the exact `Unbash*` parameter annotations under
 * `packages/pi-plugins/auto-mode/src/unbash-command-info*.ts`. tsgolint first checks
 * alias or symbol names in `internal/utils/type_matches_specifier.go` before it
 * checks package origin, and `prefer_readonly_parameter_types.go` recurses
 * through union members after an allow-list miss. Exact parameters such as
 * `UnbashWordPart | UnbashDoubleQuotedChild` therefore need constituent names
 * like `LiteralPart` and `DoubleQuotedPart`, not a broader local annotation.
 *
 * @example
 * ```typescript
 * unbashAstTypeNames.includes('WordPart');
 * ```
 */
const unbashAstTypeNames: readonly string[] = [
  'AnsiCQuotedPart',
  'ArithmeticCommandExpansion',
  'ArithmeticExpansionPart',
  'ArithmeticExpression',
  'AssignmentPrefix',
  'BraceExpansionPart',
  'Case',
  'Command',
  'CommandExpansionPart',
  'DoubleQuotedChild',
  'DoubleQuotedPart',
  'ExtendedGlobPart',
  'LiteralPart',
  'LocaleStringPart',
  'Node',
  'ParameterExpansionPart',
  'ProcessSubstitutionPart',
  'Redirect',
  'Script',
  'SimpleExpansionPart',
  'SingleQuotedPart',
  'Statement',
  'TestExpression',
  'Word',
  'WordPart',
] as const;

//endregion Source-backed type names

//region Package specifiers: Bridge exact names into oxlint config.

/**
 * Package specifier for all `unbash` AST aliases and interfaces consumed by
 * auto-mode.
 *
 * @example
 * ```typescript
 * unbashPackageAllowSpecifiers[0].package;
 * ```
 */
const unbashPackageAllowSpecifiers: readonly UnbashPackageSpecifier[] = [{
  from: 'package',
  package: 'unbash',
  name: unbashAstTypeNames,
},] as const;

//endregion Package specifiers

export { unbashPackageAllowSpecifiers, };
