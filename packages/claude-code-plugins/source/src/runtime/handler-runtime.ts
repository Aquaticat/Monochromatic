import { text, } from 'node:stream/consumers';

/**
 * Parser converts the raw stdin string into the typed event the handler consumes.
 *
 * @example
 * ```ts
 * const parser: Parser<PreToolUseInput> = function jsonParser(raw): PreToolUseInput {
 *   return parseHookJson<PreToolUseInput>(raw);
 * };
 * ```
 */
type Parser<TInput,> = (raw: string,) => TInput;

/**
 * Parses raw JSON into a typed value.
 *
 * Centralizes the unsafe cast used by every hook parser so each call site
 * stays trivial and the trust boundary is documented in one place. Inputs
 * come from Claude Code's hook dispatch system or from JSON files written
 * by sibling hooks in this package; both are trusted by contract.
 *
 * @param raw - serialized JSON payload from stdin or a trusted file
 *
 * @returns parsed value, cast to `T`
 *
 * @example
 * ```ts
 * const event = parseHookJson<UserPromptSubmitInput>(raw);
 * ```
 */
function parseHookJson<T,>(raw: string,): T {
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- trusted JSON contract: caller's type parameter is the documented schema
  return JSON.parse(raw,) as T;
}

/**
 * Handler is the pure function at the heart of every hook plugin.
 *
 * Receives a parsed event and returns the response payload.
 * Synchronous or async; the runtime awaits the result.
 */
type HookHandler<TInput, TOutput,> = (input: TInput,) => TOutput | Promise<TOutput>;

/**
 * Writer serializes the handler output for stdout.
 *
 * Returns a string written verbatim; no trailing newline is appended,
 * matching the wire convention Claude Code expects.
 */
type Writer<TOutput,> = (output: TOutput,) => string;

/**
 * Runtime shell for a hook plugin entry script.
 *
 * Reads stdin to EOF, runs the parser, dispatches to the handler,
 * and writes the writer's serialized result to stdout.
 *
 * Each generated per-plugin entry script consists of importing the handler,
 * parser, and writer for that plugin and calling `runHookPlugin` once at the
 * top level.
 *
 * @example
 * ```ts
 * #!/usr/bin/env bun
 * import { runHookPlugin } from '../runtime/handler-runtime.ts';
 * import { guardrailHandler, guardrailParser, guardrailWriter } from '../handlers/guardrail.ts';
 * await runHookPlugin({
 *   parser: guardrailParser,
 *   handler: guardrailHandler,
 *   writer: guardrailWriter,
 * });
 * ```
 */
async function runHookPlugin<TInput, TOutput,>(
  {
    parser,
    handler,
    writer,
  }: {
    readonly parser: Parser<TInput>;
    readonly handler: HookHandler<TInput, TOutput>;
    readonly writer: Writer<TOutput>;
  },
): Promise<void> {
  /** Full stdin payload from Claude Code, awaited to EOF before parsing. */
  const raw = await text(process.stdin,);
  /** Parsed hook event passed to the plugin handler below. */
  const event = parser(raw,);
  /** Handler response; serialized by the writer for stdout. */
  const output = await handler(event,);
  process.stdout
    .write(writer(output,),);
}

export type {
  HookHandler,
  Parser,
  Writer,
};

export {
  parseHookJson,
  runHookPlugin,
};
