/**
 Run the markdown-lint CLI over each Markdown candidate and turn its output
 into policy findings: a full-content patch when the fix changed the source,
 and a report-only finding for every violation the selected rules could not
 fix.

 The CLI runs as a subprocess because it carries a native parser that cannot
 be bundled into the trusted configuration artifact.

 @module
 */

import { spawn, } from 'node:child_process';
import { once, } from 'node:events';
import { Readable, } from 'node:stream';
import { text as consumeText, } from 'node:stream/consumers';
import { pipeline, } from 'node:stream/promises';

import type {
  CandidateFile,
  PolicyFinding,
} from '@monochromatic-dev/git-policy-api/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import ignore, { type Ignore, } from 'ignore';
import * as v from 'valibot';

import { MarkdownLintPluginError, } from './errors.ts';
import { createFullContentPatch, } from './full-content-patch.ts';

/**
 Finding code for a candidate the selected rules rewrote.
 */
export const AUTOFIX_CODE = 'markdown-autofix';

/**
 Finding code for a violation the selected rules reported without a fix.
 */
export const VIOLATION_CODE = 'markdown-violation';

/**
 Exit code markdown-lint uses when unfixed violations remain.
 */
const VIOLATIONS_EXIT_CODE = 1;

/**
 Exit code markdown-lint uses for a usage error.
 */
const USAGE_EXIT_CODE = 2;

/**
 Longest stderr excerpt quoted when the JSON report cannot be parsed.
 */
const REPORT_EXCERPT_LENGTH = 200;

/**
 Strict decoder; a candidate that is not UTF-8 is skipped rather than fed to
 a text linter.
 */
const DECODER = new TextDecoder(
  'utf-8',
  { fatal: true, },
);

/**
 Patch byte encoder.
 */
const ENCODER = new TextEncoder();

/**
 Whether a repository path names a Markdown or MDX file, by extension.

 @param path - repository-relative path

 @returns `true` for `.md` and `.mdx`

 @example
 ```ts
 isMarkdownPath('doc/a.md'); // true
 isMarkdownPath('src/a.ts'); // false
 ```
 */
export function isMarkdownPath(path: string,): boolean {
  /**
   Lowercased path so `.MD` counts too.
   */
  const lower = path.toLowerCase();
  return lower.endsWith('.md',) || lower.endsWith('.mdx',);
}

/**
 Whether a candidate carries Markdown text the policy may rewrite: not
 deleted, an ordinary or executable file, and a Markdown path.

 @param candidate - lifecycle candidate

 @returns `true` when the policy inspects the candidate
 */
function isEligible(candidate: CandidateFile,): boolean {
  return (candidate.change !== 'deleted')
    && ((candidate.mode === 'regular') || (candidate.mode === 'executable'))
    && isMarkdownPath(candidate.path,);
}

/**
 One diagnostic of the JSON report markdown-lint writes; extra fields such as
 `path` and `fixable` are accepted and ignored.
 */
const reportedDiagnosticSchema = v.object({
  ruleId: v.string(),
  message: v.string(),
  line: v.number(),
  column: v.number(),
},);

/**
 Complete JSON report: a flat array of diagnostics.
 */
const reportSchema = v.array(reportedDiagnosticSchema,);

/**
 One diagnostic of the JSON report markdown-lint writes.
 */
type ReportedDiagnostic = Readonly<v.InferOutput<typeof reportedDiagnosticSchema>>;

/**
 Parse the JSON report markdown-lint writes to stderr in stdin fix mode.

 @param stderr - subprocess stderr

 @returns reported diagnostics, empty when stderr carries none

 @throws {@link MarkdownLintPluginError} when stderr is not the JSON report
 */
function parseReport(stderr: string,): readonly ReportedDiagnostic[] {
  /**
   Report text without surrounding whitespace.
   */
  const trimmed = stderr.trim();
  if (trimmed === '') {
    return [];
  }
  /**
   Parsed JSON value, whatever its shape.
   */
  const parsed: unknown = (function parseJson(): unknown {
    try {
      return JSON.parse(trimmed,);
    }
    catch (error) {
      throw new MarkdownLintPluginError(
        `markdown-lint report could not be parsed: ${stderr.slice(
          0,
          REPORT_EXCERPT_LENGTH,
        )}`,
        { cause: error, },
      );
    }
  })();
  /**
   Shape check against the flat diagnostic array.
   */
  const checked = v.safeParse(
    reportSchema,
    parsed,
  );
  if (!checked.success) {
    throw new MarkdownLintPluginError(
      `markdown-lint report has an unexpected shape: ${checked.issues
        .map(function issueMessage(issue,): string {
          return issue.message;
        },)
        .join('; ',)}`,
    );
  }
  return checked.output;
}

/**
 Outcome of one markdown-lint subprocess run.
 */
type LintRun = Readonly<{
  /**
   Fixed source from stdout.
   */
  fixedText: string;
  /**
   Violations the selected rules could not fix.
   */
  remaining: readonly ReportedDiagnostic[];
}>;

/**
 Parameters for {@link runMarkdownLint}.
 */
type RunMarkdownLintParams = Readonly<{
  /**
   Command and leading arguments that start markdown-lint.
   */
  command: readonly string[];
  /**
   Rule ids to run.
   */
  rules: readonly string[];
  /**
   gitignore-syntax patterns the `lfs-image-url` rule must skip.
   */
  exclude: readonly string[];
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
 Run markdown-lint in stdin fix mode over one candidate.

 @param command - command and leading arguments that start markdown-lint

 @param rules - rule ids to run

 @param exclude - gitignore-syntax patterns the `lfs-image-url` rule must skip

 @param repositoryRoot - repository root, the subprocess working directory

 @param path - repository-relative path the source is linted as

 @param text - candidate text

 @param signal - engine cancellation signal

 @returns fixed text and remaining violations

 @throws {@link MarkdownLintPluginError} when the subprocess cannot start, is interrupted, or reports a usage error
 */
async function runMarkdownLint({
  command,
  rules,
  exclude,
  repositoryRoot,
  path,
  text,
  signal,
}: RunMarkdownLintParams,): Promise<LintRun> {
  /**
   Executable and its leading arguments.
   */
  const [executable, ...leading] = command;
  if (executable === undefined) {
    throw new MarkdownLintPluginError('markdown-lint command is empty.',);
  }
  /**
   Complete argv: leading arguments, fix mode, JSON report, stdin path, rules, excludes.
   */
  const args = [
    ...leading,
    '--fix',
    '--format=json',
    `--stdin-path=${path}`,
    ...rules.map(function ruleFlag(rule: string,): string {
      return `--rule=${rule}`;
    },),
    ...exclude.map(function excludeFlag(pattern: string,): string {
      return `--lfs-image-exclude=${pattern}`;
    },),
  ];
  /**
   One markdown-lint process for this candidate. Raw `spawn` rather than a
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
   Process exit and stdin delivery, settled independently: the CLI may exit
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
   Fixed source and JSON report.
   */
  const [stdout, stderr,] = await output;
  if (closed.status === 'rejected') {
    /**
     Spawn or abort failure reported on the process itself.
     */
    const failure: unknown = closed.reason;
    if (Error.isError(failure,) && (failure.name === 'AbortError')) {
      throw new MarkdownLintPluginError(
        'markdown-lint was interrupted by the engine.',
        { cause: failure, },
      );
    }
    throw new MarkdownLintPluginError(
      'markdown-lint could not be started.',
      { cause: failure, },
    );
  }
  if (child.signalCode !== null) {
    throw new MarkdownLintPluginError(
      `markdown-lint was interrupted by ${child.signalCode}.`,
      { cause: closed.value, },
    );
  }
  if (child.exitCode === 0) {
    if (delivered.status === 'rejected') {
      throw new MarkdownLintPluginError(
        'markdown-lint exited successfully without reading its input.',
        { cause: delivered.reason, },
      );
    }
    return {
      fixedText: stdout,
      remaining: [],
    };
  }
  if (child.exitCode === VIOLATIONS_EXIT_CODE) {
    return {
      fixedText: stdout,
      remaining: parseReport(stderr,),
    };
  }
  if (child.exitCode === USAGE_EXIT_CODE) {
    throw new MarkdownLintPluginError(
      `markdown-lint rejected its arguments: ${stderr.trim()}`,
      { cause: delivered.status === 'rejected' ? delivered.reason : undefined, },
    );
  }
  throw new MarkdownLintPluginError(
    `markdown-lint exited with infrastructure status ${String(child.exitCode,)}: ${stderr.trim()}`,
    { cause: delivered.status === 'rejected' ? delivered.reason : undefined, },
  );
}

/**
 Parameters for {@link rewriteCandidate}.
 */
type RewriteCandidateParams = Readonly<{
  /**
   Command and leading arguments that start markdown-lint.
   */
  command: readonly string[];
  /**
   Rule ids to run.
   */
  rules: readonly string[];
  /**
   gitignore-syntax patterns the `lfs-image-url` rule must skip.
   */
  exclude: readonly string[];
  /**
   Repository root, the subprocess working directory.
   */
  repositoryRoot: string;
  /**
   Whether the lifecycle accepts patches.
   */
  canApplyPatches: boolean;
  /**
   Candidate under inspection.
   */
  candidate: CandidateFile;
  /**
   Engine cancellation signal.
   */
  signal: AbortSignal;
}>;

/**
 Findings for one eligible candidate.

 @param command - command and leading arguments that start markdown-lint

 @param rules - rule ids to run

 @param exclude - gitignore-syntax patterns the `lfs-image-url` rule must skip

 @param repositoryRoot - repository root, the subprocess working directory

 @param canApplyPatches - whether the lifecycle accepts patches

 @param candidate - candidate under inspection

 @param signal - engine cancellation signal

 @returns an autofix finding when the source changed, plus one finding per remaining violation
 */
async function rewriteCandidate({
  command,
  rules,
  exclude,
  repositoryRoot,
  canApplyPatches,
  candidate,
  signal,
}: RewriteCandidateParams,): Promise<readonly PolicyFinding[]> {
  /**
   Exact candidate bytes from lifecycle-owned Git state.
   */
  const original = await candidate.bytes();
  /**
   Candidate text as a one-element list, empty when the bytes are not UTF-8.
   */
  const texts: readonly string[] = (function decode(): readonly string[] {
    try {
      return [DECODER.decode(original,),];
    }
    catch (error) {
      if (error instanceof TypeError) {
        return [];
      }
      throw error;
    }
  })();
  /**
   Decoded text, when the candidate is UTF-8.
   */
  const [text,] = texts;
  if (text === undefined) {
    return [];
  }
  /**
   Fixed text and remaining violations.
   */
  const run = await runMarkdownLint({
    command,
    rules,
    exclude,
    repositoryRoot,
    path: candidate.path,
    text,
    signal,
  },);
  /**
   Report-only findings for violations the rules could not fix.
   */
  const violations: readonly PolicyFinding[] = run.remaining
    .map(function toFinding(diagnostic: ReportedDiagnostic,): PolicyFinding {
      return {
        code: VIOLATION_CODE,
        message: `${diagnostic.ruleId} at ${candidate.path}:${String(diagnostic.line,)}:${String(diagnostic.column,)}: ${diagnostic.message}`,
        path: candidate.path,
      };
    },);
  if (run.fixedText === text) {
    return violations;
  }
  /**
   Stable report shared by read-only and fixable lifecycle points.
   */
  const autofix: PolicyFinding = {
    code: AUTOFIX_CODE,
    message: `markdown-lint --fix (${rules.join(', ',)}) rewrites ${candidate.path}.`,
    path: candidate.path,
  };
  if ((!canApplyPatches) || ((typeof candidate.revision) !== 'string')) {
    return [
      autofix,
      ...violations,
    ];
  }
  if ((candidate.mode !== 'regular') && (candidate.mode !== 'executable')) {
    return [
      autofix,
      ...violations,
    ];
  }
  return [
    {
      ...autofix,
      patch: createFullContentPatch({
        targetId: candidate.targetId,
        path: candidate.path,
        revision: candidate.revision,
        mode: candidate.mode,
        original,
        replacement: ENCODER.encode(run.fixedText,),
      },),
    },
    ...violations,
  ];
}

/**
 Parameters for {@link rewriteCandidates}.
 */
export type RewriteCandidatesParams = Readonly<{
  /**
   Command and leading arguments that start markdown-lint, resolved from the
   repository root.
   */
  command: readonly string[];
  /**
   Rule ids to run.
   */
  rules: readonly string[];
  /**
   gitignore-syntax patterns, relative to the repository root, naming
   candidates the policy leaves alone.
   */
  exclude: readonly string[];
  /**
   Repository root.
   */
  repositoryRoot: string;
  /**
   Whether the lifecycle accepts patches.
   */
  canApplyPatches: boolean;
  /**
   Exact lifecycle candidates, owned by the engine.
   */
  candidates: ForeignBorrowed<readonly CandidateFile[]>;
  /**
   Engine cancellation signal.
   */
  signal: AbortSignal;
}>;

/**
 Run markdown-lint over every eligible Markdown candidate, sequentially so a
 large commit never fans out one subprocess per file at once.

 @param command - command and leading arguments that start markdown-lint

 @param rules - rule ids to run

 @param exclude - gitignore-syntax patterns for candidates the policy leaves alone

 @param repositoryRoot - repository root

 @param canApplyPatches - whether the lifecycle accepts patches

 @param candidates - exact lifecycle candidates

 @param signal - engine cancellation signal

 @returns findings across every eligible candidate

 @example
 ```ts
 await rewriteCandidates({
   command: ['node', 'package/cli/markdown-lint/src/cli.ts'],
   rules: ['lfs-image-url'],
   exclude: ['package/ssg/'],
   repositoryRoot: '/repo',
   canApplyPatches: true,
   candidates,
   signal: new AbortController().signal,
 });
 ```
 */
export async function rewriteCandidates({
  command,
  rules,
  exclude,
  repositoryRoot,
  canApplyPatches,
  candidates,
  signal,
}: RewriteCandidatesParams,): Promise<readonly PolicyFinding[]> {
  /**
   Matcher over the exclude patterns.
   */
  const excluded: Ignore = ignore()
    .add([...exclude,],);
  /**
   Candidates the policy inspects.
   */
  const eligible = candidates.filter(function inspects(candidate: CandidateFile,): boolean {
    return isEligible(candidate,) && (!excluded.ignores(candidate.path,));
  },);
  /**
   Findings accumulated one candidate at a time.
   */
  const findings: PolicyFinding[] = [];
  /* oxlint-disable no-await-in-loop -- Each candidate starts a Node subprocess; sequential runs bound concurrent process count on large commits. */
  for (const candidate of eligible) {
    findings.push(...await rewriteCandidate({
      command,
      rules,
      exclude,
      repositoryRoot,
      canApplyPatches,
      candidate,
      signal,
    },),);
  }
  /* oxlint-enable no-await-in-loop */
  return findings;
}
