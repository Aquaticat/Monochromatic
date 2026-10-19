/** Collector link declarations follow the maintained snapshot ownership implementation. @module */
import type {
  HostPromptInput,
  PolicyInputBinding,
  PolicyLoaderHandle,
  ResourceToolInputOrigin,
  SessionConstructedInputsReader,
  SessionDomainEventsReader
} from './policy-loader-types.ts';

/** Original collector retains snapshots and approval handoff operations. */
export type PolicyInputCollector = {
  readonly capture: (options?: unknown) => unknown;
  readonly assertObservedFresh: (snapshot: unknown) => void;
  readonly retainExecutionSources: (snapshot: unknown) => void;
  readonly captureJudgmentSources: (input: {
    readonly original: unknown;
    readonly signal: unknown;
    readonly extend?: boolean;
  }) => unknown;
};

/* oxlint-disable no-restricted-syntax/no-nullish-union -- These link fields mirror the untyped policy-input-collector.mjs contract whose optional fixed readers and host prompt travel onward unchanged to its `??` and presence consumers. */
/**
 Collector link keeps the original snapshot and approval retention operations.

 @param input - fixed readers, currentness operations and the original base collector
 */
export function retainPolicyInput(input: {
  readonly readSessionConstructedInputs: SessionConstructedInputsReader | undefined;
  readonly readSessionDomainEvents: SessionDomainEventsReader | undefined;
  readonly readCurrent: () => PolicyInputBinding;
  readonly assertCurrent: (binding: unknown) => void;
  readonly assertInputBudget: (session: unknown) => void;
  readonly resourceInputs: () => readonly ResourceToolInputOrigin[] | undefined;
  readonly hostPrompt: HostPromptInput | undefined;
  readonly base: unknown;
  readonly session?: unknown;
}): PolicyInputCollector;
/* oxlint-enable no-restricted-syntax/no-nullish-union */

/** Policy input binding re-export keeps the collector link contract complete. */
export type { PolicyInputBinding, PolicyLoaderHandle };
