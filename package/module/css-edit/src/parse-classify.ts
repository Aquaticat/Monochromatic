import {
  isTokenCloseCurly,
  isTokenColon,
  isTokenEOF,
  isTokenIdent,
  isTokenOpenCurly,
  isTokenSemicolon,
} from '@csstools/css-tokenizer';
import { CssParseError, } from './errors.ts';
import {
  type CSSToken,
  isClosingToken,
  isOpeningToken,
  isTriviaToken,
} from './token.ts';

//region Classification result

/**
 * Outcome of classifying a non-trivia, non-at-keyword run inside stylesheet or
 * block contents, per the CSS Syntax section 5 unified consumer: a
 * declaration-shaped run with its exclusive end index, or a qualified rule
 * with the index of its opening `{`.
 */
export type ClassifiedRun = {
  readonly outcome: 'declaration';
  /**
   * Index one past the run's final token (past the `;` when present; at the
   * closing `}` or EOF token when not).
   */
  readonly endExclusive: number;
} | {
  readonly outcome: 'rule';
  /**
   * Index of the `{` token that starts the rule's block.
   */
  readonly blockOpenIndex: number;
};

//endregion Classification result

//region Declaration shape probe

/**
 * Finds the colon completing a declaration-shaped start (`ident`, optional
 * trivia, `:`), reporting the classification seed for {@link classifyRun}.
 *
 * @param tokens - Full token array of the document.
 *
 * @param start - Index of the run's first token.
 *
 * @returns Colon index and whether the ident names a custom property, or
 * undefined when the run does not start declaration-shaped.
 */
function probeDeclarationShape({
  tokens,
  start,
}: {
  readonly tokens: readonly CSSToken[];
  readonly start: number;
},): {
  readonly colonIndex: number;
  readonly isCustomProperty: boolean;
} | undefined {
  /**
   * Candidate property-name token.
   */
  const first = tokens[start];
  if ((first === undefined) || (!isTokenIdent(first,)))
    return undefined;

  /**
   * Cursor scanning past trivia between the ident and a possible colon.
   */
  let probe = start + 1;
  while (true) {
    /**
     * Token at the probe cursor.
     */
    const candidate = tokens[probe];
    if (candidate === undefined)
      return undefined;
    if (isTriviaToken(candidate,)) {
      probe += 1;
      continue;
    }
    if (!isTokenColon(candidate,))
      return undefined;
    /**
     * Parsed data slot of the ident token, holding the unescaped name.
     */
    const [, , , , identData,] = first;
    return {
      colonIndex: probe,
      isCustomProperty: identData.value.startsWith('--',),
    };
  }
}

//endregion Declaration shape probe

//region Classifier

/**
 * Classifies a content run as a declaration or a qualified rule, mirroring the
 * CSS Syntax section 5 approach: attempt a declaration, and restart as a rule
 * when the value of a non-custom property would contain a top-level `{` block
 * (the `span:hover { ... }` case).
 *
 * Custom properties keep `{}` blocks in their value, so
 * `--raw: { nested: token };` classifies as a declaration.
 *
 * @param tokens - Full token array of the document.
 *
 * @param start - Index of the run's first token (non-trivia, not an
 * at-keyword, not a closing token).
 *
 * @returns Discriminated classification with the indices the consumer needs.
 *
 * @throws CssParseError on unbalanced closing tokens or a rule prelude that
 * never reaches a block.
 *
 * @example
 * ```ts
 * classifyRun({ tokens, start: 0 }); // => { outcome: 'rule', blockOpenIndex: 3 }
 * ```
 */
export function classifyRun({
  tokens,
  start,
}: {
  readonly tokens: readonly CSSToken[];
  readonly start: number;
},): ClassifiedRun {
  /**
   * Declaration seed when the run opens ident-colon; undefined forces the rule path.
   */
  const declarationShape = probeDeclarationShape({
    tokens,
    start,
  },);

  /**
   * Nesting depth relative to the run's own level.
   */
  let depth = 0;
  /**
   * Scan cursor; declaration scanning starts after the colon, rule scanning at the run start.
   */
  let index = declarationShape === undefined
    ? start
    : declarationShape.colonIndex + 1;

  while (true) {
    /**
     * Token at the scan cursor.
     */
    const token = tokens[index];
    if ((token === undefined) || isTokenEOF(token,)) {
      if (declarationShape !== undefined)
        return {
          outcome: 'declaration',
          endExclusive: index,
        };
      throw new CssParseError({
        message: 'qualified rule prelude reached end of input without a block',
        offset: token === undefined ? 0 : token[2],
      },);
    }

    if (depth === 0) {
      if (isTokenSemicolon(token,)) {
        if (declarationShape !== undefined)
          return {
            outcome: 'declaration',
            endExclusive: index + 1,
          };
        throw new CssParseError({
          message: 'qualified rule prelude contains a semicolon before any block',
          offset: token[2],
        },);
      }
      if (isTokenCloseCurly(token,)) {
        if (declarationShape !== undefined)
          return {
            outcome: 'declaration',
            endExclusive: index,
          };
        throw new CssParseError({
          message: 'qualified rule prelude reached the end of its block without a block of its own',
          offset: token[2],
        },);
      }
      if (isTokenOpenCurly(token,)) {
        // A top-level `{` in a non-custom declaration value reclassifies the
        // run as a rule, mirroring the spec's restart-as-rule step.
        if ((declarationShape === undefined) || (!declarationShape.isCustomProperty))
          return {
            outcome: 'rule',
            blockOpenIndex: index,
          };
        depth += 1;
        index += 1;
        continue;
      }
      if (isClosingToken(token,))
        throw new CssParseError({
          message: 'unbalanced closing token in content run',
          offset: token[2],
        },);
    }
    else if (isClosingToken(token,)) {
      depth -= 1;
      index += 1;
      continue;
    }

    if (isOpeningToken(token,))
      depth += 1;
    index += 1;
  }
}

//endregion Classifier
