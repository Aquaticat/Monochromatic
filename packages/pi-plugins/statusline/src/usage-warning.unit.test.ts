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

function resetAtEpochSeconds(offsetMs: number,): string {
  return String((NOW_MS + offsetMs) / SECOND_MS,);
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

function codexHeaders({
  usedPercent,
  windowMinutes,
  resetOffsetMs,
}: Readonly<{
  usedPercent: number;
  windowMinutes: number;
  resetOffsetMs: number;
}>): Record<string, string> {
  return {
    'x-codex-primary-used-percent': String(usedPercent,),
    'x-codex-primary-window-minutes': String(windowMinutes,),
    'x-codex-primary-reset-at': resetAtEpochSeconds(resetOffsetMs,),
  };
}

function syntheticQuotasHeader(quotas: unknown,): Record<string, string> {
  return {
    'x-synthetic-quotas': JSON.stringify(quotas,),
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
  green: function green(text: string,): string {
    return `<green>${text}</green>`;
  },
  yellow: function yellow(text: string,): string {
    return `<yellow>${text}</yellow>`;
  },
  red: function red(text: string,): string {
    return `<red>${text}</red>`;
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
          name: 'parses Anthropic headers case-insensitively',
          fn: async function testAnthropicSnapshots() {
            const snapshots = parseRateLimitSnapshots({
              headers: {
                'Anthropic-Ratelimit-Tokens-Limit': '100',
                'Anthropic-Ratelimit-Tokens-Remaining': '25',
                'Anthropic-Ratelimit-Tokens-Reset': resetAt(40 * SECOND_MS,),
              },
              nowMs: NOW_MS,
            },);

            expect(snapshots.length,).toBe(1,);
            expect(snapshots[0]?.label,).toBe('anthropic tokens',);
            expect(snapshots[0]?.usedPercent,).toBe(75,);
            expect(snapshots[0]?.windowSeconds,).toBe(RATE_LIMIT_WINDOW_SECONDS,);
          },
        },),
        it({
          name: 'parses Codex subscription headers',
          fn: async function testCodexSnapshots() {
            const snapshots = parseRateLimitSnapshots({
              headers: codexHeaders({
                usedPercent: 30,
                windowMinutes: 300,
                resetOffsetMs: 4 * HOUR_MS,
              },),
              nowMs: NOW_MS,
            },);

            expect(snapshots.length,).toBe(1,);
            expect(snapshots[0]?.label,).toBe('codex 5h',);
            expect(snapshots[0]?.usedPercent,).toBe(30,);
          },
        },),
        it({
          name: 'parses Codex secondary and dynamic limit headers',
          fn: async function testCodexDynamicSnapshots() {
            const snapshots = parseRateLimitSnapshots({
              headers: {
                'x-codex-secondary-used-percent': '40',
                'x-codex-secondary-window-minutes': '300',
                'x-codex-secondary-reset-at': resetAtEpochSeconds(4 * HOUR_MS,),
                'x-codex-bengalfox-primary-used-percent': '30',
                'x-codex-bengalfox-primary-window-minutes': '300',
                'x-codex-bengalfox-primary-reset-at': resetAtEpochSeconds(4 * HOUR_MS,),
                'x-codex-bengalfox-limit-name': 'gpt-5.2-codex-sonic',
              },
              nowMs: NOW_MS,
            },);

            expect(snapshots.length,).toBe(2,);
            expect(snapshots[0]?.label,).toBe('codex 5h secondary',);
            expect(snapshots[1]?.label,).toBe('gpt-5.2-codex-sonic 5h',);
          },
        },),
        it({
          name: 'skips Synthetic quota windows that are not pace-projectable',
          fn: async function testSyntheticUnsupportedWindows() {
            const snapshots = parseRateLimitSnapshots({
              headers: syntheticQuotasHeader({
                rollingFiveHourLimit: {
                  nextTickAt: resetAt(30 * MINUTE_MS,),
                  tickPercent: 0.1,
                  remaining: 5,
                  max: 100,
                  limited: false,
                },
                subscription: {
                  limit: 100,
                  requests: 95,
                  renewsAt: resetAt(2 * HOUR_MS,),
                },
              },),
              nowMs: NOW_MS,
            },);

            expect(snapshots.length,).toBe(0,);
          },
        },),
        it({
          name: 'parses Synthetic quotas header',
          fn: async function testSyntheticSnapshots() {
            const snapshots = parseRateLimitSnapshots({
              headers: syntheticQuotasHeader({
                search: {
                  hourly: {
                    limit: 100,
                    requests: 60,
                    renewsAt: resetAt(30 * MINUTE_MS,),
                  },
                },
              },),
              nowMs: NOW_MS,
            },);

            expect(snapshots.length,).toBe(1,);
            expect(snapshots[0]?.label,).toBe('synthetic search',);
            expect(snapshots[0]?.usedPercent,).toBe(60,);
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
          name: 'formats low remaining capacity when projection stays within the window',
          fn: async function testLowRemainingWarning() {
            const snapshot = firstSnapshot(
              tokenHeaders({ limit: 100, remaining: 20, resetOffsetMs: 10 * SECOND_MS, },),
            );

            expect(formatUsageWarningSegment({
              snapshot,
              nowMs: NOW_MS,
              style: PLAIN_USAGE_WARNING_STYLE,
            },),).toBe('anthropic tokens 20% left (10s)',);
          },
        },),
        it({
          name: 'formats projected overflow with overflow color',
          fn: async function testOverflowWarning() {
            const snapshot = firstSnapshot(
              tokenHeaders({ limit: 100, remaining: 60, resetOffsetMs: 40 * SECOND_MS, },),
            );

            expect(formatUsageWarningSegment({
              snapshot,
              nowMs: NOW_MS,
              style: ANGLE_STYLE,
            },),).toBe('anthropic tokens <red>60% left →120%</red> (40s)',);
          },
        },),
      ],
    },),
    describe({
      name: formatUsageWarningStatus.name,
      children: [
        it({
          name: 'renders Codex projected overflow',
          fn: async function testCodexOverflowStatus() {
            const current = formatUsageWarningStatus({
              headers: codexHeaders({
                usedPercent: 30,
                windowMinutes: 300,
                resetOffsetMs: 4 * HOUR_MS,
              },),
              nowMs: NOW_MS,
              style: PLAIN_USAGE_WARNING_STYLE,
            },);

            expect(current.statusText,).toBe('codex 5h 70% left →150% (4h)',);
          },
        },),
        it({
          name: 'renders Synthetic projected overflow',
          fn: async function testSyntheticOverflowStatus() {
            const current = formatUsageWarningStatus({
              headers: syntheticQuotasHeader({
                search: {
                  hourly: {
                    limit: 100,
                    requests: 60,
                    renewsAt: resetAt(30 * MINUTE_MS,),
                  },
                },
              },),
              nowMs: NOW_MS,
              style: PLAIN_USAGE_WARNING_STYLE,
            },);

            expect(current.statusText,).toBe('synthetic search 40% left →120% (30m)',);
          },
        },),
        it({
          name: 'renders Synthetic weekly projection using daily regen pace',
          fn: async function testSyntheticWeeklyOverflowStatus() {
            const current = formatUsageWarningStatus({
              headers: syntheticQuotasHeader({
                weeklyTokenLimit: {
                  nextRegenAt: resetAt(20 * HOUR_MS,),
                  percentRemaining: 80,
                  maxCredits: '$100.00',
                  remainingCredits: '$80.00',
                  nextRegenCredits: '$10.00',
                },
              },),
              nowMs: NOW_MS,
              style: PLAIN_USAGE_WARNING_STYLE,
            },);

            expect(current.statusText,).toBe('synthetic week 80% left →840% (20h)',);
          },
        },),
        it({
          name: 'joins multiple projected overflow groups',
          fn: async function testJoinedSegments() {
            const current = formatUsageWarningStatus({
              headers: {
                ...tokenHeaders({ limit: 100, remaining: 60, resetOffsetMs: 40 * SECOND_MS, },),
                ...codexHeaders({ usedPercent: 30, windowMinutes: 300, resetOffsetMs: 4 * HOUR_MS, },),
              },
              nowMs: NOW_MS,
              style: PLAIN_USAGE_WARNING_STYLE,
            },);

            expect(current.statusText,).toBe('anthropic tokens 60% left →120% (40s) · codex 5h 70% left →150% (4h)',);
          },
        },),
        it({
          name: 'returns empty status text when no projected overflow exists',
          fn: async function testEmptyStatus() {
            const current = formatUsageWarningStatus({
              headers: tokenHeaders({ limit: 100, remaining: 80, resetOffsetMs: 10 * SECOND_MS, },),
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
