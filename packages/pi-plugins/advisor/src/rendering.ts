/**
 * TUI component renderers for Advisor tool and custom messages.
 *
 * @module
 */

import type {
  AgentToolResult,
  Theme,
} from '@earendil-works/pi-coding-agent';
import {
  type Component,
  Text,
} from '@earendil-works/pi-tui';
import type { ReadonlyDeep, } from 'type-fest';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed';
import {
  fallbackDetails,
  isAdvisorDetails,
  renderAdvisorSummary,
} from './rendering-summary.ts';
import type {
  AdvisorDetails,
  AdvisorToolParams,
} from './types.ts';

//region Public renderers

/**
 * Render an Advisor tool call row.
 *
 * @param args - tool parameters
 *
 * @param theme - current pi theme
 *
 * @returns TUI component
 *
 * @example
 * ```typescript
 * renderAdvisorCall({ args: {}, theme });
 * ```
 */
export function renderAdvisorCall(
  {
    args,
    theme,
  }: {
    readonly args: AdvisorToolParams;
    readonly theme: ForeignBorrowed<Theme>;
  },
): Component {
  /**
   * Requested target displayed before execution resolves.
   */
  const target = args.model
    ?? 'default scoped model';
  /**
   * Styled tool title.
   */
  const title = theme.fg(
    'toolTitle',
    theme.bold('advisor',),
  );
  /**
   * Styled action label.
   */
  const action = theme.fg(
    'accent',
    'Consulting advisor',
  );
  /**
   * Styled target model label.
   */
  const targetText = theme.fg(
    'dim',
    target,
  );
  /**
   * Styled focused-question indicator.
   */
  const questionText = args.question === undefined
    ? ''
    : theme.fg(
      'dim',
      ' with question',
    );
  return new Text(
    `${title} ${action} ${targetText}${questionText}`,
    0,
    0,
  );
}

/**
 * Render an Advisor tool result.
 *
 * @param result - Advisor tool result
 *
 * @param expanded - whether result is expanded
 *
 * @param theme - current pi theme
 *
 * @returns TUI component
 *
 * @example
 * ```typescript
 * renderAdvisorResult({ result, expanded: false, theme });
 * ```
 */
export function renderAdvisorResult(
  {
    result,
    expanded,
    theme,
  }: {
    readonly result: ReadonlyDeep<AgentToolResult<AdvisorDetails>>;
    readonly expanded: boolean;
    readonly theme: ForeignBorrowed<Theme>;
  },
): Component {
  /**
   * Text block returned to primary model.
   */
  const text = result.content[0]
    ?.type
    === 'text'
    ? result.content[0]
      .text
    : '(advisor returned no text)';
  return new Text(
    renderAdvisorSummary({
      text,
      details: result.details,
      expanded,
      theme,
    },),
    0,
    0,
  );
}

/**
 * Render a manual `/advisor` custom message.
 *
 * @param message - custom message payload
 *
 * @param expanded - whether message is expanded
 *
 * @param theme - current pi theme
 *
 * @returns TUI component
 *
 * @example
 * ```typescript
 * renderAdvisorMessage({ message, expanded: true, theme });
 * ```
 */
export function renderAdvisorMessage(
  {
    message,
    expanded,
    theme,
  }: {
    readonly message: {
      readonly content: unknown;
      readonly details?: unknown;
    };
    readonly expanded: boolean;
    readonly theme: ForeignBorrowed<Theme>;
  },
): Component {
  /**
   * Message text from custom message content.
   */
  const text = (typeof message.content) === 'string'
    ? message.content
    : '(advisor returned no text)';
  /**
   * Structured details when present.
   */
  const details = isAdvisorDetails(message.details,)
    ? message.details
    : fallbackDetails();
  return new Text(
    renderAdvisorSummary({
      text,
      details,
      expanded,
      theme,
    },),
    0,
    0,
  );
}

export {
  firstAdvisoryLine,
  renderAdvisorSummary,
} from './rendering-summary.ts';

//endregion Public renderers
