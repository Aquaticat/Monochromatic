// Generated from `package/git-policy/markdown-lint/src/rewrite-candidates.ts` by file-enforcer; edit canonical source owner.
/**
 Run monochromatic-lint over each Markdown candidate and turn its output
 into policy findings: a full-content patch when the fix changed the source,
 and a report-only finding for every violation the selected rules could not
 fix.

 @module
 */

import {
  mkdtempDisposable,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import type {
  CandidateFile,
  PolicyFinding,
} from '../../api/index.ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import ignore, { type Ignore, } from 'ignore';

import { createFullContentPatch, } from './full-content-patch.ts';
import { lintConfiguration, } from './lint-configuration.ts';
import type { ReportedDiagnostic, } from './lint-report.ts';
import { runMonochromaticLint, } from './run-linter.ts';

/**
 Finding code for a candidate the selected rules rewrote.
 */
export const AUTOFIX_CODE = 'markdown-autofix';

/**
 Finding code for a violation the selected rules reported without a fix.
 */
export const VIOLATION_CODE = 'markdown-violation';

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
 Parameters for {@link violationFinding}.
 */
type ViolationFindingParams = Readonly<{
  /**
   Reported finding.
   */
  diagnostic: ReportedDiagnostic;
  /**
   Candidate path the finding belongs to.
   */
  path: string;
}>;

/**
 Policy finding for one violation the selected rules could not fix.

 @param diagnostic - reported finding

 @param path - candidate path the finding belongs to

 @returns report-only finding naming the rule and its first label's position
 */
function violationFinding({
  diagnostic,
  path,
}: ViolationFindingParams,): PolicyFinding {
  /**
   First label, when the finding has one.
   */
  const [label,] = diagnostic.labels;
  if (label === undefined) {
    return {
      code: VIOLATION_CODE,
      message: `${diagnostic.code} at ${path}: ${diagnostic.message}`,
      path,
    };
  }
  /**
   One-based position of the first label.
   */
  const { span, } = label;
  /**
   `path:line:column` of the finding.
   */
  const location = `${path}:${String(span.line,)}:${String(span.column,)}`;
  return {
    code: VIOLATION_CODE,
    message: `${diagnostic.code} at ${location}: ${diagnostic.message}`,
    path,
  };
}

/**
 Parameters for {@link rewriteCandidate}.
 */
type RewriteCandidateParams = Readonly<{
  /**
   Command and leading arguments that start monochromatic-lint.
   */
  command: readonly string[];
  /**
   Rule ids to run, as listed in the autofix message.
   */
  rules: readonly string[];
  /**
   Configuration file selecting the rules.
   */
  configPath: string;
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

 @param command - command and leading arguments that start monochromatic-lint

 @param rules - rule ids to run

 @param configPath - configuration file selecting the rules

 @param repositoryRoot - repository root, the subprocess working directory

 @param canApplyPatches - whether the lifecycle accepts patches

 @param candidate - candidate under inspection

 @param signal - engine cancellation signal

 @returns an autofix finding when the source changed, plus one finding per remaining violation
 */
async function rewriteCandidate({
  command,
  rules,
  configPath,
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
  const run = await runMonochromaticLint({
    command,
    configPath,
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
      return violationFinding({
        diagnostic,
        path: candidate.path,
      },);
    },);
  if (run.fixedText === text) {
    return violations;
  }
  /**
   Stable report shared by read-only and fixable lifecycle points.
   */
  const autofix: PolicyFinding = {
    code: AUTOFIX_CODE,
    message: `monochromatic-lint --fix (${rules.join(', ',)}) rewrites ${candidate.path}.`,
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
   Command and leading arguments that start monochromatic-lint, resolved from
   the repository root.
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
 Run monochromatic-lint over every eligible Markdown candidate, sequentially
 so a large commit never fans out one subprocess per file at once. The
 configuration file lives in a private temporary directory that is removed
 when the run ends, whether or not it succeeded.

 @param command - command and leading arguments that start monochromatic-lint

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
   command: ['monochromatic-lint'],
   rules: ['markdown/lfs-image-url'],
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
  if (eligible.length === 0) {
    return [];
  }
  /**
   Private directory, created with mode 0700, holding the configuration file
   and removed with it when this scope ends.
   */
  await using configDirectory = await mkdtempDisposable(join(
    tmpdir(),
    'cli-git-markdown-autofix-',
  ),);
  /**
   Configuration file the subprocess reads through `--config`.
   */
  const configPath = join(
    configDirectory.path,
    'monochromatic-lint.config.jsonc',
  );
  await writeFile(
    configPath,
    lintConfiguration({
      rules,
      exclude,
    },),
    {
      flag: 'wx',
      mode: 0o600,
    },
  );
  /**
   Findings accumulated one candidate at a time.
   */
  const findings: PolicyFinding[] = [];
  /* oxlint-disable no-await-in-loop -- Each candidate starts a linter subprocess; sequential runs bound concurrent process count on large commits. */
  for (const candidate of eligible) {
    findings.push(...await rewriteCandidate({
      command,
      rules,
      configPath,
      repositoryRoot,
      canApplyPatches,
      candidate,
      signal,
    },),);
  }
  /* oxlint-enable no-await-in-loop */
  return findings;
}
