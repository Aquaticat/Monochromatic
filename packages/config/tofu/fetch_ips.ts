import { existsSync, } from 'node:fs';
import {
  readFile,
  stat,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';
import { json, } from 'node:stream/consumers';

/** Raw OpenTofu `data.external` payload read from stdin; expected to carry an `asn` key. */
const input = await json(process.stdin,) as Record<string, string>;
/** Normalised ASN (uppercased) used both for filtering ipinfo entries and naming the cache file. */
const TARGET_ASN = input.asn?.toUpperCase();

if (!TARGET_ASN)
  throw new Error('No ASN provided',);

/** Per-ASN cache path so each ASN keeps its own snapshot without colliding. */
const CACHE_FILE = join(
  import.meta.dirname,
  `cache_${TARGET_ASN}.json`,
);
/** Cache TTL: ipinfo prefix data changes slowly so a month between refetches is acceptable. */
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1_000;
/** ipinfo Lite dataset endpoint; token is read from env so it stays out of source. */
const URL =
  `https://ipinfo.io/data/ipinfo_lite.json.gz?_src=frontend&token=${process.env.IPINFO_TOKEN}`;

/**
 * Entry point invoked at module load: serves cached IPs when fresh, otherwise streams
 * the ipinfo Lite dataset and writes a comma-joined list of CIDRs matching the target ASN.
 *
 * Output is a JSON object on stdout that OpenTofu's `external` data source consumes.
 */
async function run() {
  // Check Cache
  if (existsSync(CACHE_FILE,)) {
    /** Cache file metadata used to compare mtime against {@link THIRTY_DAYS_MS}. */
    const stats = await stat(CACHE_FILE,);
    if ((Date.now() - stats.mtimeMs) < THIRTY_DAYS_MS) {
      process.stdout.write(
        JSON.stringify({ ips: await readFile(
          CACHE_FILE,
          'utf8',
        ), },),
      );
      return;
    }
  }

  // Stream & Filter (Memory-only)
  try {
    /** HTTP response carrying the gzip-encoded NDJSON body. */
    const response = await fetch(URL,);
    /** Decompressed body stream; reading line-by-line avoids buffering the whole dataset. */
    const stream = response.body!.pipeThrough(new DecompressionStream('gzip',),);
    /** Pull-based reader over the decompressed stream so we drive consumption ourselves. */
    const reader = stream.getReader();
    /** UTF-8 decoder kept across reads via `{ stream: true }` so split codepoints stay intact. */
    const decoder = new TextDecoder();

    /** Accumulator of CIDR networks for entries matching {@link TARGET_ASN}. */
    const ips: string[] = [];
    /** Trailing partial line carried over between chunks until a newline arrives. */
    let leftover = '';

    // oxlint-disable-next-line typescript/no-unnecessary-condition -- streaming read loop
    while (true) {
      /** Next stream chunk: `done` signals end-of-stream, `value` is the raw bytes. */
      const {
        done,
        value,
      } = await reader.read();
      if (done)
        break;

      /** Decoded chunk prefixed with the previous leftover so line splits work across read boundaries. */
      const chunk = leftover + decoder.decode(
        value,
        { stream: true, },
      );
      /** Chunk split on newlines; the last element is held back as the next iteration's leftover. */
      const lines = chunk.split('\n',);
      leftover = lines.pop() ?? '';

      for (const line of lines) {
        // Optimized check: string search before JSON.parse
        if (line.includes(`"asn": "${TARGET_ASN}"`,)) {
          /** Parsed NDJSON record; only `network` is read out, the rest is discarded. */
          const entry = JSON.parse(line,);
          ips.push(entry.network,);
        }
      }
    }

    /** Comma-joined CIDR list ready to write to cache and stream out to OpenTofu. */
    const result = ips.join(',',);
    await writeFile(
      CACHE_FILE,
      result,
    );
    process.stdout.write(JSON.stringify({ ips: result, },),);
  }
  catch {
    // Fallback to expired cache if download fails
    if (existsSync(CACHE_FILE,)) {
      process.stdout.write(
        JSON.stringify({ ips: await readFile(
          CACHE_FILE,
          'utf8',
        ), },),
      );
    }
    else {
      throw new Error('fetch failed and no cached fallback available',);
    }
  }
}

run();
