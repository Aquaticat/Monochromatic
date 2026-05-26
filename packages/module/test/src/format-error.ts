/**
 * Renders an error value and its `.cause` chain plus any
 * `AggregateError.errors` as an array of lines, one line per error
 * in the walk. Each line carries the error's header AND its stack
 * frames joined inline for grep-friendliness.
 *
 * Stack frames are cleaned before joining:
 *
 * - the current working directory prefix is stripped so absolute
 *   paths render as cwd-relative
 * - frames pointing into the harness's own bundle
 *   (`packages/module/test/dist/`) are filtered out, because they
 *   are noise for diagnosing user-test failures and the runtime's
 *   own tail dump still carries the unfiltered chain when needed
 *
 * The tagged logger prepends its tag prefix once per call. Callers
 * typically use {@link formatFailure} to fuse a `FAIL` summary with
 * the first error line into one record, so the tag lands only on the
 * summary; subsequent cause lines are untagged because readers
 * already know which suite/test the error belongs to from the
 * summary's tag.
 *
 * @module
 */

import { findMiseMonorepoRootCached, } from '@monochromatic-dev/module-fs-path';

/**
 * Substrings identifying stack frames that belong to the harness's
 * own dispatch machinery. Any frame containing one of these is
 * dropped before joining; the failing user code is the interesting
 * frame, not the layers under it.
 *
 * Two categories are listed:
 *
 * - The harness's own bundle, under two paths because consumers
 *   resolve it either as a workspace package
 *   (`packages/module/test/dist/`) or via `node_modules`
 *   (`module-test/dist/`).
 *
 * - The vendored assertion stack. `expect()` calls land in `chai`,
 *   which dispatches through the `chai-as-promised` and `sinon-chai`
 *   plugins activated in `expect-matchers.ts`, and `sinon` spies feed
 *   the sinon-chai matchers. These four are module/test's only
 *   consumers in the monorepo (no other package depends on chai or
 *   sinon), so any frame inside them on a failure path must come
 *   from the harness's assertion dispatch.
 *
 * Fragments are matched with substring `includes`, which collapses
 * pnpm's virtual store layout
 * (`node_modules/.pnpm/chai@6.2.2/node_modules/chai/index.js`) and
 * the flat / hoisted layout (`node_modules/chai/index.js`) under one
 * entry per package. The trailing slash on each package fragment
 * prevents `chai/` matching frames inside `chai-as-promised/` and
 * prevents `sinon/` matching `sinon-chai/`.
 */
const HARNESS_INTERNAL_FRAGMENTS: readonly string[] = [
  'packages/module/test/dist/',
  'module-test/dist/',
  'node_modules/chai/',
  'node_modules/chai-as-promised/',
  'node_modules/sinon-chai/',
  'node_modules/sinon/',
];

//region Workspace prefix resolution

/**
 * Resolves the monorepo root directory (with trailing slash) by
 * calling {@link findMiseMonorepoRootCached} from
 * `@monochromatic-dev/module-fs-path`. The shared cached variant
 * memoises the result process-wide, so no local cache is needed.
 * Falls back to `process.cwd()` when the cached variant rejects
 * (no `mise.toml` with `[monorepo]` found, browser without
 * filesystem, etc.), and to the empty string when `process.cwd()`
 * is also unavailable.
 *
 * Imports from module-fs-path create a workspace cycle (module-test
 * is in module-fs-path's devDependencies); accepted because the
 * cycle is build-time only and does not affect runtime resolution.
 *
 * @returns trailing-slashed monorepo root, cwd prefix, or empty
 *   string when unavailable
 */
async function resolveWorkspacePrefix(): Promise<string> {
  try {
    /** Captured root so the trailing slash can be appended exactly once before returning. */
    const root = await findMiseMonorepoRootCached();
    return `${root}/`;
  }
  catch {
    /**
     * The cached variant rejected (no mise.toml with [monorepo],
     * browser without OPFS, etc.) and caches the rejection, so the
     * fallback path runs on every call. Compute the cwd-based prefix
     * directly; `process.cwd()` is cheap (single syscall).
     */
    if ((typeof process) === 'undefined')
      return '';
    try {
      return `${process.cwd()}/`;
    }
    catch {
      return '';
    }
  }
}

//endregion Workspace prefix resolution

/**
 * Safely stringifies an arbitrary value for inline display.
 * Wraps `String(value)` so trapped getters or cross-realm objects
 * cannot derail logging.
 *
 * @param value - value to render
 *
 * @returns single-line string description, or `<unrepresentable>`
 *   when stringification throws
 *
 * @example
 * ```ts
 * safeString('boom') // 'boom'
 * safeString(42)     // '42'
 * safeString(null)   // 'null'
 * ```
 */
function safeString(value: unknown,): string {
  try {
    return String(value,);
  }
  catch {
    return '<unrepresentable>';
  }
}

/**
 * Extracts the message string from an error-like object.
 * Falls back to `<unknown message>` when the field is missing or
 * not a string.
 *
 * @param error - error-like object whose `.message` to read
 *
 * @returns message string or fallback marker
 *
 * @example
 * ```ts
 * readMessage(new Error('boom')) // 'boom'
 * readMessage({})                // '<unknown message>'
 * readMessage({ message: 42 })   // '<unknown message>'
 * ```
 */
function readMessage(error: object,): string {
  if (('message' in error) && ((typeof error.message) === 'string'))
    return error.message;
  return '<unknown message>';
}

/**
 * Extracts the class label from an error-like object's `.name`.
 * Falls back to `Error` when missing or not a non-empty string.
 *
 * @param error - error-like object whose `.name` to read
 *
 * @returns class label such as `TypeError`, `AggregateError`, or
 *   `Error` as the default
 *
 * @example
 * ```ts
 * readErrorLabel(new TypeError('x')) // 'TypeError'
 * readErrorLabel({})                 // 'Error'
 * ```
 */
function readErrorLabel(error: object,): string {
  if (('name' in error) && ((typeof error.name) === 'string')
    && (error.name
      !== ''))
    return error.name;
  return 'Error';
}

/**
 * True when the frame points into the harness's own bundle.
 * Harness frames are filtered out before joining because they add
 * noise to every failure trace; the failing user code is the
 * interesting site.
 *
 * @param frame - trimmed stack frame line
 *
 * @returns whether the frame should be dropped
 */
function isHarnessInternalFrame(frame: string,): boolean {
  return HARNESS_INTERNAL_FRAGMENTS.some(function frameContains(fragment,) {
    return frame.includes(fragment,);
  },);
}

/**
 * Strips the resolved workspace prefix from a frame so absolute
 * paths render as cwd-relative. No-op when the prefix is empty.
 *
 * @param frame - trimmed stack frame line
 *
 * @param workspacePrefix - resolved prefix from
 *   {@link resolveWorkspacePrefix}
 *
 * @returns frame with workspace prefix removed where present
 */
function stripWorkspacePrefix({
  frame,
  workspacePrefix,
}: {
  readonly frame: string;
  readonly workspacePrefix: string;
},): string {
  if (workspacePrefix === '')
    return frame;
  return frame.replaceAll(
    workspacePrefix,
    '',
  );
}

/**
 * Splits an error's `.stack` into trimmed non-empty frames, dropping
 * the first line when it duplicates the `ErrorName: message` header
 * (the runtime convention on V8 and JavaScriptCore). Strips the
 * workspace prefix from each frame and filters out frames pointing
 * into the harness's own bundle.
 *
 * @param error - error-like object whose `.stack` to read
 *
 * @param message - already-extracted message used to detect the
 *   header-duplicate first line
 *
 * @param workspacePrefix - resolved prefix from
 *   {@link resolveWorkspacePrefix}
 *
 * @returns trimmed, prefix-stripped, harness-filtered stack frames;
 *   empty when `.stack` is missing or not a string
 *
 * @example
 * ```ts
 * await readStackFrames({
 *   error: new Error('boom'),
 *   message: 'boom',
 *   workspacePrefix: '/var/home/user/Monochromatic/',
 * }) // ['at fn (packages/foo/file.ts:9:19)']
 * ```
 */
function readStackFrames({
  error,
  message,
  workspacePrefix,
}: {
  readonly error: object;
  readonly message: string;
  readonly workspacePrefix: string;
},): readonly string[] {
  if ((!('stack' in error)) || ((typeof error.stack) !== 'string'))
    return [];
  /** Raw newline-split stack lines, before header-line trimming and per-frame cleanup. */
  const rawLines = error.stack
    .split('\n',);
  /**
   * V8 and JavaScriptCore prefix the stack with `ErrorName: message`
   * on the first line. Drop it so the caller does not show the
   * header twice; otherwise keep all lines.
   */
  const startIndex = (rawLines[0]
    !== undefined)
    && rawLines[0]
    .includes(message,)
    ? 1
    : 0;
  return rawLines
    .slice(startIndex,)
    .map(function trimLine(line,) {
      return line.trim();
    },)
    .filter(function nonEmpty(line,) {
      return line !== '';
    },)
    .filter(function notHarnessInternal(frame,) {
      /**
       * Filter using the un-stripped path so the fragment matches
       * the workspace-qualified `packages/module/test/dist/` and the
       * node_modules-qualified `module-test/dist/` consistently.
       */
      return !isHarnessInternalFrame(frame,);
    },)
    .map(function applyWorkspaceStrip(frame,) {
      return stripWorkspacePrefix({
        frame,
        workspacePrefix,
      },);
    },);
}

/**
 * Recursively renders an error node and its descendants as one line
 * per error, with stack frames joined inline after the header for
 * grep-friendliness.
 *
 * Cycle-safe: ancestor error objects are tracked in a `Set` threaded
 * by value down each descent; on revisit, emits `... (cycle)` and stops
 * the recursion at that branch.
 *
 * @param headerPrefix - text prepended to the node's line
 *   (empty for the root, `Caused by: ` for a cause node, `[N/M] `
 *   for an aggregate member)
 *
 * @param value - error-like value at this node
 *
 * @param visited - ancestor cycle-detection set; each descent threads a
 *   fresh copy extended with the current node rather than mutating it
 *
 * @param workspacePrefix - resolved prefix from
 *   {@link resolveWorkspacePrefix}
 *
 * @returns one line for this node followed by lines for all of its
 *   descendants in walk order (cause first, then aggregate members)
 */
function formatNode({
  headerPrefix,
  value,
  visited,
  workspacePrefix,
}: {
  readonly headerPrefix: string;
  readonly value: unknown;
  readonly visited: ReadonlySet<object>;
  readonly workspacePrefix: string;
},): readonly string[] {
  if (((typeof value) !== 'object') || (value === null))
    return [`${headerPrefix}Threw non-Error value: ${safeString(value,)}`,];

  if (visited.has(value,))
    return [`${headerPrefix}... (cycle)`,];

  /**
   * Fresh ancestor set extended with the current node, threaded into the
   * recursive calls instead of mutating `visited`. A self-referential or
   * ancestor `.cause` is still detected on revisit; bounded by error
   * nesting depth, so the per-level copy stays small.
   */
  const visitedWithCurrent = new Set([
    ...visited,
    value,
  ],);

  /** Extracted message kept in a local so it can be reused for header construction and stack-header trimming. */
  const message = readMessage(value,);
  /** Class label rendered ahead of the message; held in a local for the same reason as `message`. */
  const label = readErrorLabel(value,);
  /** Cleaned stack frames produced once per node so the cause and aggregate branches both see the same set. */
  const frames = readStackFrames({
    error: value,
    message,
    workspacePrefix,
  },);
  /**
   * Join frames with a single space so the whole error fits on one
   * line: `Error: boom at fn (file:9:19) at runFnOnce (...)`. Empty
   * stack contributes no trailing whitespace.
   */
  const framesInline = frames.length
    > 0
    ? ` ${frames.join(' ',)}`
    : '';
  /** Composed header-plus-frames string for this node, prepended to the descendants in the return list. */
  const line = `${headerPrefix}${label}: ${message}${framesInline}`;

  /** Cause value pulled out so the recursion only runs once when a cause exists. */
  const causeValue: unknown = 'cause' in value ? value.cause : undefined;
  /** Recursively rendered cause subtree, kept separate from `errorLines` so cause precedes aggregate members. */
  const causeLines = causeValue !== undefined
    ? formatNode({
      headerPrefix: 'Caused by: ',
      value: causeValue,
      visited: visitedWithCurrent,
      workspacePrefix,
    },)
    : [];

  /** `errors` field pulled out so the array check and subsequent iteration both refer to the same captured value. */
  const errorsField: unknown = 'errors' in value ? value.errors : undefined;
  /** Recursively rendered aggregate members, appended after `causeLines` to keep walk order stable. */
  const errorLines: readonly string[] = Array.isArray(errorsField,)
    ? errorsField.flatMap(function formatAggregateMember(
      member,
      index,
    ) {
      return formatNode({
        headerPrefix: `[${String(index + 1,)}/${String(errorsField.length,)}] `,
        value: member,
        visited: visitedWithCurrent,
        workspacePrefix,
      },);
    },)
    : [];

  return [
    line,
    ...causeLines,
    ...errorLines,
  ];
}

/**
 * Renders a thrown value and its `.cause` chain plus any
 * `AggregateError.errors` as an array of single-line strings, one
 * per error in the walk. Each line is
 * `[prefix]<label>: <message> <frames>` so the whole error sits on
 * one line and `grep` matches by message, class, or frame.
 *
 * Walks the cause chain depth-first, then expands aggregate members
 * after a node's cause. Cycle-safe via a `Set` of ancestor visited
 * error objects; on revisit, emits `... (cycle)` and stops descending
 * at that branch.
 *
 * Non-Error throws (`throw 'oops'`, `throw 42`, `throw null`) render
 * as a single `Threw non-Error value: ...` line. Missing `.message`
 * renders as `<unknown message>`. Missing `.stack` contributes no
 * frames.
 *
 * @param value - thrown value of unknown shape
 *
 * @returns single-line strings; see {@link formatFailure} for the
 *   common pattern of fusing the first line with a `FAIL` summary
 *
 * @example
 * ```ts
 * try {
 *   throw new Error('outer', { cause: new Error('root', ), },);
 * }
 * catch (caught) {
 *   for (const line of await formatErrorDeep(caught,))
 *     l.error(line,);
 * }
 * // emits:
 * //   Error: outer at fn (file:9:19) at runFnOnce (...)
 * //   Caused by: Error: root at root (file:5:1) at ...
 * ```
 */
export async function formatErrorDeep(value: unknown,): Promise<readonly string[]> {
  /** Empty seed ancestor set; each `formatNode` descent threads a fresh extended copy so a self-referential `.cause` does not recurse forever. */
  const visited = new Set<object>();
  /** Resolved once per top-level walk so all descendants see the same prefix. */
  const workspacePrefix = await resolveWorkspacePrefix();
  return formatNode({
    headerPrefix: '',
    value,
    visited,
    workspacePrefix,
  },);
}

/**
 * Fuses a `FAIL` summary with the formatted error chain into a
 * single multi-line string ready for one `l.error(...)` call.
 * The first error line (header plus inline stack frames) lands on the
 * summary line for grep-friendliness; subsequent cause lines
 * follow as newline-separated continuation. The tagged logger then
 * prefixes its tag onto the summary line only; continuation lines
 * remain untagged.
 *
 * @param summary - the `FAIL...` summary (e.g. `FAIL (5ms)`)
 *
 * @param value - thrown value to format
 *
 * @returns multi-line string suitable for `l.error(result)`
 *
 * @example
 * ```ts
 * try {
 *   throw new Error('outer', {
 *     cause: new Error('inner', { cause: new Error('root', ), }, ),
 *   },);
 * }
 * catch (caught) {
 *   l.error(await formatFailure({
 *     summary: `FAIL (${String(durationMs,)}ms)`,
 *     value: caught,
 *   },),);
 * }
 * // emits (with [tag] applied only to line 1):
 * //   [tag] FAIL (5ms) Error: outer at fn (file:9:19) at runFnOnce (...)
 * //   Caused by: Error: inner at otherFn (...) at ...
 * //   Caused by: Error: root at root (...) at ...
 * ```
 */
export async function formatFailure({
  summary,
  value,
}: {
  readonly summary: string;
  readonly value: unknown;
},): Promise<string> {
  /** Walked error chain reused across the empty-check and the summary fusion. */
  const lines = await formatErrorDeep(value,);
  if (lines.length
    === 0)
    return summary;
  /** First line is fused onto the summary so the tagged logger's prefix only renders once. */
  const [first, ...rest] = lines;
  return [
    `${summary} ${first}`,
    ...rest,
  ]
    .join('\n',);
}
