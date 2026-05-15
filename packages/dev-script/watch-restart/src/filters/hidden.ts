import type {
  WatchCtx,
  WatchEvent,
  WatchFilter,
} from '../types.ts';

/**
 * Matches paths whose any segment starts with a literal `.` followed by
 * a non-separator non-dot character (i.e. an actual hidden file or
 * directory: `.swp`, `.cache`, `.config.ts`).
 *
 * Pattern reads: "start-of-string or separator, then literal `.`, then a
 * character that is neither `.` nor a separator." That admits `.foo`,
 * `path/.git/index`, `.cache/data` while excluding the path navigators
 * `.` (alone) and `..` (the second `.` after `\.` would have to be a
 * non-dot to qualify; `..` does not).
 *
 * Supports both `/` and `\` separators so a path observed on a Windows
 * checkout (`src\.swp`) still matches without callers normalising first.
 * Compiled once at module scope; the hot path on every event runs a
 * single `RegExp.test` call.
 */
const HIDDEN_SEGMENT_PATTERN: RegExp = new RegExp(
  String.raw`(?:^|[/\\])\.[^./\\]`,
);

/**
 * Builds a {@link WatchFilter} that rejects events whose `relativePath`
 * contains any hidden segment (a segment starting with `.`), unless the
 * caller opts hidden files in via `allowHidden: true`.
 *
 * Default-off (rejection mode) matches the `fd` / `rg` ergonomics noted
 * in the plan and avoids spurious restarts when an editor writes a `.swp`
 * swap file, a build emits a `.cache/` directory, or `.git/index`
 * updates after a checkout; events that have nothing to do with the
 * source the dev loop is watching.
 *
 * `allowHidden: true` collapses to a vacuous pass-all; the orchestrator
 * additionally elides this filter entirely from the chain when
 * `options.hidden === true`, so the runtime cost is exactly zero in that
 * mode. The helper still accepts the toggle so library consumers can
 * build a hiddenFilter whose behavior can be inspected by the option
 * without rebuilding the chain.
 *
 * Matching is over {@link WatchEvent.relativePath} (relative to the
 * deepest matching watch root), not the absolute path; this keeps the
 * predicate workspace-portable and consistent with {@link globFilter}
 * and {@link regexFilter}.
 *
 * @returns watch filter that drops hidden-segment events when allowHidden is off
 *
 * @example
 * ```ts
 * const filter = hiddenFilter({},);
 * filter({ event: { relativePath: '.config.ts', ... }, ctx, },); // false
 * filter({ event: { relativePath: 'src/foo.ts', ... }, ctx, },); // true
 * filter({ event: { relativePath: 'src/.cache/x', ... }, ctx, },); // false
 * ```
 */
export function hiddenFilter(
  {
    allowHidden = false,
  }: {
    readonly allowHidden?: boolean;
  } = {},
): WatchFilter {
  return function hiddenFilterFn(
    {
      event,
    }: {
      readonly event: WatchEvent;
      readonly ctx: WatchCtx;
    },
  ): boolean {
    if (allowHidden)
      return true;
    return !HIDDEN_SEGMENT_PATTERN.test(event.relativePath,);
  };
}
