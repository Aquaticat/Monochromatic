import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { parseRateLimitSnapshots, } from './rate-limit-headers.ts';
import {
  PLAIN_USAGE_WARNING_STYLE,
  RATE_LIMIT_WINDOW_SECONDS,
  type RateLimitSnapshot,
  type UsageWarningStyle,
} from './rate-limit-types.ts';
import {
  formatRelativeTime,
  formatUsageWarningSegment,
  formatUsageWarningStatus,
  projectUsagePercent,
} from './usage-warning.ts';

const NOW_MS = Date.parse('2026-06-01T12:00:00Z',);
const SECOND_MS = 1_000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

function resetAt(offsetMs: number,): string {
  return new Date(NOW_MS + offsetMs,).toISOString();
}

function tokenHeaders({
  limit,
  remaining,
  resetOffsetMs,
}: Readonly<{
  limit: number;
  remaining: number;
  resetOffsetMs: number;
}>): Record<string, string> {
  return {
    'anthropic-ratelimit-tokens-limit': String(limit,),
    'anthropic-ratelimit-tokens-remaining': String(remaining,),
    'anthropic-ratelimit-tokens-reset': resetAt(resetOffsetMs,),
  };
}

function inputHeaders({
  limit,
  remaining,
  resetOffsetMs,
}: Readonly<{
  limit: number;
  remaining: number;
  resetOffsetMs: number;
}>): Record<string, string> {
  return {
    'anthropic-ratelimit-input-tokens-limit': String(limit,),
    'anthropic-ratelimit-input-tokens-remaining': String(remaining,),
    'anthropic-ratelimit-input-tokens-reset': resetAt(resetOffsetMs,),
  };
}

function firstSnapshot(headers: Readonly<Record<string, string>>,): RateLimitSnapshot {
  /**
   * First parsed snapshot from supplied header fixture.
   */
  const [snapshot,] = parseRateLimitSnapshots({
    headers,
    nowMs: NOW_MS,
  },);
  if (snapshot === undefined)
    throw new Error('Expected one parsed snapshot',);

  return snapshot;
}

const ANGLE_STYLE: UsageWarningStyle = {
  healthy: function healthy(text: string,): string {
    return `<success>${text}</success>`;
  },
  caution: function caution(text: string,): string {
    return `<warning>${text}</warning>`;
  },
  critical: function critical(text: string,): string {
    return `<error>${text}</error>`;
  },
};

await describe({
  name: 'usage warning formatting',
  children: [
    describe({
      name: formatRelativeTime.name,
      children: [
        it({
          name: 'formats reset times across duration bands',
          fn: async function testRelativeTimeBands() {
            expect(formatRelativeTime({ resetAtMs: NOW_MS, nowMs: NOW_MS, },),)
              .toBe('now',);
            expect(formatRelativeTime({ resetAtMs: NOW_MS + (30 * SECOND_MS), nowMs: NOW_MS, },),)
              .toBe('30s',);
            expect(formatRelativeTime({ resetAtMs: NOW_MS + (5 * MINUTE_MS), nowMs: NOW_MS, },),)
              .toBe('5m',);
            expect(formatRelativeTime({ resetAtMs: NOW_MS + (2 * HOUR_MS) + (30 * MINUTE_MS), nowMs: NOW_MS, },),)
              .toBe('2h30m',);
            expect(formatRelativeTime({ resetAtMs: NOW_MS + (3 * DAY_MS) + (2 * HOUR_MS), nowMs: NOW_MS, },),)
              .toBe('3d2h',);
          },
        },),
      ],
    },),
    describe({
      name: parseRateLimitSnapshots.name,
      children: [
        it({
          name: 'parses headers case-insensitively and clamps rounded remaining capacity',
          fn: async function testParseSnapshots() {
            const snapshots = parseRateLimitSnapshots({
              headers: {
                'Anthropic-Ratelimit-Tokens-Limit': '100',
                'Anthropic-Ratelimit-Tokens-Remaining': '150',
                'Anthropic-Ratelimit-Tokens-Reset': resetAt(HOUR_MS,),
              },
              nowMs: NOW_MS,
            },);

            expect(snapshots.length,).toBe(1,);
            expect(snapshots[0]?.remaining,).toBe(100,);
            expect(snapshots[0]?.remainingPercent,).toBe(100,);
            expect(snapshots[0]?.windowSeconds,).toBe(RATE_LIMIT_WINDOW_SECONDS,);
          },
        },),
        it({
          name: 'ignores incomplete or invalid header groups',
          fn: async function testInvalidHeaders() {
            const snapshots = parseRateLimitSnapshots({
              headers: {
                'anthropic-ratelimit-tokens-limit': '100',
                'anthropic-ratelimit-tokens-remaining': 'not-a-number',
              },
              nowMs: NOW_MS,
            },);

            expect(snapshots.length,).toBe(0,);
          },
        },),
      ],
    },),
    describe({
      name: projectUsagePercent.name,
      children: [
        it({
          name: 'returns zero without stable elapsed window data',
          fn: async function testProjectionSuppression() {
            const lowUsage = firstSnapshot(
              tokenHeaders({ limit: 100, remaining: 96, resetOffsetMs: 30 * SECOND_MS, },),
            );
            const futureReset = firstSnapshot(
              tokenHeaders({ limit: 100, remaining: 80, resetOffsetMs: 70 * SECOND_MS, },),
            );

            expect(projectUsagePercent({ snapshot: lowUsage, nowMs: NOW_MS, },),)
              .toBe(0,);
            expect(projectUsagePercent({ snapshot: futureReset, nowMs: NOW_MS, },),)
              .toBe(0,);
          },
        },),
        it({
          name: 'projects usage from current used percentage and reset time',
          fn: async function testProjectedUsage() {
            const snapshot = firstSnapshot(
              tokenHeaders({ limit: 100, remaining: 60, resetOffsetMs: 40 * SECOND_MS, },),
            );

            expect(projectUsagePercent({ snapshot, nowMs: NOW_MS, },),)
              .toBe(120,);
          },
        },),
      ],
    },),
    describe({
      name: formatUsageWarningSegment.name,
      children: [
        it({
          name: 'hides comfortable capacity without projected overflow',
          fn: async function testComfortableHidden() {
            const snapshot = firstSnapshot(
              tokenHeaders({ limit: 100, remaining: 80, resetOffsetMs: HOUR_MS, },),
            );

            expect(formatUsageWarningSegment({
              snapshot,
              nowMs: NOW_MS,
              style: PLAIN_USAGE_WARNING_STYLE,
            },),).toBe('',);
          },
        },),
        it({
          name: 'formats low remaining capacity with severity colors',
          fn: async function testRemainingWarnings() {
            const caution = firstSnapshot(
              tokenHeaders({ limit: 100, remaining: 20, resetOffsetMs: HOUR_MS, },),
            );
            const critical = firstSnapshot(
              tokenHeaders({ limit: 100, remaining: 8, resetOffsetMs: HOUR_MS, },),
            );

            expect(formatUsageWarningSegment({
              snapshot: caution,
              nowMs: NOW_MS,
              style: ANGLE_STYLE,
            },),).toBe('tokens <warning>20% left</warning> (1h)',);
            expect(formatUsageWarningSegment({
              snapshot: critical,
              nowMs: NOW_MS,
              style: ANGLE_STYLE,
            },),).toBe('tokens <error>8% left</error> (1h)',);
          },
        },),
      ],
    },),
    describe({
      name: formatUsageWarningStatus.name,
      children: [
        it({
          name: 'renders projected overflow even above remaining threshold',
          fn: async function testProjectedOverflowStatus() {
            const current = formatUsageWarningStatus({
              headers: tokenHeaders({ limit: 100, remaining: 60, resetOffsetMs: 40 * SECOND_MS, },),
              nowMs: NOW_MS,
              style: PLAIN_USAGE_WARNING_STYLE,
            },);

            expect(current.statusText,).toBe('tokens 60% left →120% (40s)',);
          },
        },),
        it({
          name: 'joins multiple constrained limiter groups',
          fn: async function testJoinedSegments() {
            const current = formatUsageWarningStatus({
              headers: {
                ...tokenHeaders({ limit: 100, remaining: 40, resetOffsetMs: 3 * HOUR_MS, },),
                ...inputHeaders({ limit: 100, remaining: 20, resetOffsetMs: MINUTE_MS, },),
              },
              nowMs: NOW_MS,
              style: PLAIN_USAGE_WARNING_STYLE,
            },);

            expect(current.statusText,).toBe('tokens 40% left (3h) · input 20% left (1m)',);
          },
        },),
        it({
          name: 'returns empty status text when no complete headers exist',
          fn: async function testEmptyStatus() {
            const current = formatUsageWarningStatus({
              headers: {},
              nowMs: NOW_MS,
              style: PLAIN_USAGE_WARNING_STYLE,
            },);

            expect(current.statusText,).toBe('',);
          },
        },),
      ],
    },),
  ],
},);
