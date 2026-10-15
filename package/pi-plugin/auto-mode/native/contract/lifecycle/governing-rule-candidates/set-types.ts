/**
 Original governing-source sets preserve per-source membership and duplicate-code ambiguity. @module
 */
import type {
  GoverningBindingInput,
  GoverningBindingSnapshot,
  GoverningRuleProjection,
  GoverningSource,
} from './binding-types.ts';

/**
 Source position augments the original projection without replacing occurrence identity.
 */
export type GoverningSetProjection = GoverningRuleProjection & Readonly<{ sourceOrdinal: number }>;

/**
 Original source snapshots retain their position and occurrence in the selected source list.
 */
export type GoverningSetSnapshot = GoverningBindingSnapshot & Readonly<{
  sourceOrdinal: number;
  sourceOccurrence: unknown;
}>;

/**
 Bootstrap retains the exact immutable source list and original qualified parser.
 */
export type GoverningSetInput = Readonly<{
  readSources: () => readonly GoverningSource[];
  parse: GoverningBindingInput['parse'];
}>;

/**
 Set operations authenticate original source and clause identities without merging equal content.
 */
export type GoverningRuleSet = Readonly<{
  indexedCandidates: () => readonly Readonly<object>[];
  indexedInstructionCandidates: () => readonly Readonly<object>[];
  indexedHeadingContextCandidates: () => readonly Readonly<object>[];
  read: (handle: unknown) => GoverningSetProjection;
  select: (code: unknown) => Readonly<object>;
  inspect: () => readonly GoverningSetSnapshot[];
}>;
