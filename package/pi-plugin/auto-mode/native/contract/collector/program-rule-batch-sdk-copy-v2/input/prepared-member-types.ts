/**
 Original member preparation borrows complete-group state and native lifecycle capabilities. @module
 */
import type { ProgramNativeCall } from './program-operation-types.ts';

/**
 Optional properties retain original primitive truthiness and opaque preparation reasons.
 */
export type PreparedDecisionProperties = Readonly<{
  block?: unknown;
  reason?: unknown
}>;

/**
 Original manifest members keep independently sealed input snapshots.
 */
export type PreparedMember = Readonly<{
  groupExecutionMode: 'sequential' | 'parallel';
  id: string;
  name: string;
  input: unknown;
}>;

/**
 Original readiness lookup may expose a missing member in malformed runtime fixtures.
 */
export type PreparedMemberLookup = ReturnType<Map<string, PreparedMember>['get']>;

/**
 Preparation retains original shared state without acquiring ownership of the dispatcher.
 */
export type PreparedMemberInput = Readonly<{
  hook: Readonly<{ args: unknown }>;
  call: ProgramNativeCall;
  memberState: { entered: boolean };
  batchState: {
    assessmentStarted: boolean;
    decision?: PreparedDecisionProperties
  };
  ready: Map<string, PreparedMember>;
  scheduled: readonly ProgramNativeCall[];
  snapshots: (readonly PreparedMemberLookup[])[];
  failures: unknown[];
  serial: boolean;
  signal: unknown;
  gate: Readonly<{
    promise: Promise<PreparedDecisionProperties>;
    resolve: (decision: PreparedDecisionProperties) => unknown;
  }>;
  active: (stage: string) => unknown;
  prepare: (hook: Readonly<{ args: unknown }>) => unknown;
  block: (reason: unknown) => unknown;
  sealInput: (input: unknown) => unknown;
  releasePreparation: () => unknown;
  assess: (input: Readonly<{
    members: readonly PreparedMemberLookup[];
    signal: unknown
  }>) => unknown;
  PreparedBatchContractError: new (message: string) => Error;
}>;
