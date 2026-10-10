// Generated from `package/git-policy/markdown-lint/src/run-linter.ts` by file-enforcer; edit canonical source owner.
/**
 One monochromatic-lint subprocess in stdin fix mode, and the mapping of its
 exit status and streams onto a fixed source plus remaining findings.

 The linter runs as a subprocess because it is a native executable, which
 cannot be bundled into the trusted configuration artifact.

 @module
 */

import { spawn, } from 'node:child_process';
import { once, } from 'node:events';
import { Readable, } from 'node:stream';
import { text as consumeText, } from 'node:stream/consumers';
import { pipeline, } from 'node:stream/promises';

import { MarkdownLintPluginError, } from './errors.ts';
import {
  isReport,
  parseReport,
  type ReportedDiagnostic,
} from './lint-report.ts';

/**
 Exit code monochromatic-lint uses when error findings remain.
 */
const FINDINGS_EXIT_CODE = 1;

/**
 Exit code monochromatic-lint uses when the run could not be completed: a
 usage or configuration error, which writes plain text to stderr, or a
 processing failure or refused fix, which writes JSON Lines findings and
 echoes the source unfixed.
 */
const INCOMPLETE_EXIT_CODE = 2;

/**
 Outcome of one monochromatic-lint subprocess run.
 */
export type LintRun = Readonly<{
  /**
   Fixed source; the original source when the run could not fix it.
   */
  fixedText: string;
  /**
   Violations the selected rules could not fix, including processing failures.
   */
  remaining: readonly ReportedDiagnostic[];
}>;

/**
 Parameters for {@link runMonochromaticLint}.
 */
export type RunMonochromaticLintParams = Readonly<{
  /**
   Command and leading arguments that start monochromatic-lint.
   */
  command: readonly string[];
  /**
   Configuration file the run uses instead of repository lookup.
   */
  configPath: string;
  /**
   Repository root, the subprocess working directory.
   */
  repositoryRoot: string;
  /**
   Repository-relative path the source is linted as.
   */
  path: string;
  /**
   Candidate text.
   */
  text: string;
  /**
   Engine cancellation signal.
   */
  signal: AbortSignal;
}>;

/**
 Run monochromatic-lint in stdin fix mode over one candidate.

 @param command - command and leading arguments that start monochromatic-lint

 @param configPath - configuration file selecting the rules

 @param repositoryRoot - repository root, the subprocess working directory

 @param path - repository-relative path the source is linted as

 @param text - candidate text

 @param signal - engine cancellation signal

 @returns fixed text and remaining violations

 @throws {@link MarkdownLintPluginError} when the subprocess cannot start, is interrupted, rejects its
 arguments or configuration, or exits outside its documented statuses

 @example
 ```ts
 const run = await runMonochromaticLint({
   command: ['monochromatic-lint'],
   configPath: '/tmp/cli-git-markdown-autofix-x/monochromatic-lint.config.jsonc',
   repositoryRoot: '/repo',
   path: 'doc/a.md',
   text: '# A\n',
   signal: new AbortController().signal,
 });
 ```
 */
export async function runMonochromaticLint({
  command,
  configPath,
  repositoryRoot,
  path,
  text,
  signal,
}: RunMonochromaticLintParams,): Promise<LintRun> {
  /**
   Executable and its leading arguments.
   */
  const [executable, ...leading] = command;
  if (executable === undefined) {
    throw new MarkdownLintPluginError('monochromatic-lint command is empty.',);
  }
  /**
   Complete argv: leading arguments, the one-off configuration, stdin as the candidate path, fix mode.
   */
  const args = [
    ...leading,
    '--config',
    configPath,
    '--stdin',
    '--stdin-filename',
    path,
    '--fix',
  ];
  /**
   One monochromatic-lint process for this candidate. Raw `spawn` rather than a
   wrapper because the fixed source must round-trip byte-exact: wrappers that
   strip a final newline would make every candidate look rewritten.
   */
  const child = spawn(
    executable,
    args,
    {
      cwd: repositoryRoot,
      signal,
      stdio: [
        'pipe',
        'pipe',
        'pipe',
      ],
    },
  );
  /**
   Concurrent output consumers keep both pipes drained; the fixed source is
   taken exactly as written, final newline included.
   */
  const output = Promise.all([
    consumeText(child.stdout,),
    consumeText(child.stderr,),
  ],);
  /**
   Process exit and stdin delivery, settled independently: the linter may exit
   with a usage error before it reads stdin, which surfaces here as a broken
   pipe and never as an uncaught stream error.
   */
  const [closed, delivered,] = await Promise.allSettled([
    once(
      child,
      'close',
    ),
    pipeline(
      Readable.from([text,],),
      child.stdin,
    ),
  ],);
  /**
   Fixed source and JSON Lines report.
   */
  const [stdout, stderr,] = await output;
  if (closed.status === 'rejected') {
    /**
     Spawn or abort failure reported on the process itself.
     */
    const failure: unknown = closed.reason;
    if (Error.isError(failure,) && (failure.name === 'AbortError')) {
      throw new MarkdownLintPluginError(
        'monochromatic-lint was interrupted by the engine.',
        { cause: failure, },
      );
    }
    throw new MarkdownLintPluginError(
      'monochromatic-lint could not be started.',
      { cause: failure, },
    );
  }
  if (child.signalCode !== null) {
    throw new MarkdownLintPluginError(
      `monochromatic-lint was interrupted by ${child.signalCode}.`,
      { cause: closed.value, },
    );
  }
  if ((child.exitCode === 0) || (child.exitCode === FINDINGS_EXIT_CODE)) {
    if (delivered.status === 'rejected') {
      throw new MarkdownLintPluginError(
        `monochromatic-lint exited with status ${String(child.exitCode,)} without reading its input.`,
        { cause: delivered.reason, },
      );
    }
    return {
      fixedText: stdout,
      remaining: parseReport(stderr,),
    };
  }
  if ((child.exitCode === INCOMPLETE_EXIT_CODE) && isReport(stderr,)) {
    // A processing failure or a refused fix: the reason is a finding, which the
    // policy reports without a patch, and the source stays as it was.
    return {
      fixedText: text,
      remaining: parseReport(stderr,),
    };
  }
  if (child.exitCode === INCOMPLETE_EXIT_CODE) {
    throw new MarkdownLintPluginError(
      `monochromatic-lint rejected its arguments or configuration: ${stderr.trim()}`,
      { cause: delivered.status === 'rejected' ? delivered.reason : undefined, },
    );
  }
  throw new MarkdownLintPluginError(
    `monochromatic-lint exited with unexpected status ${String(child.exitCode,)}: ${stderr.trim()}`,
    { cause: delivered.status === 'rejected' ? delivered.reason : undefined, },
  );
}
