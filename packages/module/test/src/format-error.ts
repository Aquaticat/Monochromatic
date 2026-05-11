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

/**
 * Substrings identifying harness-internal stack frames. Any frame
 * containing one of these is dropped before joining; the failing
 * user code is the interesting frame, not the harness's own
 * dispatch machinery.
 *
 * Both forms are listed because the package is consumed either as a
 * workspace package (path `packages/module/test/dist/`) or via
 * `node_modules` (path `module-test/dist/`).
 */
const HARNESS_INTERNAL_FRAGMENTS: readonly string[] = [
  'packages/module/test/dist/',
  'module-test/dist/',
];

/**
 * Walks up from the current working directory to the closest
 * ancestor containing `/packages/`, then returns that ancestor with
 * a trailing slash. This is the monorepo root for any pnpm workspace
 * laid out as `packages/<scope>/<pkg>/`.
 *
 * Falls back to the cwd itself (with trailing slash) when no
 * `/packages/` segment is in the path, so a consumer outside this
 * monorepo still gets a useful relative form.
 *
 * Returns the empty string when `process.cwd()` is unavailable
 * (browsers or restricted runtimes), which makes the strip a no-op.
 *
 * @returns trailing-slashed monorepo root, or empty string when
 *   unavailable
 */
function readWorkspacePrefix(): string {
  if (typeof process === 'undefined')
    return '';
  try {
    const cwd = process.cwd();
    const packagesIndex = cwd.indexOf('/packages/',);
    if (packagesIndex !== -1) {
      const root = cwd.slice(
        0,
        packagesIndex,
      );
      return `${root}/`;
    }
    return `${cwd}/`;
  }
  catch {
    return '';
  }
}

/**
 * Workspace prefix captured at module load. Stripped from stack
 * frame paths to produce cwd-relative output. Empty string in
 * browsers makes the strip a no-op.
 */
const WORKSPACE_PREFIX = readWorkspacePrefix();

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
  if ('message' in error && typeof error.message === 'string')
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
  if ('name' in error && typeof error.name === 'string' && error.name !== '')
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
 * Strips the captured workspace prefix from a frame so absolute
 * paths render as cwd-relative. No-op when the prefix is empty.
 *
 * @param frame - trimmed stack frame line
 *
 * @returns frame with workspace prefix removed where present
 */
function stripWorkspacePrefix(frame: string,): string {
  if (WORKSPACE_PREFIX === '')
    return frame;
  return frame.replaceAll(
    WORKSPACE_PREFIX,
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
 * @returns trimmed, prefix-stripped, harness-filtered stack frames;
 *   empty when `.stack` is missing or not a string
 *
 * @example
 * ```ts
 * readStackFrames({
 *   error: new Error('boom'),
 *   message: 'boom',
 * }) // ['at fn (packages/foo/file.ts:9:19)']
 * ```
 */
function readStackFrames({
  error,
  message,
}: {
  readonly error: object;
  readonly message: string;
},): readonly string[] {
  if (!('stack' in error) || typeof error.stack !== 'string')
    return [];
  const rawLines = error.stack.split('\n',);
  /**
   * V8 and JavaScriptCore prefix the stack with `ErrorName: message`
   * on the first line. Drop it so the caller does not show the
   * header twice; otherwise keep all lines.
   */
  const startIndex = rawLines[0] !== undefined && rawLines[0].includes(message,)
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
      return stripWorkspacePrefix(frame,);
    },);
}

/**
 * Recursively renders an error node and its descendants as one line
 * per error, with stack frames joined inline after the header for
 * grep-friendliness.
 *
 * Cycle-safe: visited error objects are tracked in a shared
 * {@link WeakSet}; on revisit, emits `... (cycle)` and stops the
 * recursion at that branch.
 *
 * @param headerPrefix - text prepended to the node's line
 *   (empty for the root, `Caused by: ` for a cause node, `[N/M] `
 *   for an aggregate member)
 *
 * @param value - error-like value at this node
 *
 * @param visited - shared cycle-detection set, mutated as the walk
 *   descends
 *
 * @returns one line for this node followed by lines for all of its
 *   descendants in walk order (cause first, then aggregate members)
 */
function formatNode({
  headerPrefix,
  value,
  visited,
}: {
  readonly headerPrefix: string;
  readonly value: unknown;
  readonly visited: WeakSet<object>;
},): readonly string[] {
  if (typeof value !== 'object' || value === null)
    return [`${headerPrefix}Threw non-Error value: ${safeString(value,)}`,];

  if (visited.has(value,))
    return [`${headerPrefix}... (cycle)`,];

  visited.add(value,);

  const message = readMessage(value,);
  const label = readErrorLabel(value,);
  const frames = readStackFrames({
    error: value,
    message,
  },);
  /**
   * Join frames with a single space so the whole error fits on one
   * line: `Error: boom at fn (file:9:19) at runFnOnce (...)`. Empty
   * stack contributes no trailing whitespace.
   */
  const framesInline = frames.length > 0
    ? ` ${frames.join(' ',)}`
    : '';
  const line = `${headerPrefix}${label}: ${message}${framesInline}`;

  const causeValue: unknown = 'cause' in value ? value.cause : undefined;
  const causeLines = causeValue !== undefined
    ? formatNode({
      headerPrefix: 'Caused by: ',
      value: causeValue,
      visited,
    },)
    : [];

  const errorsField: unknown = 'errors' in value ? value.errors : undefined;
  const errorLines: readonly string[] = Array.isArray(errorsField,)
    ? errorsField.flatMap(function formatAggregateMember(
      member,
      index,
    ) {
      return formatNode({
        headerPrefix: `[${String(index + 1,)}/${String(errorsField.length,)}] `,
        value: member,
        visited,
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
 * after a node's cause. Cycle-safe via a {@link WeakSet} of visited
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
 *   for (const line of formatErrorDeep(caught,))
 *     l.error(line,);
 * }
 * // emits:
 * //   Error: outer at fn (file:9:19) at runFnOnce (...)
 * //   Caused by: Error: root at root (file:5:1) at ...
 * ```
 */
export function formatErrorDeep(value: unknown,): readonly string[] {
  const visited = new WeakSet<object>();
  return formatNode({
    headerPrefix: '',
    value,
    visited,
  },);
}

/**
 * Fuses a `FAIL` summary with the formatted error chain into a
 * single multi-line string ready for one `l.error(...)` call.
 * The first error line (header plus inline stack frames) lands on
 * the summary line for grep-friendliness; subsequent cause lines
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
 *   l.error(formatFailure({
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
export function formatFailure({
  summary,
  value,
}: {
  readonly summary: string;
  readonly value: unknown;
},): string {
  const lines = formatErrorDeep(value,);
  if (lines.length === 0)
    return summary;
  const [first, ...rest] = lines;
  return [
    `${summary} ${first}`,
    ...rest,
  ].join('\n',);
}
