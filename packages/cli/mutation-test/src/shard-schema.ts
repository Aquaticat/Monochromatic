/**
 * Shard manifest and report schema shared by host and container.
 *
 * The host writes one manifest per shard (mounted read-only); the
 * container writes one report to the report mount. Versioned so future
 * shape changes fail loudly instead of misparsing.
 *
 * @example
 * ```ts
 * const manifest: ShardManifest = {
 *   schemaVersion: 1,
 *   shardId: 'src__a.ts-0',
 *   packagePath: 'packages/module/fs-path',
 *   mutants: [],
 *   tests: ['src/a.unit.test.ts'],
 *   timeoutFloorMs: 5000,
 *   timeoutFactor: 3,
 * };
 * ```
 */

import type {
  Mutant,
  MutantStatus,
} from './engine/types.ts';

/**
 * Current schema version stamped into manifests and reports.
 */
export const SHARD_SCHEMA_VERSION = 1;

/**
 * One shard's worth of work, written by the host.
 */
export type ShardManifest = {
  readonly schemaVersion: typeof SHARD_SCHEMA_VERSION;
  readonly shardId: string;
  readonly packagePath: string;
  readonly mutants: readonly Mutant[];
  readonly tests: readonly string[];
  readonly timeoutFloorMs: number;
  readonly timeoutFactor: number;
};

/**
 * Outcome of one mutant execution inside a shard container.
 *
 * `position` is one-based; position 1 ran in an untainted container, so
 * confirmation runs check it.
 */
export type ShardMutantResult = {
  readonly id: string;
  readonly status: MutantStatus;
  readonly position: number;
  readonly durationMs: number;
  readonly detail: string;
};

/**
 * Baseline measurements taken before any mutant runs.
 */
export type ShardBaseline = {
  readonly green: boolean;
  readonly testsMs: number;
  readonly tsgoMs: number;
  readonly detail: string;
};

/**
 * One shard's results, written by the container to the report mount.
 *
 * `unrun` lists mutant ids abandoned after the first anomaly; the host
 * reshards them into fresh containers.
 */
export type ShardReport = {
  readonly schemaVersion: typeof SHARD_SCHEMA_VERSION;
  readonly shardId: string;
  readonly baseline: ShardBaseline;
  readonly results: readonly ShardMutantResult[];
  readonly unrun: readonly string[];
  readonly anomaly: string;
};
