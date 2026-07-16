/**
 * Pi custom-entry renderer for terminal reviewer unavailability.
 *
 * @module
 */

import type {
  CustomEntry,
  EntryRenderOptions,
  ExtensionAPI,
  Theme,
} from '@earendil-works/pi-coding-agent';
import { Text, } from '@earendil-works/pi-tui';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import { GOAL_REVIEW_UNAVAILABLE_ENTRY_TYPE, } from './constants.ts';
import type { GoalReviewUnavailableDiagnostic, } from './types.ts';

/**
 * Register persistent terminal reviewer-unavailable transcript renderer.
 *
 * @param pi - Pi extension API receiving custom-entry renderer
 *
 * @mutates pi - pi.registerEntryRenderer stores renderer for session transcript
 *
 * @example
 * ```ts
 * registerGoalTerminalRenderer(pi);
 * ```
 */
function registerGoalTerminalRenderer(
  pi: ForeignBorrowed<ExtensionAPI>,
): void {
  pi.registerEntryRenderer<GoalReviewUnavailableDiagnostic>(
    GOAL_REVIEW_UNAVAILABLE_ENTRY_TYPE,
    function renderReviewUnavailable(
      entry: ForeignBorrowed<CustomEntry<GoalReviewUnavailableDiagnostic>>,
      _options: ForeignBorrowed<EntryRenderOptions>,
      theme: ForeignBorrowed<Theme>,
    ) {
      /**
       * Persisted terminal diagnostic payload.
       */
      const { data, } = entry;
      if (data === undefined)
        return undefined;
      /**
       * Reviewer identities or explicit no-transport marker.
       */
      const attempted = data.attemptedReviewerIdentities
        .length
        === 0
        ? 'none'
        : data.attemptedReviewerIdentities
          .join(', ',);
      return new Text(
        [
          theme.fg(
            'error',
            theme.bold('Goal review unavailable',),
          ),
          `Attempted reviewers: ${attempted}`,
          data.diagnostic,
        ].join('\n',),
        1,
        0,
      );
    },
  );
}

export { registerGoalTerminalRenderer, };
