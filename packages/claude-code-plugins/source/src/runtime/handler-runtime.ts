import { text, } from 'node:stream/consumers';

/**
 * Parser converts the raw stdin string into the typed event the handler consumes.
 *
 * Each parser asserts the trusted JSON shape at its own boundary; inputs come
 * from Claude Code's hook dispatch system or from JSON files written by sibling
 * hooks in this package, both trusted by contract.
 *
 * @example
 * ```ts
 * const parser: Parser<PreToolUseInput> = function jsonParser(raw): PreToolUseInput {
 *   // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- trusted JSON contract from Claude Code hook system
 *   return JSON.parse(raw) as PreToolUseInput;
 * };
 * ```
 */
type Parser<TInput,> = (raw: string,) => TInput;

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
 * #!/usr/bin/env node
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
  /**
   * Full stdin payload from Claude Code, awaited to EOF before parsing.
   */
  const raw = await text(process.stdin,);
  /**
   * Parsed hook event passed to the plugin handler below.
   */
  const event = parser(raw,);
  /**
   * Handler response; serialized by the writer for stdout.
   */
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
  runHookPlugin,
};
