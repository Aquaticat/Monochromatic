/**
 * Demo corpus generator.
 *
 * Two modes:
 *
 * - `--count=N` -- creates N mixed-size messages distributed roughly
 *   like a real chat archive: P50 ~500 chars, P95 ~5 KB, P99 ~50 KB.
 *   Used by `mise run seed:demo`.
 * - `--huge=N` -- creates ONE message of N gigabytes of synthetic
 *   markdown. Used by `mise run seed:stress` to verify the streaming
 *   path. N may be fractional (e.g. `0.05` for ~50 MB).
 *
 * Identities cycle through `user-a`, `user-b`, `user-c` (seeded by
 * migrations).
 */

import { randomUUID, } from 'node:crypto';

import { getArgumentValue, } from './args.ts';
import {
  createDraft,
  finalizeDraft,
  putChunk,
} from './db/drafts.ts';
import {
  extractPreview,
  renderChunks,
} from './markdown-stream.ts';

/** One kibibyte in bytes. */
const BYTES_PER_KIB = 1_024;

/** One mebibyte in bytes. */
const BYTES_PER_MIB = BYTES_PER_KIB * BYTES_PER_KIB;

/** One gibibyte in bytes. */
const BYTES_PER_GIB = BYTES_PER_MIB * BYTES_PER_KIB;

/** Default `--count=` when not supplied. */
const DEFAULT_MESSAGE_COUNT = 10_000;

/** Decimal radix for `parseInt`. */
const DECIMAL_RADIX = 10;

/** Maximum length of the preview snippet, in characters. */
const PREVIEW_MAX_LENGTH = 200;

/** Progress-print interval in messages. */
const PROGRESS_INTERVAL = 1_000;

/** Distribution thresholds (cumulative probability) for body-size buckets. */
const P50_THRESHOLD = 0.5;

/** 95th percentile threshold. */
const P95_THRESHOLD = 0.95;

/** 99th percentile threshold. */
const P99_THRESHOLD = 0.99;

/** Lower bound (chars) for the P50 size bucket. */
const SIZE_P50_BASE = 200;

/** Range (chars) for the P50 bucket. */
const SIZE_P50_RANGE = 600;

/** Lower bound (chars) for the P95 bucket. */
const SIZE_P95_BASE = 500;

/** Range (chars) for the P95 bucket. */
const SIZE_P95_RANGE = 5_000;

/** Lower bound (chars) for the P99 bucket. */
const SIZE_P99_BASE = 5_000;

/** Range (chars) for the P99 bucket. */
const SIZE_P99_RANGE = 45_000;

/** Lower bound (chars) for the tail bucket. */
const SIZE_TAIL_BASE = 50_000;

/** Range (chars) for the tail bucket. */
const SIZE_TAIL_RANGE = 50_000;

/** Number of distinct block kinds in the synthesizer. */
const BLOCK_KIND_COUNT = 10;

/** Block-kind discriminant for "heading". */
const BLOCK_KIND_HEADING = 6;

/** Block-kind discriminant for "fenced code". */
const BLOCK_KIND_CODE = 7;

/** Maximum heading level (1..3). */
const HEADING_LEVEL_MAX = 3;

/** Heading word-count base. */
const HEADING_WORD_BASE = 3;

/** Heading word-count range. */
const HEADING_WORD_RANGE = 5;

/** Code-block line-count base. */
const CODE_LINE_BASE = 3;

/** Code-block line-count range. */
const CODE_LINE_RANGE = 8;

/** Code-block word-count per line. */
const CODE_WORDS_PER_LINE = 4;

/** Paragraph word-count base. */
const PARAGRAPH_WORD_BASE = 8;

/** Paragraph word-count range. */
const PARAGRAPH_WORD_RANGE = 60;

/** Per-message rng seed multiplier so adjacent indexes diverge quickly. */
const SEED_MULTIPLIER = 1_000;

/** Cycled user ids. Migrations seed all three. */
const SEED_USER_IDS = [
  'user-a',
  'user-b',
  'user-c',
] as const;

/** Words used to compose synthetic messages. */
const LOREM_WORDS = (
  'lorem ipsum dolor sit amet consectetur adipiscing elit sed do '
  + 'eiusmod tempor incididunt ut labore et dolore magna aliqua enim '
  + 'minim veniam quis nostrud exercitation ullamco laboris nisi '
  + 'aliquip ex ea commodo consequat duis aute irure in reprehenderit'
)
  .split(' ',);

/**
 * Returns a deterministic-looking pseudo-random number in [0, 1) seeded
 * by the given integer. Demo seed reproducibility -- `Math.random` is
 * not seedable in Node and we want repeatable corpora.
 *
 * @param seed - integer seed; same seed yields same sequence
 *
 * @returns pseudo-random number in [0, 1)
 */
/* oxlint-disable eslint/no-magic-numbers, unicorn/prefer-math-trunc -- Mulberry32 algorithmic constants and bitwise int coercion */
function rng(seed: number,): number {
  // Mulberry32 step. Cheap and good enough for content distribution.
  let value = seed | 0;
  value = (value + 0x6D_2B_79_F5) | 0;
  let temp = Math.imul(
    value ^ (value >>> 15),
    value | 1,
  );
  temp ^= temp + Math.imul(
    temp ^ (temp >>> 7),
    temp | 61,
  );
  return (((temp ^ (temp >>> 14)) >>> 0) % 100_000) / 100_000;
}
/* oxlint-enable eslint/no-magic-numbers, unicorn/prefer-math-trunc */

/**
 * Builds a synthetic markdown body of approximately the requested size.
 * Mixes paragraphs, occasional headings, and rare fenced code blocks.
 *
 * @param targetBytes - desired source length in bytes
 *
 * @param seed - rng seed for reproducibility
 *
 * @returns markdown source
 */
function synthesizeBody(
  {
    targetBytes,
    seed,
  }: {
    targetBytes: number;
    seed: number;
  },
): string {
  const parts: string[] = [];
  let total = 0;
  let cursor = seed;
  while (total < targetBytes) {
    cursor += 1;
    const r = rng(cursor,);
    const kind = Math.floor(r * BLOCK_KIND_COUNT,);
    let block = '';
    if (kind === BLOCK_KIND_HEADING) {
      const level = 1 + Math.floor(rng(cursor + 1,) * HEADING_LEVEL_MAX,);
      block = `${'#'.repeat(level,)} ${
        pickWords(
          cursor,
          HEADING_WORD_BASE + Math.floor(rng(cursor + 2,) * HEADING_WORD_RANGE,),
        )
      }\n\n`;
    }
    else if (kind === BLOCK_KIND_CODE) {
      const lineCount = CODE_LINE_BASE + Math.floor(rng(cursor + 1,) * CODE_LINE_RANGE,);
      const lines = [];
      for (let i = 0; i < lineCount; i += 1) {
        lines.push(`  ${
          pickWords(
            cursor + i,
            CODE_WORDS_PER_LINE,
          )
        }`,);
      }
      block = `\`\`\`\n${lines.join('\n',)}\n\`\`\`\n\n`;
    }
    else {
      const wordCount = PARAGRAPH_WORD_BASE
        + Math.floor(rng(cursor + 1,) * PARAGRAPH_WORD_RANGE,);
      block = `${
        pickWords(
          cursor,
          wordCount,
        )
      }.\n\n`;
    }
    parts.push(block,);
    total += block.length;
  }
  return parts.join('',);
}

/**
 * Picks `count` words from `LOREM_WORDS` deterministically.
 *
 * @param seed - rng seed
 *
 * @param count - number of words to pick
 *
 * @returns space-joined word string
 */
function pickWords(
  seed: number,
  count: number,
): string {
  const words: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const r = rng(seed + i,);
    const picked = LOREM_WORDS[Math.floor(r * LOREM_WORDS.length,)] ?? '';
    words.push(picked,);
  }
  return words.join(' ',);
}

/**
 * Creates one message by chunking the body and finalising the draft.
 * Mirrors what the server's no-JS path would do, but called directly so
 * seeding does not depend on the HTTP server being up.
 *
 * @param input - body + identity
 *
 * @returns created `messages.id`
 */
async function createMessage(
  input: {
    body: string;
    userId: string;
  },
): Promise<number> {
  const draftId = randomUUID();
  await createDraft({
    id: draftId,
    userId: input.userId,
    parentId: null,
  },);
  let seq = 0;
  let charCount = 0;
  let firstMd = '';
  let chunkCount = 0;
  // Sequential PUTs are required because seq increments per iteration.
  /* oxlint-disable no-await-in-loop */
  for (const chunk of renderChunks(input.body,)) {
    if (seq === 0)
      firstMd = chunk.md;
    await putChunk({
      draftId,
      seq,
      chunk,
    },);
    charCount += chunk.charCount;
    seq += 1;
    chunkCount += 1;
  }
  /* oxlint-enable no-await-in-loop */
  if (chunkCount === 0)
    throw new Error('seed produced empty body',);
  const messageId = await finalizeDraft({
    draftId,
    userId: input.userId,
    charCount,
    chunkCount,
    preview: extractPreview(
      firstMd,
      PREVIEW_MAX_LENGTH,
    ),
  },);
  if (messageId === null)
    throw new Error('finalize returned null for seeded draft',);
  return messageId;
}

/**
 * Runs the seed command. Reads `--count=` or `--huge=` from argv.
 * Logs progress to stdout so the user can watch the seed run.
 *
 * @example
 * ```ts
 * await runSeed(); // reads CLI args
 * ```
 */
export async function runSeed(): Promise<void> {
  const huge = getArgumentValue('huge',);
  const count = getArgumentValue('count',);

  if (huge !== undefined) {
    const gigabytes = Number.parseFloat(huge,);
    if (!Number.isFinite(gigabytes,) || gigabytes <= 0)
      throw new Error(`invalid --huge=${huge}; expected a positive number of gigabytes`,);
    const targetBytes = Math.floor(gigabytes * BYTES_PER_GIB,);
    // oxlint-disable-next-line eslint/no-magic-numbers -- toFixed precision
    console.log(`seeding one ~${gigabytes.toFixed(2,)} GB message...`,);
    const body = synthesizeBody({
      targetBytes,
      seed: 0,
    },);
    const id = await createMessage({
      body,
      userId: SEED_USER_IDS[0],
    },);
    console.log(`created message ${String(id,)} (${String(body.length,)} chars)`,);
    return;
  }

  const messageCount = Number.parseInt(
    count ?? String(DEFAULT_MESSAGE_COUNT,),
    DECIMAL_RADIX,
  );
  if (!Number.isFinite(messageCount,) || messageCount <= 0)
    throw new Error(`invalid --count=${String(count,)}`,);

  console.log(`seeding ${String(messageCount,)} mixed-size messages...`,);
  // Sequential creation keeps stdout progress lines monotonic and avoids
  // overwhelming the SQLite WAL with concurrent writers.
  /* oxlint-disable no-await-in-loop */
  for (let index = 0; index < messageCount; index += 1) {
    const r = rng(index,);
    // Size distribution: P50 ~500, P95 ~5 KB, P99 ~50 KB.
    let bytes = 0;
    if (r < P50_THRESHOLD)
      bytes = SIZE_P50_BASE + Math.floor(rng(index + 1,) * SIZE_P50_RANGE,);
    else if (r < P95_THRESHOLD)
      bytes = SIZE_P95_BASE + Math.floor(rng(index + 1,) * SIZE_P95_RANGE,);
    else if (r < P99_THRESHOLD)
      bytes = SIZE_P99_BASE + Math.floor(rng(index + 1,) * SIZE_P99_RANGE,);
    else
      bytes = SIZE_TAIL_BASE + Math.floor(rng(index + 1,) * SIZE_TAIL_RANGE,);
    const body = synthesizeBody({
      targetBytes: bytes,
      seed: index * SEED_MULTIPLIER,
    },);
    const userId = SEED_USER_IDS[index % SEED_USER_IDS.length] ?? SEED_USER_IDS[0];
    await createMessage({
      body,
      userId,
    },);
    if ((index + 1) % PROGRESS_INTERVAL === 0)
      console.log(`  ${String(index + 1,)} / ${String(messageCount,)}`,);
  }
  /* oxlint-enable no-await-in-loop */
  console.log('done',);
}

if (import.meta.main)
  await runSeed();
