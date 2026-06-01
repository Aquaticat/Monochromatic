/**
 * Pi statusline extension entry point.
 *
 * Adds one footer status segment for Anthropic rate-limit usage warnings.
 *
 * @module
 */

import type {
  ExtensionAPI,
  ExtensionContext,
} from '@earendil-works/pi-coding-agent';
import {
  tagged,
  type Logger,
} from '@monochromatic-dev/module-logger/ts';
import { statuslineLogger, } from './log.ts';
import {
  PLAIN_USAGE_WARNING_STYLE,
  type UsageWarningStyle,
} from './rate-limit-types.ts';
import { formatUsageWarningStatus, } from './usage-warning.ts';

//region Constants

/**
 * Footer status key owned by this extension.
 */
const STATUS_KEY = 'pi-statusline.usage';

//endregion Constants

//region UI helpers

/**
 * Builds theme-backed style hooks for warning segments.
 *
 * @param ctx - Pi extension context with UI theme access
 *
 * @returns style hooks using current Pi theme colors
 *
 * @example
 * ```ts
 * const style = styleFromContext(ctx);
 * ```
 */
function styleFromContext(ctx: ExtensionContext,): UsageWarningStyle {
  /**
   * Current Pi theme used to color footer status text.
   */
  const { theme, } = ctx.ui;

  return {
    healthy: function healthy(text: string,): string {
      return theme.fg(
        'success',
        text,
      );
    },
    caution: function caution(text: string,): string {
      return theme.fg(
        'warning',
        text,
      );
    },
    critical: function critical(text: string,): string {
      return theme.fg(
        'error',
        text,
      );
    },
  };
}

/**
 * Applies or clears footer status when UI is available.
 *
 * @param ctx - Pi extension context
 *
 * @param statusText - rendered status text, empty when clearing
 *
 * @example
 * ```ts
 * setUsageStatus({ ctx, statusText: 'tokens 40% left' });
 * ```
 */
function setUsageStatus({
  ctx,
  statusText,
}: Readonly<{
  ctx: ExtensionContext;
  statusText: string;
}>,): void {
  if (!ctx.hasUI)
    return;

  /**
   * Whether a non-empty status should be shown.
   */
  const hasStatusText = statusText
    .length
    > 0;
  /**
   * Next footer status value; `undefined` tells Pi to clear this key.
   */
  const nextStatus = hasStatusText ? statusText : undefined;

  ctx
    .ui
    .setStatus(
      STATUS_KEY,
      nextStatus,
    );
}

/**
 * Clears footer status.
 *
 * @param ctx - Pi extension context
 *
 * @param log - tagged logger for lifecycle notes
 *
 * @example
 * ```ts
 * clearStatus({ ctx, log });
 * ```
 */
function clearStatus({
  ctx,
  log,
}: Readonly<{
  ctx: ExtensionContext;
  log: Logger;
}>,): void {
  setUsageStatus({
    ctx,
    statusText: '',
  },);
  log.debug('cleared usage warning status',);
}

//endregion UI helpers

//region Extension entry point

/**
 * Pi statusline extension.
 *
 * Subscribes to provider responses, samples Anthropic rate-limit headers, and
 * renders only the usage warning portion ported from the Claude Code statusline.
 *
 * @param pi - Pi extension API
 *
 * @example
 * ```typescript
 * // In ~/.pi/agent/settings.json:
 * { "packages": ["./packages/pi/statusline"] }
 * ```
 */
export default function statusline(pi: ExtensionAPI,): void {
  /**
   * Entry-point logger tagged by function name.
   */
  const log = tagged({
    tag: statusline.name,
    l: statuslineLogger,
  },);

  pi.on(
    'session_start',
    function handleSessionStart(
      _event,
      ctx,
    ) {
      clearStatus({
        ctx,
        log,
      },);
    },
  );

  pi.on(
    'session_shutdown',
    function handleSessionShutdown(
      _event,
      ctx,
    ) {
      clearStatus({
        ctx,
        log,
      },);
    },
  );

  pi.on(
    'after_provider_response',
    function handleAfterProviderResponse(
      event,
      ctx,
    ) {
      /**
       * Warning style hooks. Plain style keeps non-UI modes from touching theme state.
       */
      const style = ctx.hasUI
        ? styleFromContext(ctx,)
        : PLAIN_USAGE_WARNING_STYLE;
      /**
       * Formatted status from current provider response headers.
       */
      const result = formatUsageWarningStatus({
        headers: event.headers,
        nowMs: Date.now(),
        style,
      },);

      setUsageStatus({
        ctx,
        statusText: result.statusText,
      },);
      /**
       * Whether formatted status contains at least one visible warning.
       */
      const hasWarningStatus = result.statusText
        .length
        > 0;
      log.debug(
        `processed provider response status=${event.status} warnings=${hasWarningStatus}`,
      );
    },
  );
}

//endregion Extension entry point

export { STATUS_KEY, };
