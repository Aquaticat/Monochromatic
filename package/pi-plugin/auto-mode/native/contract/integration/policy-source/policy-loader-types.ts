/**
 Policy-loader boundary contracts derive from the maintained native resource,
 frame,
 source and session interfaces.
 @module
 */
import type { ResourceLoader } from '@earendil-works/pi-coding-agent';
import type { NativePolicyDesignation } from '../native-host/bootstrap-types.ts';
import type { ResourceContextSnapshot } from '../../collector/resource-input-custody/values.ts';
import type { copyAuthorityRegistration } from './registration.mjs';

//region Resource frames retain the original native phase snapshots.

/**
 Original context phase retains the detached native context snapshot.
 */
export type ResourceContextStage = {
  readonly kind: 'context';
  readonly before: ResourceContextSnapshot;
  readonly after: ResourceContextSnapshot;
  readonly transformation: string;
};

/**
 Original system phase retains the explicit host system text or its exact absence.
 Absence mirrors the native system prompt reader unchanged.
 */
export type ResourceSystemStage = {
  readonly kind: 'system';
  readonly before: ReturnType<ResourceLoader['getSystemPrompt']>;
  readonly after: ReturnType<ResourceLoader['getSystemPrompt']>;
  readonly transformation: string;
};

/**
 Original append phase retains the complete ordered appendix texts.
 */
export type ResourceAppendStage = {
  readonly kind: 'append';
  readonly before: readonly string[];
  readonly after: readonly string[];
  readonly transformation: string;
};

/**
 Complete native phase sequence retains every original stage occurrence.
 */
export type PolicyResourceStage = ResourceContextStage | ResourceSystemStage | ResourceAppendStage;

/**
 Bound resource frame keeps its original occurrence and ordered stages.
 */
export type PolicyResourceFrame = {
  readonly occurrence: object;
  readonly ordinal: number;
  readonly stages: readonly PolicyResourceStage[];
};

//endregion Resource frames retain the original native phase snapshots.

//region Source captures and host prompts keep original occurrence identity.

/**
 Original selected policy capture retains identity and complete text for publication.
 */
export type GoverningPolicyCapture = {
  readonly identity: string;
  readonly content: string;
  readonly occurrence: object;
};

/**
 Original startup authority declaration assigns authority without semantic interpretation.
 */
export type InstructionAuthorityDeclaration = {
  readonly tier: 'system' | 'developer' | 'user';
  readonly scope: 'original-request';
};

/**
 Copied authority registration retains its fixed tier priority and trusted origin.
 */
export type InstructionAuthorityRegistration = {
  readonly tier: 'system' | 'developer' | 'user';
  readonly priority: number;
  readonly scope: 'original-request';
  readonly origin: 'trusted-host-startup-registration';
};

/**
 Explicitly configured host text keeps its own digest and registration link.
 Registration absence mirrors the optional authority declaration unchanged.
 */
export type HostPromptInput = {
  readonly kind: 'bootstrap-host-custom-prompt';
  readonly content: string;
  readonly sha256: string;
  readonly occurrence: object;
  readonly registration: ReturnType<typeof copyAuthorityRegistration>;
};

//endregion Source captures and host prompts keep original occurrence identity.

//region Published resource inputs keep original text digests and carriers.

/**
 Published native system input keeps the unregistered resource-stage text.
 */
export type ResourceSystemPromptInput = {
  readonly kind: 'native-resource-system-input';
  readonly content: string;
  readonly sha256: string;
  readonly occurrence: object;
  readonly registration: undefined;
  readonly pathToRawFileIdentity: 'not-established';
};

/**
 Published append input keeps its original ordinal and complete text.
 */
export type AppendPromptInput = {
  readonly kind: 'native-resource-append-input';
  readonly content: string;
  readonly ordinal: number;
  readonly sha256: string;
  readonly occurrence: object;
  readonly registration: undefined;
  readonly pathToRawFileIdentity: 'not-established';
};

/**
 Governing-policy context carrier links one emitted policy entry occurrence.
 */
export type ContextPolicyCarrier = {
  readonly kind: 'governing-policy-context-carrier';
  readonly occurrence: object;
  readonly ordinal: number;
  readonly entry: {
    readonly path: string;
    readonly content: string;
  };
  readonly source: GoverningPolicyCapture;
  readonly sourceOccurrence: object;
  readonly authenticatesDisplacedRead: false;
  readonly permission: false;
};

/**
 Published context input keeps its original entry and governing carrier link.
 Carrier absence mirrors the original ordinal lookup unchanged.
 */
export type ContextPromptInput = {
  readonly kind: 'native-resource-context-input';
  readonly content: string;
  readonly path: string;
  readonly ordinal: number;
  readonly entry: {
    readonly path: string;
    readonly content: string;
  };
  readonly carrier: ReturnType<Map<number, ContextPolicyCarrier>['get']>;
  readonly sha256: string;
  readonly occurrence: object;
  readonly registration: undefined;
  readonly pathToRawFileIdentity: 'not-established';
};

/**
 Resource receipt retains its complete serialized input occurrence.
 */
export type ResourceReceiptInput = {
  readonly kind: 'native-resource-received-input';
  readonly content: string;
  readonly contentFormat: string;
  readonly inputLocation: {
    readonly field: 'resourceCallback';
    readonly metadataJSON: string;
  };
  readonly sha256: string;
  readonly occurrence: object;
  readonly resourceInputOccurrence: object;
  readonly registration: undefined;
  readonly permission: false;
};

/**
 Readable policy custody keeps only entries matching their original readable file.
 */
export type ReadablePolicyFiles = {
  readonly sources: readonly ContextPromptInput[];
  readonly assertCurrent: () => void;
};

//endregion Published resource inputs keep original text digests and carriers.

//region Loader handle and owner contracts keep original receiver identities.

/**
 Created loader retains the reload operation used for publication.
 */
export type PolicyLoaderHandle = {
  reload(options?: unknown): Promise<unknown>;
};

/**
 Constructor owner keeps the exact resource capture and binding operations.
 */
export type PolicyLoaderOwner = {
  readonly create: (options: Readonly<Record<string, unknown>>) => PolicyLoaderHandle;
  readonly designateGoverningPolicy: (input: NativePolicyDesignation['policy'] & {
    readonly loader: PolicyLoaderHandle;
  }) => void;
  readonly captureGoverningPolicy: (loader: PolicyLoaderHandle) => GoverningPolicyCapture;
  readonly bindNativeLoader: (loader: PolicyLoaderHandle) => object;
  readonly refreshGoverningRelevance: (input: {
    readonly loader: PolicyLoaderHandle;
    readonly signal: AbortSignal;
  }) => Promise<unknown>;
  readonly bindCollector: (input: {
    readonly loader: PolicyLoaderHandle;
    readonly context: unknown;
    readonly readPolicy: () => {
      readonly identity: string;
      readonly content: string;
    };
  }) => unknown;
  readonly bindSessionCollector: (input: {
    readonly session: unknown;
  }) => unknown;
};

//endregion Loader handle and owner contracts keep original receiver identities.

//region Fixed native readers retain their original call contracts.

/**
 Published resource tool input keeps the exact fields this owner validates.
 */
export type ResourceToolInputOrigin = {
  readonly source: {
    readonly resourceInputOccurrence: unknown;
    readonly occurrence: unknown;
    readonly kind: string;
    readonly registration: unknown;
    readonly permission: unknown;
  };
  readonly publication: {
    readonly sourceOccurrence: unknown;
  };
  readonly resourceInputOccurrence: unknown;
};

/**
 Original constructed-input reader exposes session receipts for message collection.
 */
export type SessionConstructedInputsReader = (session: unknown) => unknown;

/**
 Original resource tool inputs reader exposes its frozen owned view.
 */
export type ResourceToolInputsReader = (loader: PolicyLoaderHandle) => readonly ResourceToolInputOrigin[];

/**
 Original resource tool origin reader authenticates one published tool input.
 */
export type ResourceToolOriginReader = (input: {
  readonly loader: PolicyLoaderHandle;
  readonly publication: unknown;
}) => unknown;

/**
 Original usage reader supplies existing input accounting counters.
 */
export type InputUsageReader = (loader: PolicyLoaderHandle) => {
  readonly count: number;
  readonly bytes: number;
};

/**
 Original session usage reader supplies existing session accounting counters.
 */
export type SessionInputUsageReader = (session: unknown) => {
  readonly count: number;
  readonly bytes: number;
};

/**
 Original session domain reader preserves source-domain observations.
 */
export type SessionDomainEventsReader = (session: unknown) => unknown;

//endregion Fixed native readers retain their original call contracts.

//region Loader configuration and publication state complete the boundary.

/**
 Loader configuration is destructured by the state builder;
 optional readers stay optional.
 */
export type PolicyLoaderConfiguration = {
  readonly owner: PolicyLoaderOwner;
  readonly options: unknown;
  readonly policy: NativePolicyDesignation['policy'];
  readonly authority?: InstructionAuthorityDeclaration;
  readonly customPromptAuthority?: InstructionAuthorityDeclaration;
  readonly readSessionConstructedInputs?: SessionConstructedInputsReader;
  readonly readResourceToolInputs?: ResourceToolInputsReader;
  readonly readResourceToolOrigin?: ResourceToolOriginReader;
  readonly readResourceToolUsage?: InputUsageReader;
  readonly readSessionInputUsage?: SessionInputUsageReader;
  readonly readSessionDomainEvents?: SessionDomainEventsReader;
};

/**
 Original policy binding carries the placement profile label the capability owner reads
 and every original proof field this loader publishes.
 Absent fields stay optional so consumers observe the original absence unchanged.
 */
export type PolicyInputBinding = {
  readonly slot: 'governing-policy';
  readonly readablePolicies: ReadablePolicyFiles;
  readonly decisionSelection: unknown;
  readonly relevance: unknown;
  readonly relevanceFailure?: {
    readonly cause: unknown;
  };
  readonly resourceReceiptInputs: readonly ResourceReceiptInput[];
  readonly source: GoverningPolicyCapture;
  readonly frame: PolicyResourceFrame;
  readonly resourceSystemInput?: ResourceSystemPromptInput;
  readonly appendInputs: readonly AppendPromptInput[];
  readonly contextInputs: readonly ContextPromptInput[];
  readonly contextCarriers: readonly ContextPolicyCarrier[];
  readonly priorContext?: ResourceContextSnapshot;
  readonly singleCarrier: false;
  readonly sourceOccurrenceLinked: false;
  readonly otherInstructionCoverage: 'not-established';
  readonly permission: false;
};

/**
 Loader publication state promises exactly the members its factory freezes
 on every normal path.
 */
export type PolicyLoaderState = {
  readonly loader: PolicyLoaderHandle;
  readonly nativeBinding: object;
  readonly reload: (options?: unknown) => Promise<unknown>;
  readonly readCurrent: () => PolicyInputBinding;
  readonly assertCurrent: (binding: unknown) => void;
  readonly registration: ReturnType<typeof copyAuthorityRegistration>;
  readonly hostPrompt?: HostPromptInput;
  readonly bindCollector: (context: unknown) => unknown;
  readonly bindSessionCollector: (session: unknown) => unknown;
};

//endregion Loader configuration and publication state complete the boundary.
