/**
 * Activity word extraction from Claude transcripts.
 *
 * @module
 */

import { openAsBlob, } from 'node:fs';
import { readFile, } from 'node:fs/promises';

//region Gerund filters

/**
 * Words ending in "-ing" that are not meaningful activity verbs.
 */
const NOISE_GERUNDS = new Set([
  'beginning',
  'completing',
  'continuing',
  'ending',
  'finishing',
  'starting',
  'stopping',
  'waiting',
  'pending',
  'asking',
  'calling',
  'coming',
  'doing',
  'getting',
  'giving',
  'going',
  'having',
  'keeping',
  'knowing',
  'letting',
  'looking',
  'making',
  'meaning',
  'putting',
  'saying',
  'seeing',
  'showing',
  'telling',
  'trying',
  'turning',
  'wanting',
  'working',
  'reading',
  'searching',
  'anything',
  'everything',
  'nothing',
  'something',
  'thing',
  'according',
  'assuming',
  'concerning',
  'considering',
  'depending',
  'during',
  'excluding',
  'following',
  'including',
  'providing',
  'regarding',
  'supposing',
  'amazing',
  'annoying',
  'boring',
  'confusing',
  'corresponding',
  'exciting',
  'existing',
  'frustrating',
  'interesting',
  'missing',
  'lint-missing',
  'outstanding',
  'overwhelming',
  'remaining',
  'surprising',
  'surrounding',
  'underlying',
  'bring',
  'cling',
  'fling',
  'king',
  'ring',
  'sing',
  'sling',
  'spring',
  'sting',
  'string',
  'swing',
  'wing',
  'wring',
  'sibling',
  'being',
  'needing',
  'running',
  'thinking',
  'using',
  'quizzical-crafting',
  'crafting',
  'wild-nibbling',
  'nibbling',
  'purring',
  'hatching',
  'purring-hatching',
  'beaming',
  'hidden-beaming',
  'nnothing',
  'nstring',
],);

/**
 * Minimum word length to consider as a gerund candidate.
 */
const MIN_GERUND_LENGTH = 5;

/**
 * Matches words ending in "-ing", including hyphenated compounds.
 */
// oxlint-disable-next-line no-restricted-syntax/no-regex -- bounded transcript tail, simple word-character class, global scan without nested quantifiers.
const GERUND_PATTERN = /\b[a-z]+-?[a-z]*ing\b/gu;

/**
 * Number of bytes to read from the end of the transcript.
 */
const TAIL_BYTES = 8_192;

//endregion Gerund filters

//region Gerund extraction

/**
 * Finds the last meaningful gerund in text.
 *
 * @param value - text to scan
 *
 * @returns capitalized gerund, or empty string when none is found
 *
 * @example
 * ```ts
 * findGerundInText('I am compiling and testing');
 * ```
 */
function findGerundInText(value: string,): string {
  /**
   * Lowercased text for case-insensitive matching.
   */
  const lowercaseValue = value.toLowerCase();
  /**
   * Raw `-ing` matches across lowercased text.
   */
  const matches = lowercaseValue.match(GERUND_PATTERN,) ?? [];
  /**
   * Matches that survive length and noise filters.
   */
  const candidates = matches
    .filter(function isLongEnough(word,): boolean {
      return word.length >= MIN_GERUND_LENGTH;
    },)
    .filter(function isNotNoise(word,): boolean {
      return !NOISE_GERUNDS.has(word,);
    },);

  /**
   * Last surviving candidate.
   */
  const last = candidates.at(-1,);
  if (last === undefined)
    return '';

  return last.charAt(0,)
    .toUpperCase()
    + last.slice(1,);
}

/**
 * Reads transcript tail without loading the entire file.
 *
 * @param transcriptPath - path to session transcript JSONL
 *
 * @returns transcript tail text
 *
 * @example
 * ```ts
 * await readTranscriptTail({ transcriptPath: '/tmp/session.jsonl' });
 * ```
 */
async function readTranscriptTail({
  transcriptPath,
}: Readonly<{
  transcriptPath: string;
}>,): Promise<string> {
  /**
   * Blob view of the transcript.
   */
  const blob = await openAsBlob(transcriptPath,);
  /**
   * Slice offset clamped to zero for short transcripts.
   */
  const start = Math.max(
    0,
    blob.size - TAIL_BYTES,
  );
  return await blob
    .slice(
      start,
      blob.size,
    )
    .text();
}

/**
 * Extracts a context-aware activity word from transcript path.
 *
 * @param transcriptPath - path to session transcript JSONL
 *
 * @returns capitalized activity word, or empty string when unavailable
 *
 * @example
 * ```ts
 * await readActivityWord({ transcriptPath: '/tmp/session.jsonl' });
 * ```
 */
async function readActivityWord({
  transcriptPath,
}: Readonly<{
  transcriptPath: string;
}>,): Promise<string> {
  try {
    /**
     * Tail of the transcript decoded as UTF-8 text.
     */
    const tail = await readTranscriptTail({ transcriptPath, },);
    return findGerundInText(tail,);
  }
  catch (_error: unknown) {
    return '';
  }
}

/**
 * Reads complete transcript text for small test fixtures.
 *
 * @param transcriptPath - path to session transcript JSONL
 *
 * @returns transcript text, or empty string when unreadable
 *
 * @example
 * ```ts
 * await readTranscriptForTest({ transcriptPath: '/tmp/session.jsonl' });
 * ```
 */
async function readTranscriptForTest({
  transcriptPath,
}: Readonly<{
  transcriptPath: string;
}>,): Promise<string> {
  try {
    return await readFile(
      transcriptPath,
      'utf8',
    );
  }
  catch (_error: unknown) {
    return '';
  }
}

//endregion Gerund extraction

export {
  findGerundInText,
  readActivityWord,
  readTranscriptForTest,
  readTranscriptTail,
};
