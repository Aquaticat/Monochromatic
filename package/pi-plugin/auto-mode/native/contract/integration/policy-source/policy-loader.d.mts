/**
 Policy-loader declarations cover exactly the boundary the typed policy-input owner consumes.
 This interop bridge spans the unported implementation until its own typed port.
 @module
 */
/** Original policy binding carries the placement profile label the capability owner reads. */
export type PolicyInputBinding = {
  readonly slot: 'governing-policy';
};
/** Loader publication state promises exactly the members its factory freezes on every normal path. */
export type PolicyLoaderState = {
  readonly loader: unknown;
  readonly nativeBinding: unknown;
  readonly reload: (options?: unknown) => Promise<unknown>;
  readonly readCurrent: () => PolicyInputBinding;
  readonly assertCurrent: (binding: unknown) => void;
  readonly registration: unknown;
  readonly hostPrompt: unknown;
  readonly bindCollector: (context: unknown) => unknown;
  readonly bindSessionCollector: (session: unknown) => unknown;
};
/** Loader configuration is destructured by the state builder; unvalidated optional readers stay optional. */
export type PolicyLoaderConfiguration = {
  readonly owner: unknown;
  readonly options: unknown;
  readonly policy: unknown;
  readonly authority?: unknown;
  readonly customPromptAuthority?: unknown;
  readonly readSessionConstructedInputs?: unknown;
  readonly readResourceToolInputs?: unknown;
  readonly readResourceToolOrigin?: unknown;
  readonly readResourceToolUsage?: unknown;
  readonly readSessionInputUsage?: unknown;
  readonly readSessionDomainEvents?: unknown;
};
/**
 Build one loader-owned publication state for the governing-policy publication.

 @param input - original loader configuration
 */
export function createPolicyLoaderState(input: PolicyLoaderConfiguration): PolicyLoaderState;
