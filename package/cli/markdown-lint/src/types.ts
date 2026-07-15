import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import type { Root, } from 'mdast';

/**
 * A localized source edit expressed as half-open source offsets. The oxlint and
 * markdownlint `fixInfo` model translated to offsets, which mdast positions
 * provide directly. An add-only fix is the degenerate case where
 * `start === end`: a pure insertion that moves no existing byte.
 */
export type Fix = {
  /**
   * Inclusive start offset into the source.
   */
  readonly start: number;
  /**
   * Exclusive end offset into the source; equal to `start` for an insertion.
   */
  readonly end: number;
  /**
   * Text written in place of the `[start, end)` span.
   */
  readonly insertText: string;
};

/**
 * One reported violation. Positions are 1-based line and column (for human
 * reporters) plus source offsets (for fix application and machine reporters).
 */
export type Diagnostic = {
  /**
   * Rule that produced this diagnostic (an MDxxx code or a custom rule name).
   */
  readonly ruleId: string;
  /**
   * Human-readable description of the violation.
   */
  readonly message: string;
  /**
   * 1-based line of the violation's start.
   */
  readonly line: number;
  /**
   * 1-based column of the violation's start.
   */
  readonly column: number;
  /**
   * Optional localized fix; absent for report-only diagnostics.
   */
  readonly fix?: Fix;
};

/**
 * Everything a rule's `check` reads: the parsed tree, the original source (for
 * the rules that recover the exact written form at known offsets), and whether
 * the file is MDX.
 */
export type RuleContext = {
  /**
   * mdast tree for the file under lint.
   */
  readonly tree: ForeignBorrowed<Root>;
  /**
   * Original on-disk source, indexed by the offsets in node positions.
   */
  readonly source: string;
  /**
   * Whether the file was parsed as MDX.
   */
  readonly mdx: boolean;
};

/**
 * A lint rule: a stable id, whether it can emit fixes, and a `check` that walks
 * the tree and returns diagnostics. `fixable` documents intent; a report-only
 * rule simply never sets `fix` on its diagnostics.
 */
export type Rule = {
  /**
   * Stable identifier (an MDxxx code or a custom rule name).
   */
  readonly id: string;
  /**
   * Whether this rule can attach fixes to its diagnostics.
   */
  readonly fixable: boolean;
  /**
   * Walk the tree and return every violation found.
   *
   * @param context - tree, source, and MDX flag for the file under lint
   *
   * @returns diagnostics in the order discovered
   */
  readonly check: (context: RuleContext,) => readonly Diagnostic[];
};
