/**
 * Shared types for converting `unbash` AST nodes to auto-mode command info.
 *
 * @module
 */

import type {
  ArithmeticExpression as UnbashArithmeticExpression,
  DoubleQuotedChild as UnbashDoubleQuotedChild,
  Node as UnbashNode,
  ParseError as UnbashParseError,
  Redirect as UnbashRedirect,
  RedirectOperator as UnbashRedirectOperator,
  Script as UnbashScript,
  TestExpression as UnbashTestExpression,
  Word as UnbashWord,
  WordPart as UnbashWordPart,
} from 'unbash';
import type { CommandInfo, } from './types.ts';

/**
 * `unbash` script plus tolerant parser diagnostics.
 */
type ParsedUnbashScript = UnbashScript & {
  /**
   * Recoverable parse errors reported by `unbash`.
   */
  readonly errors?: readonly UnbashParseError[];
};

/**
 * Word part union reached from full words or quoted child lists.
 */
type TraversablePart = UnbashWordPart | UnbashDoubleQuotedChild;

/**
 * AST node work item.
 */
type NodeWorkItem = {
  /**
   * Work item discriminant.
   */
  readonly kind: 'node';
  /**
   * AST node to visit.
   */
  readonly node: UnbashNode;
  /**
   * Redirects inherited from wrapping statement nodes.
   */
  readonly redirects: readonly UnbashRedirect[];
};

/**
 * Shell word work item.
 */
type WordWorkItem = {
  /**
   * Work item discriminant.
   */
  readonly kind: 'word';
  /**
   * Word whose parts may contain nested scripts.
   */
  readonly word: UnbashWord;
};

/**
 * Word-parts work item.
 */
type PartsWorkItem = {
  /**
   * Work item discriminant.
   */
  readonly kind: 'parts';
  /**
   * Parts to scan for nested scripts and words.
   */
  readonly parts: readonly TraversablePart[];
};

/**
 * Arithmetic expression work item.
 */
type ArithmeticWorkItem = {
  /**
   * Work item discriminant.
   */
  readonly kind: 'arithmetic';
  /**
   * Expression that may contain command expansion.
   */
  readonly expression: UnbashArithmeticExpression;
};

/**
 * Bash test expression work item.
 */
type TestWorkItem = {
  /**
   * Work item discriminant.
   */
  readonly kind: 'test';
  /**
   * Expression whose operands may contain command expansion.
   */
  readonly expression: UnbashTestExpression;
};

/**
 * Redirect-only work item for compound command redirects.
 */
type RedirectsWorkItem = {
  /**
   * Work item discriminant.
   */
  readonly kind: 'redirects';
  /**
   * Redirects to surface as path signals.
   */
  readonly redirects: readonly UnbashRedirect[];
};

/**
 * Union of all iterative traversal work items.
 */
type WorkItem =
  | NodeWorkItem
  | WordWorkItem
  | PartsWorkItem
  | ArithmeticWorkItem
  | TestWorkItem
  | RedirectsWorkItem;

/**
 * Command collection returned to the public parser wrapper.
 */
type CommandCollection = {
  /**
   * Parsed command records.
   */
  readonly commands: readonly CommandInfo[];
  /**
   * Whether parsed syntax contains a pipeline.
   */
  readonly isPipeline: boolean;
  /**
   * Whether nested parsing reported errors.
   */
  readonly hasParseErrors: boolean;
};

/**
 * Result of visiting one traversal work item.
 */
type VisitResult = {
  /**
   * Commands emitted by this work item.
   */
  readonly commands: readonly CommandInfo[];
  /**
   * Child work items to process in source order.
   */
  readonly workItems: readonly WorkItem[];
  /**
   * Whether this work item saw a pipeline operator.
   */
  readonly isPipeline: boolean;
  /**
   * Whether this work item saw parser diagnostics.
   */
  readonly hasParseErrors: boolean;
};

/**
 * Sentinel returned when no nested script exists.
 */
const NO_SCRIPT: unique symbol = Symbol('nested script payload absent from unbash command',);

/**
 * Empty redirects singleton used for child work items.
 */
const EMPTY_REDIRECTS: readonly UnbashRedirect[] = [];

/**
 * Empty visit result for leaf work items.
 */
const EMPTY_VISIT_RESULT: VisitResult = {
  commands: [],
  workItems: [],
  isPipeline: false,
  hasParseErrors: false,
};

/**
 * Redirect operators whose targets are files or file descriptors.
 */
const FILE_REDIRECT_OPERATORS: ReadonlySet<UnbashRedirectOperator> = new Set<UnbashRedirectOperator>([
  '>',
  '>>',
  '<',
  '<>',
  '<&',
  '>&',
  '>|',
  '&>',
  '&>>',
],);

export {
  EMPTY_REDIRECTS,
  EMPTY_VISIT_RESULT,
  FILE_REDIRECT_OPERATORS,
  NO_SCRIPT,
};
export type {
  CommandCollection,
  ParsedUnbashScript,
  TraversablePart,
  VisitResult,
  WorkItem,
};
