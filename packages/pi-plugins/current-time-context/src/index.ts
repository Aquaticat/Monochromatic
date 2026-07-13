/**
 * Pi extension that injects hidden current local wall-clock time context.
 *
 * @module
 */

import type {
  BeforeAgentStartEventResult,
  ExtensionAPI,
} from '@earendil-works/pi-coding-agent';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed';
import { formatTimeContext, } from './format-time-context.ts';

//region Constants

/**
 * Custom message type used for hidden current-time context entries.
 */
const CURRENT_TIME_CONTEXT_TYPE = 'current-time-context';

//endregion Constants

//region Extension entry point

/**
 * Current Time Context pi extension.
 *
 * Subscribes to `before_agent_start` and returns one hidden custom message
 * containing local 24-hour wall-clock time at minute precision.
 *
 * @param pi - pi extension API
 *
 * @mutates pi - `pi.on` stores the `before_agent_start` event registration in the Pi host
 *
 * @example
 * ```typescript
 * // In ~/.pi/agent/settings.json:
 * { "packages": ["./packages/pi-plugins/current-time-context"] }
 * ```
 */
export default function currentTimeContext(pi: ForeignBorrowed<ExtensionAPI>,): void {
  pi.on(
    'before_agent_start',
    function handleBeforeAgentStart(): BeforeAgentStartEventResult {
      return {
        message: {
          customType: CURRENT_TIME_CONTEXT_TYPE,
          content: formatTimeContext(new Date(),),
          display: false,
        },
      };
    },
  );
}

//endregion Extension entry point

export {
  CURRENT_TIME_CONTEXT_TYPE,
};
export { formatTimeContext, } from './format-time-context.ts';
