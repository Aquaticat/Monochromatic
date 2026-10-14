/**
 Original producer and source references are borrowed from their existing owners. @module
 */
import type {
  ContributionRun,
  ContributionSource,
  SourceContributionAssociation,
} from '../../../../src/source-contribution-types.ts';

/**
 Original source memberships already authenticated by the native request owner.
 */
export type ToolAssociationSources = {
  readonly nativeRunComposition?: ContributionRun;
  readonly governingSources: readonly ContributionSource[];
};

/**
 Producer observations and bounded copying remain with their original native implementations.
 */
export type ToolAssociationDefinition = {
  readonly sources: ToolAssociationSources;
  readonly dataRecord: (value: unknown) => value is Record<string, unknown>;
  readonly denseArray: (value: unknown) => value is readonly unknown[];
  readonly copyToolData: (value: unknown) => unknown;
  readonly readToolPublication: (value: unknown) => unknown;
  readonly readToolEmission: (value: unknown) => unknown;
};

/**
 Each owned value originates in the serializer's original conversion callback.
 */
export type ToolAssociationEmission = {
  readonly original?: unknown;
  readonly ordinal: number;
  readonly association?: SourceContributionAssociation;
  readonly serialization?: Readonly<Record<string, unknown>>;
  readonly value?: unknown;
  readonly reason?: string;
};

/**
 Partial tool contribution receives its request identity at the incumbent observation boundary.
 */
export type ToolAssociationContribution = {
  readonly contribution: object;
  readonly location: {
    readonly field: 'tools';
    readonly ordinal: number
  };
  readonly association?: SourceContributionAssociation;
  readonly serialization?: Readonly<Record<string, unknown>>;
  readonly reason?: string;
  readonly coverage: 'partial-original-prompt-input-contribution';
  readonly permission: false;
};

/**
 Original serializer capture and request sealing share one owned custody lifetime.
 */
export type NativeToolAssociation = {
  readonly capture: (input: {
    readonly payload: unknown;
    readonly origin: unknown;
    readonly eligible: boolean
  }) => void;
  readonly retain: (selected: unknown) => unknown;
  readonly seal: (parsed: Readonly<Record<string, unknown>>) => readonly ToolAssociationContribution[];
};
