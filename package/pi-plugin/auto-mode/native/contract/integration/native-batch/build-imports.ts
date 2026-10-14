/**
 Rewrite parser-owned import literals without interpreting comments or unrelated strings as code.

 @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { nonNullishOrThrow } from '@monochromatic-dev/module-or-throw/ts';
import {
  type Node,
  parse
} from 'yuku-parser';
import { walkNativeSyntax } from './build-syntax.ts';
import { applyNativeSourceEdits } from './build-spans.ts';

//region Import locations come from the original parsed module

/**
 Source transformation failures do not carry policy meaning.
 */
export class NativeImportBuildError extends Error {
  /**
   Distinguish import preparation from native runtime failures.
   */
  override readonly name = 'NativeImportBuildError';
}

/**
 Import selection receives decoded values and their executable role.
 */
export type NativeImportSelection = {
  /**
   Decoded module identifier before re-encoding at the JavaScript boundary.
   */
  readonly specifier: string;
  /**
   Dynamic expressions can retain their original resolution separately from declarations.
   */
  readonly kind: 'static' | 'dynamic';
};

/**
 Original literal coordinates retain surrounding source bytes.
 */
type NativeImportSpan = NativeImportSelection & {
  /**
   First UTF-16 code unit of the quoted source literal.
   */
  readonly start: number;
  /**
   First UTF-16 code unit after the quoted source literal.
   */
  readonly end: number;
};

/**
 Every transformation logs through its own boundary.
 */
const l = tagged({ tag: 'auto-mode-native-build-imports' });

/**
 Collect literal import locations with an explicit work stack instead of recursing through source structure.

 @param root - original parsed module

 @returns locations keyed by original literal start
 */
function collectImports(root: Node): ReadonlyMap<number, NativeImportSpan> {
  /**
   Literal starts are unique even when imports occur inside nested functions.
   */
  const imports = new Map<number, NativeImportSpan>();
  for (const node of walkNativeSyntax(root)) {
    if ((node.type === 'ImportDeclaration') || (node.type === 'ExportNamedDeclaration')
      || (node.type === 'ExportAllDeclaration')) {
      /**
       Local export declarations have no module source.
       */
      const literal = node.source;
      if (literal !== null) imports.set(
        literal.start,
        {
          start: literal.start,
          end: literal.end,
          specifier: literal.value,
          kind: 'static'
        }
      );
    } else if ((node.type === 'ImportExpression') && (node.source
      .type
      === 'Literal')
      && ((typeof node.source
        .value) === 'string')) {
      imports.set(
        node.source
          .start,
        {
          start: node.source
            .start,
          end: node.source
            .end,
          specifier: node.source
            .value,
          kind: 'dynamic'
        }
      );
    }
  }
  return imports;
}

//endregion Import locations come from the original parsed module

//region Token order produces non-overlapping source fragments in one linear pass

/**
 Replace selected module literals while preserving every other byte of the original source.

 @param source - original module text whose import locations must be retained

 @param path - affected module named in parser diagnostics

 @param select - resolver returning the original specifier when no rewrite applies

 @returns source with selected values encoded as JavaScript string literals

 @throws NativeImportBuildError when the original module does not parse

 @example
 ```ts
 rewriteNativeImports({ source, path, select: function keepImport({ specifier }) { return specifier; } });
 ```
 */
export function rewriteNativeImports({
  source,
  path,
  select
}: {
  readonly source: string;
  readonly path: string;
  readonly select: (input: NativeImportSelection) => string;
}): string {
  /**
   The original source path remains attached to transformation diagnostics.
   */
  const rl = tagged({
    tag: rewriteNativeImports.name,
    l
  });
  rl.debug(`reading native imports: ${path}`);
  /**
   Tokens provide source order without sorting the structural walk's locations.
   */
  const parsed = parse(
    source,
    {
      sourceType: 'module',
      tokens: true
    }
  );
  if (parsed.diagnostics
    .length
    > 0) throw new NativeImportBuildError(`Cannot parse native import source: ${path}`);
  /**
   Token capture was explicitly requested from the qualified parser.
   */
  const tokens = nonNullishOrThrow(parsed.tokens);
  /**
   Import literals alone are candidates for rewriting.
   */
  const imports = collectImports(parsed.program);
  /**
   Ordered edits avoid rebuilding an accumulating string for each replacement.
   */
  const edits: (NativeImportSpan & { readonly text: string })[] = [];
  for (let index = 0; index < tokens.length; index++) {
    /**
     Token starts match the original AST's UTF-16 coordinates.
     */
    const literal = imports.get(tokens.start(index));
    if (literal === undefined) continue;
    /**
     Resolver output is encoded only at the JavaScript interpolation boundary.
     */
    const selected = select({
      specifier: literal.specifier,
      kind: literal.kind
    });
    if (selected !== literal.specifier) edits.push({
      ...literal,
      text: JSON.stringify(selected)
    });
  }
  rl.debug(`rewrote ${edits.length} native import literals: ${path}`);
  return applyNativeSourceEdits({
    source,
    edits
  });
}

//endregion Token order produces non-overlapping source fragments in one linear pass
