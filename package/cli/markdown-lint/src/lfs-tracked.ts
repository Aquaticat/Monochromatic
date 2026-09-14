/**
 Decide whether a repository path is routed through git-lfs by reading the
 `filter=lfs` attribute lines of a root `.gitattributes`.

 Attribute patterns use gitignore pattern syntax, so the `ignore` matcher the
 file walker already depends on evaluates them; a later line that unsets the
 filter (`-filter` or `!filter`) becomes a negated pattern, matching git's
 last-match-wins attribute resolution.

 @module
 */

import { readFile, } from 'node:fs/promises';
import { join, } from 'node:path';

import ignore, { type Ignore, } from 'ignore';

import { isAbsentPathError, } from './absent-path.ts';

/**
 File name git reads for path attributes.
 */
export const GIT_ATTRIBUTES_FILENAME = '.gitattributes';

/**
 Predicate answering whether a repo-relative path is LFS-tracked.
 */
export type LfsTrackedPredicate = (repoRelativePath: string,) => boolean;

/**
 Split a line on runs of spaces and tabs using string APIs only, so the
 attribute grammar needs no regex and no character iteration.

 @param line - trimmed attribute line

 @returns non-empty tokens in order
 */
function splitOnBlanks(line: string,): readonly string[] {
  return line
    .split(' ',)
    .flatMap(function splitTabs(part: string,): readonly string[] {
      return part.split('\t',);
    },)
    .filter(function nonEmpty(token: string,): boolean {
      return token !== '';
    },);
}

/**
 Ignore-syntax pattern derived from one attribute line: the pattern itself
 when the line sets `filter=lfs`, its negation when the line unsets the
 filter, and nothing otherwise.

 @param rawLine - one `.gitattributes` line

 @returns zero or one ignore patterns
 */
function patternOfLine(rawLine: string,): readonly string[] {
  /**
   Line without surrounding whitespace.
   */
  const line = rawLine.trim();
  if ((line === '') || line.startsWith('#',)) {
    return [];
  }
  /**
   Pattern followed by attribute tokens.
   */
  const [pattern, ...attributes] = splitOnBlanks(line,);
  if (pattern === undefined) {
    return [];
  }
  if (attributes.includes('filter=lfs',)) {
    return [pattern,];
  }
  if (attributes.includes('-filter',) || attributes.includes('!filter',)) {
    return [`!${pattern}`,];
  }
  return [];
}

/**
 Build the LFS-tracked predicate from `.gitattributes` text.

 @param text - `.gitattributes` contents

 @returns predicate over repo-relative paths

 @example
 ```ts
 const tracked = lfsTrackedMatcher('*.png filter=lfs diff=lfs merge=lfs -text\n');
 tracked('asset/readme/shot.png'); // true
 tracked('README.md'); // false
 ```
 */
export function lfsTrackedMatcher(text: string,): LfsTrackedPredicate {
  /**
   Matcher over every `filter=lfs` pattern and every unset negation.
   */
  const matcher: Ignore = ignore()
    .add(text
    .split('\n',)
      .flatMap(function patternsOf(line: string,): readonly string[] {
      return patternOfLine(line,);
    },),);
  return function isLfsTracked(repoRelativePath: string,): boolean {
    return matcher.ignores(repoRelativePath,);
  };
}

/**
 Read a repository root's `.gitattributes` and build the predicate; an
 absent file tracks nothing.

 @param repoRoot - directory holding `.gitattributes`

 @returns predicate over repo-relative paths

 @example
 ```ts
 const tracked = await readLfsTrackedMatcher('/repo');
 ```
 */
export async function readLfsTrackedMatcher(repoRoot: string,): Promise<LfsTrackedPredicate> {
  try {
    return lfsTrackedMatcher(await readFile(
      join(
        repoRoot,
        GIT_ATTRIBUTES_FILENAME,
      ),
      'utf8',
    ),);
  }
  catch (error) {
    if (isAbsentPathError(error,)) {
      return lfsTrackedMatcher('',);
    }
    throw error;
  }
}
