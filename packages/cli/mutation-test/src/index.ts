/**
 * Library surface of the oxc-based container-native mutation tester.
 *
 * @example
 * ```ts
 * import { enumerateMutants } from '@monochromatic-dev/cli-mutation-test/ts';
 * ```
 */

export {
  enumerateMutants,
  type EnumerationResult,
  type IgnoredMutant,
} from './engine/enumerate.ts';
export {
  lineStarts,
  positionAt,
} from './engine/lines.ts';
export { mutantId, } from './engine/mutant-id.ts';
export { findOperatorToken, } from './engine/operator-token.ts';
export {
  allOperators,
  type OperatorFn,
} from './engine/operators/index.ts';
export { spliceReplacement, } from './engine/splice.ts';
export {
  matchingSuppressions,
  suppressionRules,
  type OxcComment,
  type SuppressionRule,
} from './engine/suppression.ts';
export type {
  EstreeNode,
  Mutant,
  MutantStatus,
  OperatorName,
  Replacement,
} from './engine/types.ts';
export {
  isEstreeNode,
  walk,
} from './engine/walk.ts';
export { effectiveTimeoutMs, } from './container/mutant-loop.ts';
export {
  SHARD_SCHEMA_VERSION,
  type ShardBaseline,
  type ShardManifest,
  type ShardMutantResult,
  type ShardReport,
} from './shard-schema.ts';
export {
  BAKED_ENTRYPOINT,
  MANIFEST_MOUNT,
  REPORT_MOUNT,
  SOURCE_MOUNT,
  WORK_MOUNT,
} from './mounts.ts';
