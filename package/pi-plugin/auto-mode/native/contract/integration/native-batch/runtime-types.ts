/**
 Typed bootstrap contract for the existing native policy runtime.

 @module
 */
import type {
  ExtensionAPI,
  ExtensionContext
} from '@earendil-works/pi-coding-agent';
import type {
  askUser,
  createAssessmentSender
} from '../maintained-policy.mjs';
import type { SemanticAdmissionPolicy } from '../../../../src/semantic-admission-types.ts';
import type { NativeMarkdownParser } from '../../native-index/native-parser-types.ts';
import type { NativeHostSessionInput } from '../native-host/bootstrap-types.ts';

/**
 Native callbacks are forwarded without invoking them or claiming opaque result shapes.
 */
export type NativeForwardedFunction = (...args: never[]) => unknown;

/**
 Native approval retains the latest SDK context and maintained requester identity.
 */
export type NativeApprovalHost = {
  readonly pi: ExtensionAPI;
  readonly ctx: ExtensionContext;
  readonly askUser: typeof askUser;
  readonly verdictEntryType: string;
  readonly trace: (event: string) => void;
};

/**
 Existing native consumers authenticate the forwarded owners before installing policy hooks.
 */
export type NativePolicyRuntimeInput = {
  /**
   Current native session branch supplies explicit user bypass, never model output.
   */
  readonly readBypass?: () => boolean;
  readonly root: NativeHostSessionInput['root'];
  readonly lifecycle: unknown;
  readonly policyInput: unknown;
  readonly rootDirectory: string;
  readonly parsePolicy: NativeMarkdownParser['parse'];
  readonly catalogText?: string;
  readonly files: readonly unknown[];
  readonly send: NativeForwardedFunction;
  readonly effectOwnerFor?: NativeForwardedFunction;
  readonly authorizationOwnerFor?: NativeForwardedFunction;
  readonly semanticAdmissionPolicy?: SemanticAdmissionPolicy;
  readonly headingContextAdmissionPolicy?: SemanticAdmissionPolicy;
  readonly unitAdoptionAdmissionPolicy?: SemanticAdmissionPolicy;
  readonly approvalHost?: () => NativeApprovalHost;
  readonly sendWire?: ReturnType<typeof createAssessmentSender>;
  readonly wrapToolDefinition: NativeForwardedFunction;
  readonly readSessionDisposalState: NativeForwardedFunction;
  readonly trace: (event: string) => void;
  readonly now?: () => number;
  readonly originalStream?: NativeForwardedFunction;
  readonly terminalFetch?: typeof fetch;
};

/**
 Original runtime exposes inspection and completed-session detachment.
 */
export type NativePolicyRuntime = {
  /**
   Original records stay opaque to bootstrap consumers.
   */
  readonly inspect: () => {
    readonly lastJudgment: unknown;
    readonly lastReview: unknown;
    readonly detached: boolean;
  };
  /**
   Existing native hook owner validates completed disposal before removing its hooks.
   */
  readonly detach: () => void;
};
