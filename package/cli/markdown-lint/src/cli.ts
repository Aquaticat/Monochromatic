#!/usr/bin/env node
import { text, } from 'node:stream/consumers';

import type { ReporterName, } from './reporters.ts';
import { rulesById, } from './rule/index.ts';
import {
  run,
  runStdin,
  StdinPathError,
} from './run.ts';



/**
 Prefix on `--format=` arguments, sliced off to read the reporter name.
 */
const FORMAT_PREFIX = '--format=';

/**
 Prefix on `--lfs-image-exclude=` arguments, sliced off to read one
 gitignore-syntax pattern the `lfs-image-url` rule must skip.
 */
const LFS_IMAGE_EXCLUDE_PREFIX = '--lfs-image-exclude=';

/**
 Prefix on `--stdin-path=` arguments, sliced off to read the path standard
 input is linted as.
 */
const STDIN_PATH_PREFIX = '--stdin-path=';

/**
 Prefix on `--rule=` arguments, sliced off to read one rule id to run.
 */
const RULE_PREFIX = '--rule=';

/**
 Help text printed for `--help`.
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
  --lfs-image-exclude=<pattern>
                   Skip the lfs-image-url rule for files matching this
                   gitignore-syntax pattern (relative to the repository
                   root); repeatable.
  --rule=<id>      Run only this rule; repeatable. Default: every rule.
  --stdin-path=<path>
                   Lint standard input as if it were the file at <path>
                   (relative to the working directory) instead of walking
                   paths. With --fix, the fixed source is written to stdout
                   and the report to stderr.
  --help, -h       Show this help.

Exit codes:
  0  No unfixed violations.
  1  Unfixed violations remain.
  2  Usage error.`;

/**
 Error raised for a bad command line, distinct from a lint failure so the CLI
 can exit with the usage code rather than the violations code.
 */
class CliUsageError extends Error {
  /**
   Construct a usage error.
   
   @param message - description of the misuse
   
   @param options - optional cause, carried from the runner's own error
   
   @example
   ```ts
   throw new CliUsageError('Unknown option: --bogus');
   ```
   */
  constructor(
    message: string,
    options?: ErrorOptions,
  ) {
    super(
      message,
      options,
    );
    this.name = 'CliUsageError';
  }
}

/**
 Known option flags; `--format=<name>` is matched separately by prefix.
 */
const KNOWN_FLAGS: ReadonlySet<string> = new Set([
  '--fix',
  '--help',
  '-h',
  '--json',
],);

/**
 Validate a reporter name from the command line.
 
 @param value - raw `--format=` value
 
 @returns validated reporter name
 
 @throws {@link CliUsageError} when the value is not a known reporter
 */
function parseReporter(value: string,): ReporterName {
  if ((value === 'pretty') || (value === 'json')) {
    return value;
  }
  throw new CliUsageError(`Unknown --format value: ${value}. Use pretty or json.`,);
}

/**
 Resolve the reporter from the flag list: `--json` wins, then `--format=<name>`,
 otherwise the pretty default.
 
 @param flags - flag tokens (those starting with `-`)
 
 @returns chosen reporter
 
 @throws {@link CliUsageError} when a `--format=` value is not a known reporter
 */
function deriveReporter(flags: readonly string[],): ReporterName {
  if (flags.includes('--json',)) {
    return 'json';
  }
  /**
   First `--format=<name>` flag, if any.
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
 Parsed command line: the paths to lint and the chosen behavior.
 */
type ParsedArgs = {
  /**
   Path arguments.
   */
  readonly paths: readonly string[];
  /**
   Whether `--fix` was given.
   */
  readonly fix: boolean;
  /**
   Chosen reporter.
   */
  readonly reporter: ReporterName;
  /**
   Whether help was requested.
   */
  readonly help: boolean;
  /**
   Exclude patterns for the `lfs-image-url` rule.
   */
  readonly lfsImageExclude: readonly string[];
  /**
   Rule ids to run; empty runs every rule.
   */
  readonly ruleIds: readonly string[];
  /**
   Standard-input path, at most one.
   */
  readonly stdinPaths: readonly string[];
};

/**
 Parse argv (after the runtime and script name) into structured options. Flags
 and positionals are partitioned by leading `-`; every flag must be known.
 
 @param argv - raw arguments after the script name
 
 @returns parsed options
 
 @throws {@link CliUsageError} on an unknown option
 */
function parseArgs(argv: readonly string[],): ParsedArgs {
  /**
   Flag tokens (those starting with `-`).
   */
  const flags = argv.filter(function isFlag(arg: string,): boolean {
    return arg.startsWith('-',);
  },);
  /**
   Positional path tokens.
   */
  const paths = argv.filter(function isPositional(arg: string,): boolean {
    return !arg.startsWith('-',);
  },);
  /**
   First unrecognized flag, if any.
   */
  const unknown = flags.find(function isUnknownFlag(flag: string,): boolean {
    return !(KNOWN_FLAGS.has(flag,) || flag.startsWith(FORMAT_PREFIX,)
      || flag.startsWith(LFS_IMAGE_EXCLUDE_PREFIX,)
      || flag.startsWith(STDIN_PATH_PREFIX,)
      || flag.startsWith(RULE_PREFIX,));
  },);
  if (unknown !== undefined) {
    throw new CliUsageError(`Unknown option: ${unknown}. Run markdown-lint --help.`,);
  }
  /**
   Exclude patterns for the `lfs-image-url` rule, in flag order.
   */
  const lfsImageExclude = flags
    .filter(function isExcludeFlag(flag: string,): boolean {
      return flag.startsWith(LFS_IMAGE_EXCLUDE_PREFIX,);
    },)
    .map(function patternOf(flag: string,): string {
      return flag.slice(LFS_IMAGE_EXCLUDE_PREFIX.length,);
    },);
  if (lfsImageExclude.includes('',)) {
    throw new CliUsageError('Empty --lfs-image-exclude= pattern. Run markdown-lint --help.',);
  }
  /**
   Rule ids to run, in flag order.
   */
  const ruleIds = flags
    .filter(function isRuleFlag(flag: string,): boolean {
      return flag.startsWith(RULE_PREFIX,);
    },)
    .map(function ruleOf(flag: string,): string {
      return flag.slice(RULE_PREFIX.length,);
    },);
  /**
   First rule id the registry does not know, if any.
   */
  const unknownRule = ruleIds.find(function isUnknownRule(id: string,): boolean {
    return !rulesById.has(id,);
  },);
  if (unknownRule !== undefined) {
    throw new CliUsageError(`Unknown --rule value: ${unknownRule}. Known rules: ${[...rulesById.keys(),].join(', ',)}.`,);
  }
  /**
   Standard-input paths, at most one.
   */
  const stdinPaths = flags
    .filter(function isStdinFlag(flag: string,): boolean {
      return flag.startsWith(STDIN_PATH_PREFIX,);
    },)
    .map(function pathOf(flag: string,): string {
      return flag.slice(STDIN_PATH_PREFIX.length,);
    },);
  if (stdinPaths.length > 1) {
    throw new CliUsageError('At most one --stdin-path= is accepted. Run markdown-lint --help.',);
  }
  if (stdinPaths.includes('',)) {
    throw new CliUsageError('Empty --stdin-path= value. Run markdown-lint --help.',);
  }
  if ((stdinPaths.length === 1) && (paths.length > 0)) {
    throw new CliUsageError('--stdin-path= cannot be combined with path arguments. Run markdown-lint --help.',);
  }
  return {
    paths,
    fix: flags.includes('--fix',),
    reporter: deriveReporter(flags,),
    help: flags.includes('--help',) || flags.includes('-h',),
    lfsImageExclude,
    ruleIds,
    stdinPaths,
  };
}

/**
 Lint or fix standard input as one file, printing the fixed source to stdout
 in fix mode (with the report on stderr) and the report to stdout otherwise.

 @param args - parsed options, with exactly one standard-input path

 @param stdinPath - path the source is linted as

 @throws {@link CliUsageError} when the path is not Markdown or MDX
 */
async function mainStdin({
  args,
  stdinPath,
}: {
  readonly args: ParsedArgs;
  readonly stdinPath: string;
},): Promise<void> {
  try {
    /**
     Lint or fix result for the piped source.
     */
    const result = await runStdin({
      stdinPath,
      source: await text(process.stdin,),
      fix: args.fix,
      reporter: args.reporter,
      cwd: process.cwd(),
      lfsImageExclude: args.lfsImageExclude,
      ruleIds: args.ruleIds,
    },);
    if (args.fix) {
      // The fixed source is the machine-readable output in fix mode: stdout.
      process.stdout
        .write(result.fixedSource,);
      if (result.output !== '') {
        // The report moves to stderr so stdout stays the fixed source.
        console.error(result.output,);
      }
    }
    else if (result.output !== '') {
      // Without fix the report is the output: stdout, kept clean for pipes.
      console.log(result.output,);
    }
    if (result.hadViolations) {
      process.exitCode = 1;
    }
  }
  catch (error) {
    if (error instanceof StdinPathError) {
      throw new CliUsageError(
        error.message,
        { cause: error, },
      );
    }
    throw error;
  }
}

/**
 Entry point: parse arguments, lint or fix, print the report, and set the
 process exit code. Usage errors exit with code 2; remaining violations exit
 with code 1; a clean run exits 0.
 */
async function main(): Promise<void> {
  /**
   Parsed command-line options.
   */
  const args = parseArgs(process.argv
    .slice(2,),);
  if (args.help) {
    // User-facing help on stdout.
    console.log(HELP,);
    return;
  }
  /**
   Standard-input path, when the caller pipes one source.
   */
  const [stdinPath,] = args.stdinPaths;
  if (stdinPath !== undefined) {
    await mainStdin({
      args,
      stdinPath,
    },);
    return;
  }
  /**
   Lint or fix result.
   */
  const result = await run({
    paths: args.paths,
    fix: args.fix,
    reporter: args.reporter,
    cwd: process.cwd(),
    lfsImageExclude: args.lfsImageExclude,
    ruleIds: args.ruleIds,
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
