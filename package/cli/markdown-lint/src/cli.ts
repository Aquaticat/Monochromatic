#!/usr/bin/env node
import type { ReporterName, } from './reporters.ts';
import { run, } from './run.ts';

export {};

/**
 * Prefix on `--format=` arguments, sliced off to read the reporter name.
 */
const FORMAT_PREFIX = '--format=';

/**
 * Help text printed for `--help`.
 */
const HELP = `markdown-lint - lint Markdown and MDX

Usage:
  markdown-lint [options] [paths...]

Paths may be files or directories. With no path, the current directory is
walked, honouring .gitignore. Only .md and .mdx files are read.

Options:
  --fix            Apply fixes in place; report only what stays unfixed.
  --format=<name>  Reporter: pretty (default) or json.
  --json           Shorthand for --format=json.
  --help, -h       Show this help.

Exit codes:
  0  No unfixed violations.
  1  Unfixed violations remain.
  2  Usage error.`;

/**
 * Error raised for a bad command line, distinct from a lint failure so the CLI
 * can exit with the usage code rather than the violations code.
 */
class CliUsageError extends Error {
  /**
   * Construct a usage error.
   *
   * @param message - description of the misuse
   *
   * @example
   * ```ts
   * throw new CliUsageError('Unknown option: --bogus');
   * ```
   */
  constructor(message: string,) {
    super(message,);
    this.name = 'CliUsageError';
  }
}

/**
 * Known option flags; `--format=<name>` is matched separately by prefix.
 */
const KNOWN_FLAGS: ReadonlySet<string> = new Set([
  '--fix',
  '--help',
  '-h',
  '--json',
],);

/**
 * Validate a reporter name from the command line.
 *
 * @param value - raw `--format=` value
 *
 * @returns validated reporter name
 *
 * @throws {@link CliUsageError} when the value is not a known reporter
 */
function parseReporter(value: string,): ReporterName {
  if ((value === 'pretty') || (value === 'json')) {
    return value;
  }
  throw new CliUsageError(`Unknown --format value: ${value}. Use pretty or json.`,);
}

/**
 * Resolve the reporter from the flag list: `--json` wins, then `--format=<name>`,
 * otherwise the pretty default.
 *
 * @param flags - flag tokens (those starting with `-`)
 *
 * @returns chosen reporter
 *
 * @throws {@link CliUsageError} when a `--format=` value is not a known reporter
 */
function deriveReporter(flags: readonly string[],): ReporterName {
  if (flags.includes('--json',)) {
    return 'json';
  }
  /**
   * First `--format=<name>` flag, if any.
   */
  const formatFlag = flags.find(function isFormatFlag(flag: string,): boolean {
    return flag.startsWith(FORMAT_PREFIX,);
  },);
  if (formatFlag === undefined) {
    return 'pretty';
  }
  return parseReporter(formatFlag.slice(FORMAT_PREFIX.length,),);
}

/**
 * Parsed command line: the paths to lint and the chosen behavior.
 */
type ParsedArgs = {
  /**
   * Path arguments.
   */
  readonly paths: readonly string[];
  /**
   * Whether `--fix` was given.
   */
  readonly fix: boolean;
  /**
   * Chosen reporter.
   */
  readonly reporter: ReporterName;
  /**
   * Whether help was requested.
   */
  readonly help: boolean;
};

/**
 * Parse argv (after the runtime and script name) into structured options. Flags
 * and positionals are partitioned by leading `-`; every flag must be known.
 *
 * @param argv - raw arguments after the script name
 *
 * @returns parsed options
 *
 * @throws {@link CliUsageError} on an unknown option
 */
function parseArgs(argv: readonly string[],): ParsedArgs {
  /**
   * Flag tokens (those starting with `-`).
   */
  const flags = argv.filter(function isFlag(arg: string,): boolean {
    return arg.startsWith('-',);
  },);
  /**
   * Positional path tokens.
   */
  const paths = argv.filter(function isPositional(arg: string,): boolean {
    return !arg.startsWith('-',);
  },);
  /**
   * First unrecognized flag, if any.
   */
  const unknown = flags.find(function isUnknownFlag(flag: string,): boolean {
    return !(KNOWN_FLAGS.has(flag,) || flag.startsWith(FORMAT_PREFIX,));
  },);
  if (unknown !== undefined) {
    throw new CliUsageError(`Unknown option: ${unknown}. Run markdown-lint --help.`,);
  }
  return {
    paths,
    fix: flags.includes('--fix',),
    reporter: deriveReporter(flags,),
    help: flags.includes('--help',) || flags.includes('-h',),
  };
}

/**
 * Entry point: parse arguments, lint or fix, print the report, and set the
 * process exit code. Usage errors exit with code 2; remaining violations exit
 * with code 1; a clean run exits 0.
 */
async function main(): Promise<void> {
  /**
   * Parsed command-line options.
   */
  const args = parseArgs(process.argv
    .slice(2,),);
  if (args.help) {
    // User-facing help on stdout.
    console.log(HELP,);
    return;
  }
  /**
   * Lint or fix result.
   */
  const result = await run({
    paths: args.paths,
    fix: args.fix,
    reporter: args.reporter,
    cwd: process.cwd(),
  },);
  if (result.output !== '') {
    // The report is the machine-readable output: stdout, kept clean for pipes.
    console.log(result.output,);
  }
  if (args.fix && (result.fixedFiles > 0)) {
    // Fix summary is a status line, not the report: stderr so stdout stays clean.
    console.error(`markdown-lint: fixed ${result.fixedFiles} file(s)`,);
  }
  if (result.hadViolations) {
    process.exitCode = 1;
  }
}

try {
  await main();
} catch (error) {
  if (error instanceof CliUsageError) {
    // User-facing usage error: stderr.
    console.error(`markdown-lint: ${error.message}`,);
    process.exitCode = 2;
  } else {
    throw error;
  }
}
