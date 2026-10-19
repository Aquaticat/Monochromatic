/**
 Type-only compatibility test compares the genuine judgment factory and
 the kind-free wrapper inputs against the producer owner's real parameters.
 This module emits no runtime code and no fabricated values. @module
 */
import type { createJudgmentConstructor } from '../program-rule-batch-sdk-copy-v2/input/judgment-constructor.ts';
import type { createRequestProducerOwner } from './owner.ts';
import type { ProducerIssuance } from './owner-types.ts';

/**
 Assignability check stays red whenever the value stops fitting its target.
 */
type AssertAssignable<
  Target,
  Value extends Target
> = Value;

/**
 Owner factory options carry the genuine judgment constructor slot.
 */
type OwnerFactoryOptions = NonNullable<Parameters<typeof createRequestProducerOwner>[0]>;

/**
 Owner judgment constructor slot accepts the configured judgment builders.
 */
type OwnerJudgmentSlot = NonNullable<OwnerFactoryOptions['createJudgment']>;

/**
 Owner surface exposes the real wrapper entry shapes.
 */
type OwnerSurface = ReturnType<typeof createRequestProducerOwner>;

/**
 Genuine production judgment factories must fit the owner's judgment slot.
 */
export type GenuineJudgmentBinding = AssertAssignable<
  OwnerJudgmentSlot,
  ReturnType<typeof createJudgmentConstructor>
>;

/**
 Kind-free public invocations must fit the main-agent wrapper entry.
 */
export type MainAgentWrapperInput = AssertAssignable<
  Parameters<OwnerSurface['fromAgentLoop']>[0],
  Omit<ProducerIssuance, 'kind'>
>;

/**
 Kind-free public invocations must fit the auxiliary-summary wrapper entry.
 */
export type AuxiliaryWrapperInput = AssertAssignable<
  Parameters<OwnerSurface['fromAuxiliarySummary']>[0],
  Omit<ProducerIssuance, 'kind'>
>;
