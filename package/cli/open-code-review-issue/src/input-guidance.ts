/**
 * OCR input generation and persisted-session discovery guidance.
 *
 * @module
 */

import type { Dirent, } from 'node:fs';
import {
  readdir,
  stat,
} from 'node:fs/promises';
import { homedir, } from 'node:os';
import { join, } from 'node:path';

import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';

/**
 * Tagged discovery logger that never reads session content.
 */
const l = tagged({ tag: 'input-guidance', },);

/**
 * Candidate persisted session ordered by filesystem modification time.
 */
type SessionCandidate = {
  readonly path: string;
  readonly modifiedMilliseconds: number;
};

/**
 * Reads directory entries without replacing primary input diagnostics.
 *
 * @param path - OCR session root or encoded repository directory.
 *
 * @returns Entries, or empty list when discovery path is unavailable.
 */
async function readableDirectory(path: string,): Promise<readonly Dirent[]> {
  try {
    return await readdir(path, { withFileTypes: true, },);
  }
  catch (error: unknown) {
    l.debug(`OCR session discovery skipped a directory: ${caughtValueText(error,)}`,);
    return [];
  }
}

/**
 * Reads candidate modification evidence without replacing primary diagnostic.
 *
 * @param path - Persisted JSONL candidate path.
 *
 * @returns Timed candidate or undefined after filesystem race or access failure.
 */
async function sessionCandidate(path: string,): Promise<SessionCandidate | undefined> {
  try {
    /**
     * Filesystem metadata used only for latest-session selection.
     */
    const metadata = await stat(path,);
    return {
      path,
      modifiedMilliseconds: metadata.mtimeMs,
    };
  }
  catch (error: unknown) {
    l.debug(`OCR session discovery skipped a file: ${caughtValueText(error,)}`,);
    return undefined;
  }
}

/**
 * Selects later session candidate while preserving undefined identity.
 *
 * @param current - Current latest candidate.
 *
 * @param candidate - Newly inspected candidate.
 *
 * @returns Candidate with later modification time.
 */
function laterCandidate({
  current,
  candidate,
}: {
  readonly current: SessionCandidate | undefined;
  readonly candidate: SessionCandidate;
},): SessionCandidate {
  return current === undefined
    || candidate.modifiedMilliseconds > current.modifiedMilliseconds
    ? candidate
    : current;
}

/**
 * Finds latest persisted OCR JSONL without invoking OCR or reading session content.
 *
 * @param homeDirectory - Runtime home containing `.opencodereview`.
 *
 * @returns Latest session path across encoded repositories when present.
 */
async function findLatestOcrSessionJsonl(homeDirectory: string,): Promise<string | undefined> {
  /**
   * OCR v1.9.4 persisted-session root confirmed from current CLI help and source.
   */
  const sessionsRoot = join(homeDirectory, '.opencodereview', 'sessions',);
  /**
   * Encoded repository directories under OCR session root.
   */
  const repositoryEntries = await readableDirectory(sessionsRoot,);
  let latest: SessionCandidate | undefined;
  for (const repositoryEntry of repositoryEntries) {
    if (!repositoryEntry.isDirectory()) {
      continue;
    }
    /**
     * Persisted session files for one encoded repository.
     */
    const repositoryDirectory = join(sessionsRoot, repositoryEntry.name,);
    const sessionEntries = await readableDirectory(repositoryDirectory,);
    for (const sessionEntry of sessionEntries) {
      if (!sessionEntry.isFile() || !sessionEntry.name.endsWith('.jsonl',)) {
        continue;
      }
      /**
       * Timed path for latest comparison.
       */
      const candidate = await sessionCandidate(join(repositoryDirectory, sessionEntry.name,),);
      if (candidate !== undefined) {
        latest = laterCandidate({ current: latest, candidate, });
      }
    }
  }
  return latest?.path;
}

/**
 * Builds actionable OCR generation and discovery diagnostic.
 *
 * @param homeDirectory - Optional injected home for disposable verification.
 *
 * @returns Commands, common path, and latest concrete session when found.
 *
 * @example
 * ```ts
 * await buildInputGuidance({ homeDirectory: '/tmp/home' });
 * ```
 */
export async function buildInputGuidance({
  homeDirectory = homedir(),
}: {
  readonly homeDirectory?: string;
} = {},): Promise<string> {
  /**
   * Latest persisted transcript discovered without invoking OCR.
   */
  const latestSession = await findLatestOcrSessionJsonl(homeDirectory,);
  return [
    'Get supported OCR input with one of these commands:',
    '  open-code-review-issue --interactive "$(ocr review --format json)"',
    '  ocr review --format json > review.json',
    '  ocr scan --format json > scan.json',
    '  ocr session list --json',
    '  ocr session comments --json <session-id> > comments.json',
    '',
    'Persisted OCR session JSONL files are commonly stored at:',
    '  ~/.opencodereview/sessions/<encoded-repo-path>/<session-id>.jsonl',
    ...(latestSession === undefined
      ? []
      : [
        '',
        'Latest OCR session JSONL found:',
        `  ${latestSession}`,
      ]),
  ].join('\n',);
}
