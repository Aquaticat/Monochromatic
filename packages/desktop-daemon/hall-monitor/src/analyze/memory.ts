/** Seconds per minute, used to compose time constants. */
const SECONDS_PER_MINUTE = 60;

/** Milliseconds per second, used to compose time constants. */
const MS_PER_SECOND = 1_000;

/** How long capture sets are retained in the buffer before pruning. */
const RETENTION_MS = 10 * SECONDS_PER_MINUTE * MS_PER_SECOND;

/** Maximum number of capture sets kept in the rolling buffer. */
const MAX_ENTRIES = 3;

/**
 * Screenshot and webcam frame pair captured at a single point in time.
 *
 * @example
 * ```ts
 * const set: CaptureSet = { timestamp: Date.now(), screenshot: buf1, webcam: buf2 };
 * ```
 */
export type CaptureSet = {
  /** Unix epoch milliseconds when the capture was taken. */
  timestamp: number;
  /** JPEG-encoded desktop screenshot. */
  screenshot: Buffer;
  /** JPEG-encoded webcam frame. */
  webcam: Buffer;
};

/**
 * Bounded tuple type enforcing the buffer never exceeds {@link MAX_ENTRIES} entries.
 */
type CaptureBuffer =
  | []
  | [CaptureSet,]
  | [
    CaptureSet,
    CaptureSet,
  ]
  | [
    CaptureSet,
    CaptureSet,
    CaptureSet,
  ];

/** Rolling in-memory buffer of recent capture sets. */
let buffer: CaptureBuffer = [];

/**
 * Appends a capture set to the rolling buffer, evicting the oldest entry
 * if the buffer is at capacity.
 *
 * @param set - capture set to store
 *
 * @example
 * ```ts
 * store({ timestamp: Date.now(), screenshot, webcam });
 * ```
 */
export function store(set: CaptureSet,): void {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- bounded tuple enforced by MAX_ENTRIES slice
  const next = [
    ...buffer,
    set,
  ].slice(-MAX_ENTRIES,) as CaptureBuffer;
  buffer = next;
  prune();
}

/**
 * Returns a shallow copy of all non-expired capture sets in the buffer.
 *
 * @returns array of recent capture sets, oldest first
 *
 * @example
 * ```ts
 * const sets = getRecent();
 * log.debug(`${sets.length} capture set(s) available`);
 * ```
 */
export function getRecent(): CaptureSet[] {
  prune();
  return [...buffer,];
}

/**
 * Checks whether a capture set is newer than the retention cutoff.
 *
 * @param cutoff - minimum timestamp to retain
 *
 * @param s - capture set to check
 *
 * @returns true when the set should be kept
 */
function isAfterCutoff(
  cutoff: number,
  s: CaptureSet,
): boolean {
  return s.timestamp >= cutoff;
}

/**
 * Removes capture sets older than {@link RETENTION_MS} from the buffer.
 */
function prune(): void {
  const cutoff = Date.now() - RETENTION_MS;
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- bounded tuple enforced by filter subset
  buffer = buffer.filter(function checkRetention(s,) {
    return isAfterCutoff(
      cutoff,
      s,
    );
  },) as CaptureBuffer;
}
