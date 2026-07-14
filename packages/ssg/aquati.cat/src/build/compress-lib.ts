/**
 * Pure helpers for the dist/ zstd compression stage: branded counts, the
 * worker-count heuristic, file distribution, tally arithmetic, and the
 * per-bucket compression itself.
 *
 * Split out of `compress.ts` so the entry file stays under the max-lines budget
 * and so these branchless functions are importable by both the main thread and
 * the worker branch. The self-referential `new Worker(new URL(import.meta.url))`
 * dispatch stays in `compress.ts`, whose URL is the file with both branches.
 *
 * @see docs/decisions/zstd-cli-to-node-zlib.md for the engine, level, and threading evidence.
 */
import {
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { readFile, } from 'node:fs/promises';
import { availableParallelism, } from 'node:os';
import { extname, } from 'node:path';
import zlib from 'node:zlib';

//region Branded types, sentinel, and shared configuration

/**
 * Distinct physical CPU cores parsed from the host topology. Branded (per the
 * repo's `CssValue` idiom) so a raw integer derived from anything else cannot be
 * passed where a deliberate core count is required.
 */
type PhysicalCores = number & { readonly __physicalCores: unique symbol; };

/**
 * Resolved worker-thread count for the compression fan-out. Branded so it can't
 * be confused with the unbranded inputs (file count, parallelism, override) it
 * is derived from.
 */
type WorkerCount = number & { readonly __workerCount: unique symbol; };

/**
 * Per-worker compression outcome, summed by the main thread into one summary.
 */
export type Tally = {
  readonly written: number;
  readonly skipped: number;
  readonly savedBytes: number;
};

/**
 * Sentinel returned by {@link physicalCoreCount} when the host's physical-core
 * topology can't be read (non-Linux, or /proc/cpuinfo absent or lacking the
 * fields). A `unique symbol`, never 0/undefined, so a real count of any value
 * can never be mistaken for absence; callers narrow with `typeof === 'symbol'`.
 */
const CORES_UNDETECTED: unique symbol = Symbol('compress/physical-core-topology-unreadable',);

/**
 * node:zlib constants namespace; the zstd parameter ids are read from here.
 * Aliased once so the per-parameter keys below stay single-step member accesses.
 */
const zstdConstants = zlib.constants;

/**
 * zstd compression level for precompressed static assets. Level 19 is the best
 * practical ratio; see docs/decisions/zstd-cli-to-node-zlib.md for the curve.
 */
const COMPRESSION_LEVEL = 19;

/**
 * Exact zstd parameters. Checksum and content-size flags are pinned off to match
 * the old CLI flags (--no-check, --no-content-size) rather than rely on library
 * defaults.
 */
const ZSTD_OPTIONS = {
  params: {
    [zstdConstants.ZSTD_c_compressionLevel]: COMPRESSION_LEVEL,
    [zstdConstants.ZSTD_c_contentSizeFlag]: 0,
    [zstdConstants.ZSTD_c_checksumFlag]: 0,
  },
} as const;

/**
 * Extensions skipped without being read: formats a level-19 zstd pass cannot
 * shrink, established by benchmark on real content (a 1080p cartoon's frames,
 * audio, and video, plus this site's own assets; see
 * docs/decisions/zstd-cli-to-node-zlib.md).
 *
 * Each kept entry gains roughly 0% under zstd: avif, webp (lossy and lossless),
 * gif, jxl (lossy and lossless), woff/woff2 (font tables are already deflate /
 * brotli), gz/br (compression formats by definition), mp3 (~0.7%), flac (~0.3%),
 * and h264/vp9 video (mp4/webm/mov, ~0.1-0.3%). zst is always skipped (never
 * recompress a `.zst`).
 *
 * Formats zstd DOES shrink further are deliberately absent so they fall through
 * to keep-if-smaller: png and jpg/jpeg (~1%, this site's icons up to ~15%),
 * ogg vorbis (~3.6%), and aac/m4a (~6%). Uncompressed table formats (ttf/otf/ico)
 * are absent for the same reason.
 */
const INCOMPRESSIBLE_EXTENSIONS: ReadonlySet<string> = new Set([
  'zst',
  'gz',
  'br',
  'avif',
  'webp',
  'gif',
  'jxl',
  'woff',
  'woff2',
  'mp4',
  'webm',
  'mov',
  'mp3',
  'flac',
],);

/**
 * Zero-valued tally used as the reduce seed for both the worker fan-out and the
 * main-thread aggregate. Never mutated; each reduce step returns a fresh object.
 */
export const EMPTY_TALLY: Tally = {
  written: 0,
  skipped: 0,
  savedBytes: 0,
};

//endregion Branded types, sentinel, and shared configuration

//region Branded-count construction

/**
 * Brands a caller-validated integer as a {@link PhysicalCores} count.
 *
 * A brand adds no runtime shape, only a compile-time tag, so an assertion is the
 * only way to mint one.
 *
 * @param value - non-negative core count already validated by the caller
 *
 * @returns value tagged as `PhysicalCores`
 *
 * @example
 * ```ts
 * const cores = asPhysicalCores({ value: 8, },);
 * ```
 */
function asPhysicalCores(
  { value, }: { readonly value: number; },
): PhysicalCores {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- nominal brand; PhysicalCores is `number & tag`, mintable only by assertion
  return value as PhysicalCores;
}

/**
 * Brands a caller-validated integer as a {@link WorkerCount}.
 *
 * A brand adds no runtime shape, only a compile-time tag, so an assertion is the
 * only way to mint one.
 *
 * @param value - positive worker count already capped by the caller
 *
 * @returns value tagged as `WorkerCount`
 *
 * @example
 * ```ts
 * const workers = asWorkerCount({ value: 8, },);
 * ```
 */
function asWorkerCount(
  { value, }: { readonly value: number; },
): WorkerCount {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- nominal brand; WorkerCount is `number & tag`, mintable only by assertion
  return value as WorkerCount;
}

//endregion Branded-count construction

//region Worker-count heuristic

/**
 * Reads /proc/cpuinfo, returning the {@link CORES_UNDETECTED} sentinel instead of
 * throwing when it is missing or unreadable.
 *
 * Runs only on the main thread, so it stays clear of the file-header rule that
 * keeps the tagged logger out of this worker-shared module: the rare read
 * failure is surfaced with a plain `console` build diagnostic rather than the
 * logger.
 *
 * @returns raw cpuinfo text, or {@link CORES_UNDETECTED} on any read failure
 *
 * @example
 * ```ts
 * const text = await readCpuinfo();
 * ```
 */
async function readCpuinfo(): Promise<string | typeof CORES_UNDETECTED> {
  try {
    return await readFile(
      '/proc/cpuinfo',
      'utf8',
    );
  }
  catch (error) {
    console.warn(
      `compress: /proc/cpuinfo unreadable; falling back to a parallelism-derived worker estimate (${
        String(error,)
      })`,
    );
    return CORES_UNDETECTED;
  }
}

/**
 * Counts distinct physical CPU cores on Linux by parsing /proc/cpuinfo.
 *
 * Physical cores (distinct (physical id, core id) pairs) track the benchmark's
 * 4-to-10-worker plateau better than the logical count. Returns the
 * {@link CORES_UNDETECTED} sentinel off Linux, when /proc/cpuinfo is absent, or when
 * the topology fields are missing (e.g. ARM cpuinfo), so the caller falls back
 * to a parallelism-derived estimate.
 *
 * @returns physical-core count, or {@link CORES_UNDETECTED} when undetectable
 *
 * @example
 * ```ts
 * const cores = await physicalCoreCount(); // 8 on an 8-core / 16-thread host
 * ```
 */
async function physicalCoreCount(): Promise<PhysicalCores | typeof CORES_UNDETECTED> {
  if (process.platform !== 'linux')
    return CORES_UNDETECTED;
  /**
   * Raw cpuinfo text; one blank-line-separated block per logical processor,
   * or the sentinel when /proc/cpuinfo is missing or unreadable.
   */
  const cpuinfo = await readCpuinfo();
  if ((typeof cpuinfo) === 'symbol')
    return CORES_UNDETECTED;
  /**
   * Sentinel for absent CPU topology field.
   */
  const CPU_FIELD_ABSENT: unique symbol = Symbol('CPU topology field absent',);
  /**
   * Observational CPU topology fields before completeness filtering.
   */
  type CpuFields = Readonly<{
    socket: string | typeof CPU_FIELD_ABSENT;
    core: string | typeof CPU_FIELD_ABSENT;
  }>;
  /**
   * Distinct `<physical id>|<core id>` keys; one per physical core.
   */
  const coreKeys = new Set(
    cpuinfo
      .split('\n\n',)
      .map(function fieldsForBlock(block,) {
        /**
         * Field lines of this processor block.
         */
        const lines = block.split('\n',);
        return {
          socket: lines.find(function isSocket(line,) {
            return line.startsWith('physical id',);
          },) ?? CPU_FIELD_ABSENT,
          core: lines.find(function isCore(line,) {
            return line.startsWith('core id',);
          },) ?? CPU_FIELD_ABSENT,
        } satisfies CpuFields;
      },)
      .filter(function hasBothFields(
        fields: CpuFields,
      ): fields is {
        readonly socket: string;
        readonly core: string;
      } {
        return (fields.socket !== CPU_FIELD_ABSENT)
          && (fields.core !== CPU_FIELD_ABSENT);
      },)
      .map(function keyForFields(fields,) {
        return `${fields.socket}|${fields.core}`;
      },),
  );
  if (coreKeys.size === 0)
    return CORES_UNDETECTED;
  return asPhysicalCores({ value: coreKeys.size, },);
}

/**
 * Resolves the worker count for the fan-out.
 *
 * Precedence: an explicit `ZSTD_WORKERS` env override (escape hatch), else a
 * heuristic of physical cores, falling back to half the available parallelism
 * when cores are undetectable. Both paths are capped by {@link availableParallelism}
 * and the file count. The {@link availableParallelism} cap is mandatory:
 * /proc/cpuinfo reports host topology and would oversubscribe a CPU-limited
 * container or CI runner, whereas {@link availableParallelism} respects cgroup
 * quotas.
 *
 * @param fileCount - candidate count; >= 1 (callers handle the empty case) and an upper bound on useful workers
 *
 * @returns worker count, always >= 1
 *
 * @throws When `ZSTD_WORKERS` is set but not a positive integer
 *
 * @example
 * ```ts
 * const workers = await resolveWorkerCount({ fileCount: 412, },); // 8 on an 8-core host
 * ```
 */
export async function resolveWorkerCount(
  { fileCount, }: { readonly fileCount: number; },
): Promise<WorkerCount> {
  /**
   * Logical parallelism Node recommends; respects cgroup/CPU quotas.
   */
  const available = availableParallelism();
  /**
   * Raw `ZSTD_WORKERS` override, when the operator set one.
   */
  const { ZSTD_WORKERS: override, } = process.env;
  if (override !== undefined) {
    /**
     * Parsed override; must be a positive integer to be usable.
     */
    const requested = Number(override,);
    if ((!Number.isInteger(requested,)) || (requested < 1))
      throw new Error(`ZSTD_WORKERS must be a positive integer, got: ${override}`,);
    return asWorkerCount({
      value: Math.min(
        requested,
        fileCount,
      ),
    },);
  }
  /**
   * Detected physical cores, or the {@link CORES_UNDETECTED} sentinel.
   */
  const detected = await physicalCoreCount();
  /**
   * Pre-cap estimate: physical cores when known, else half the logical count.
   */
  const estimate = (typeof detected) === 'symbol'
    ? Math.floor(available / 2,)
    : detected;
  return asWorkerCount({
    value: Math.max(
      1,
      Math.min(
        estimate,
        available,
        fileCount,
      ),
    ),
  },);
}

//endregion Worker-count heuristic

//region Fan-out helpers

/**
 * Round-robins candidate files into per-worker buckets.
 *
 * Index-based round-robin spreads large and small files across workers rather
 * than clustering them, which a contiguous split would risk.
 *
 * @param files - candidate file paths
 *
 * @param workers - bucket count; >= 1
 *
 * @returns one path bucket per worker
 *
 * @example
 * ```ts
 * distribute({ files: ['a', 'b', 'c',], workers: 2, },); // [['a', 'c'], ['b']]
 * ```
 */
export function distribute(
  {
    files,
    workers,
  }: {
    readonly files: readonly string[];
    readonly workers: number;
  },
): readonly (readonly string[])[] {
  return Array.from(
    { length: workers, },
    function bucketAt(
      _value,
      bucketIndex,
    ) {
      return files.filter(function inBucket(
        _file,
        fileIndex,
      ) {
        return (fileIndex % workers) === bucketIndex;
      },);
    },
  );
}

/**
 * Sums two tallies field by field.
 *
 * @param left - running total
 *
 * @param right - tally to fold in
 *
 * @returns combined tally
 *
 * @example
 * ```ts
 * addTallies({ left: EMPTY_TALLY, right: { written: 1, skipped: 0, savedBytes: 9, }, },);
 * ```
 */
export function addTallies(
  {
    left,
    right,
  }: {
    readonly left: Tally;
    readonly right: Tally;
  },
): Tally {
  return {
    written: left.written + right.written,
    skipped: left.skipped + right.skipped,
    savedBytes: left.savedBytes + right.savedBytes,
  };
}

//endregion Fan-out helpers

//region Per-bucket compression

/**
 * Compresses an assigned bucket, returning a tally.
 *
 * For each file it removes any stale `<file>.zst` first (self-cleaning even when
 * run standalone), skips already-compressed extensions without reading them, and
 * otherwise writes a fresh `<file>.zst` only when strictly smaller than source.
 *
 * @param files - path bucket to process
 *
 * @returns tally of written, skipped, and bytes saved
 *
 * @example
 * ```ts
 * const tally = compressBucket({ files: ['dist/index.html',], },);
 * ```
 */
export function compressBucket(
  { files, }: { readonly files: readonly string[]; },
): Tally {
  return files.reduce(
    function compressInto(
      acc: Tally,
      file: string,
    ): Tally {
      /**
       * Companion output path for this source.
       */
      const zstPath = `${file}.zst`;
      // oxlint-disable-next-line no-restricted-syntax/no-sync -- structurally sync: co-located in the zstd worker-thread compression loop; see docs/decisions/zstd-cli-to-node-zlib.md
      rmSync(
        zstPath,
        { force: true, },
      );
      /**
       * Lowercased extension without the leading dot.
       */
      const extension = extname(file,)
        .slice(1,)
        .toLowerCase();
      if (INCOMPRESSIBLE_EXTENSIONS.has(extension,))
        return {
          written: acc.written,
          skipped: acc.skipped + 1,
          savedBytes: acc.savedBytes,
        };
      /* oxlint-disable no-restricted-syntax/no-sync -- structurally sync: zstd worker-thread compression loop, async zstdCompress ~6x slower; see docs/decisions/zstd-cli-to-node-zlib.md */
      /**
       * Source bytes read once for compression and the size comparison.
       */
      const source = readFileSync(file,);
      /**
       * Compressed bytes; kept only when strictly smaller than the source.
       */
      const compressed = zlib.zstdCompressSync(
        source,
        ZSTD_OPTIONS,
      );
      /* oxlint-enable no-restricted-syntax/no-sync */
      if (compressed.length >= source.length)
        return {
          written: acc.written,
          skipped: acc.skipped + 1,
          savedBytes: acc.savedBytes,
        };
      // oxlint-disable-next-line no-restricted-syntax/no-sync -- structurally sync: co-located in the zstd worker-thread compression loop; see docs/decisions/zstd-cli-to-node-zlib.md
      writeFileSync(
        zstPath,
        compressed,
      );
      return {
        written: acc.written + 1,
        skipped: acc.skipped,
        savedBytes: acc.savedBytes + (source.length - compressed.length),
      };
    },
    EMPTY_TALLY,
  );
}

//endregion Per-bucket compression
