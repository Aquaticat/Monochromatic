/**
 Read the anonymous LFS server base URL from a repository's committed
 `.lfsconfig`.

 @module
 */

import { readFile, } from 'node:fs/promises';
import { join, } from 'node:path';

import { isAbsentPathError, } from './absent-path.ts';

/**
 File name git-lfs reads for repository-level configuration.
 */
export const LFS_CONFIG_FILENAME = '.lfsconfig';

/**
 Accumulator for the line scan: the current INI section and the LFS URLs
 found so far, first match first.
 */
type ScanState = {
  /**
   Section header most recently seen, lowercased, without brackets.
   */
  readonly section: string;
  /**
   LFS URLs found so far, in file order.
   */
  readonly urls: readonly string[];
};

/**
 Parameters for {@link scanLine}.
 */
type ScanLineParams = {
  /**
   Scan state before this line.
   */
  readonly state: ScanState;
  /**
   One line of the file.
   */
  readonly rawLine: string;
};

/**
 Whether an INI section header names a git remote (`[remote "origin"]`).

 @param section - lowercased section name

 @returns `true` for remote sections
 */
function isRemoteSection(section: string,): boolean {
  return section.startsWith('remote ',);
}

/**
 Fold one `.lfsconfig` line into the scan state. Recognizes `url` under
 `[lfs]` and `lfsurl` under any `[remote "..."]` section; comments and
 unrelated keys pass through.

 @param state - scan state before this line

 @param rawLine - one line of the file

 @returns scan state after this line
 */
function scanLine({
  state,
  rawLine,
}: ScanLineParams,): ScanState {
  /**
   Line without surrounding whitespace.
   */
  const line = rawLine.trim();
  if ((line === '') || line.startsWith('#',)
    || line.startsWith(';',)) {
    return state;
  }
  if (line.startsWith('[',) && line.endsWith(']',)) {
    return {
      section: line
        .slice(
          1,
          -1,
        )
        .trim()
        .toLowerCase(),
      urls: state.urls,
    };
  }
  /**
   Position of the key/value separator.
   */
  const equals = line.indexOf('=',);
  if (equals === (-1)) {
    return state;
  }
  /**
   Key before the separator, lowercased.
   */
  const key = line
    .slice(
      0,
      equals,
    )
    .trim()
    .toLowerCase();
  /**
   Value after the separator.
   */
  const value = line
    .slice(equals + 1,)
    .trim();
  /**
   Whether this key names the LFS endpoint in its section.
   */
  const isLfsUrl = ((state.section === 'lfs') && (key === 'url'))
    || (isRemoteSection(state.section,) && (key === 'lfsurl'));
  if ((!isLfsUrl) || (value === '')) {
    return state;
  }
  return {
    section: state.section,
    urls: [
      ...state.urls,
      value,
    ],
  };
}

/**
 Base URL for object requests derived from an LFS endpoint URL: userinfo
 stripped so a committed credential-free form is always produced, and any
 trailing slash removed.

 @param lfsUrl - `lfs.url` or `remote.<name>.lfsurl` value

 @returns credential-free base URL without a trailing slash

 @example
 ```ts
 lfsObjectBase('https://lfs:token@lfs.example/'); // 'https://lfs.example'
 ```
 */
export function lfsObjectBase(lfsUrl: string,): string {
  /**
   Parsed endpoint; parsing throws on a malformed value, which is the right
   outcome for a corrupt `.lfsconfig`.
   */
  const url = new URL(lfsUrl,);
  url.username = '';
  url.password = '';
  url.search = '';
  url.hash = '';
  /**
   Serialized URL, which `URL` always gives a path of at least `/`.
   */
  const { href, } = url;
  return href.endsWith('/',) ? href.slice(
    0,
    -1,
  ) : href;
}

/**
 Parse `.lfsconfig` text into the object base URLs it declares, in file
 order. Empty when the file declares no LFS endpoint.

 @param text - `.lfsconfig` contents

 @returns credential-free base URLs, first declaration first

 @example
 ```ts
 parseLfsConfig('[lfs]\n\turl = https://lfs.example\n'); // ['https://lfs.example']
 ```
 */
export function parseLfsConfig(text: string,): readonly string[] {
  /**
   Scan result over every line.
   */
  const { urls, } = text
    .split('\n',)
    .reduce(
      function fold(
        state: ScanState,
        rawLine: string,
      ): ScanState {
        return scanLine({
          state,
          rawLine,
        },);
      },
      {
        section: '',
        urls: [],
      },
    );
  return urls.map(function baseOf(url: string,): string {
    return lfsObjectBase(url,);
  },);
}

/**
 Read a repository root's `.lfsconfig` and return its object base URL as a
 one-element list, or an empty list when the file is absent or declares no
 endpoint, so callers destructure instead of handling a nullable.

 @param repoRoot - directory holding `.lfsconfig`

 @returns one base URL, or none

 @example
 ```ts
 const [base] = await readLfsObjectBase('/repo');
 ```
 */
export async function readLfsObjectBase(repoRoot: string,): Promise<readonly string[]> {
  try {
    /**
     Raw config text.
     */
    const text = await readFile(
      join(
        repoRoot,
        LFS_CONFIG_FILENAME,
      ),
      'utf8',
    );
    return parseLfsConfig(text,)
      .slice(
        0,
        1,
      );
  }
  catch (error) {
    if (isAbsentPathError(error,)) {
      return [];
    }
    throw error;
  }
}
