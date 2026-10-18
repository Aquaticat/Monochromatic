/**
 Original policy-input capability issues one frozen capability per original loader state. @module
 */
import { PolicySlotBindingError } from './system-slot-error.ts';
import {
  createPolicyLoaderState,
  type PolicyInputBinding,
  type PolicyLoaderConfiguration,
  type PolicyLoaderState
} from './policy-loader.mjs';

export { PolicySlotBindingError } from './system-slot-error.ts';

//region Module-private ownership map authenticates issued capability objects.

/**
 Ownership map links each issued capability object to its original loader state.
 It records only capabilities issued here and never becomes a source or session registry.
 */
const policyInputStates = new WeakMap<object, PolicyLoaderState>();

/**
 Authenticate one issued capability before any loader-state access.
 No candidate property is read, so counterfeit property traps never run.

 @param input - untrusted candidate capability

 @returns original loader publication state owned by an issued capability

 @throws PolicySlotBindingError when the candidate is not an issued capability
 */
function stateFor(input: unknown): PolicyLoaderState {
  /**
   Map membership is the ownership check; non-objects never reach the map.
   */
  const state = (((typeof input) === 'object') && (input !== null))
    ? policyInputStates.get(input)
    : undefined;
  if (state === undefined) throw new PolicySlotBindingError('Requires original policy-input capability');
  return state;
}

/**
 Original policy-input capability surface retained by its native consumers.
 */
export type PolicyInputCapability = Readonly<{
  readonly loader: unknown;
  readonly nativeBinding: unknown;
  readonly reload: (options?: unknown) => Promise<unknown>;
  readonly readCurrent: () => PolicyInputBinding;
  readonly assertCurrent: (binding: unknown) => void;
}>;

/**
 Issue one capability object for its original loader state.

 @param state - original loader publication state

 @returns frozen issued capability whose operations authenticate their actual receiver
 */
function issuePolicyInput(state: PolicyLoaderState): PolicyInputCapability {
  /**
   Each issued operation re-authenticates its receiver instead of closing over the state.
   */
  const capability = {
    /**
     Expose the original native loader through its owning state.
     */
    get loader(): unknown {
      return stateFor(this)
        .loader;
    },
    /**
     Expose the original native binding through its owning state.
     */
    get nativeBinding(): unknown {
      return stateFor(this)
        .nativeBinding;
    },
    /**
     Reload through the owning state without replacing the capability.
     */
    async reload(options?: unknown): Promise<unknown> {
      return await stateFor(this)
        .reload(options);
    },
    /**
     Read the current binding through the owning state.
     */
    readCurrent(): PolicyInputBinding {
      return stateFor(this)
        .readCurrent();
    },
    /**
     Revalidate one earlier binding through the owning state.
     */
    assertCurrent(binding: unknown): void {
      stateFor(this)
        .assertCurrent(binding);
    }
  };
  /*
   Staged construction makes each issued operation nonenumerable before publication.
   */
  for (const name of Reflect.ownKeys(capability)) {
    Object.defineProperty(
      capability,
      name,
      { enumerable: false }
    );
  }
  policyInputStates.set(
    capability,
    state
  );
  return Object.freeze(capability);
}

//endregion Module-private ownership map authenticates issued capability objects.

//region Public capability entry points revalidate through the original ownership map.

/**
 Read through the real callback owner, never a caller-created reader.

 @param input - original policy-input capability

 @returns original policy binding read from its owning state

 @example
 ```ts
 const binding = readPolicyInput(policyInput);
 ```
 */
export function readPolicyInput(input: unknown): PolicyInputBinding {
  return stateFor(input)
    .readCurrent();
}

/**
 Require the actual system-input carrier when proving system-message placement.

 @param input - original policy-input capability

 @returns original policy binding carrying the system placement profile

 @throws PolicySlotBindingError when the binding is not a system-prompt carrier

 @example
 ```ts
 const system = readSystemPolicyInput(policyInput);
 ```
 */
export function readSystemPolicyInput(input: unknown): PolicyInputBinding {
  /**
   Original binding read through {@link readPolicyInput}.
   */
  const value = readPolicyInput(input);
  if (value.slot !== 'customPrompt') throw new PolicySlotBindingError('Original policy input is not a system-prompt carrier');
  return value;
}

/**
 Revalidate through the original ownership map; copied methods cannot mint a link.

 @param input - original policy-input capability and its earlier binding

 @throws PolicySlotBindingError when the binding is not this state's current one

 @example
 ```ts
 assertPolicyInput({ input: policyInput, binding });
 ```
 */
export function assertPolicyInput({
  input,
  binding
}: {
  readonly input: unknown;
  readonly binding: unknown;
}): void {
  stateFor(input)
    .assertCurrent(binding);
}

/**
 Revalidate the system placement carrier through the same original owner.

 @param input - original policy-input capability and its earlier binding

 @throws PolicySlotBindingError when the binding is not this state's current one

 @example
 ```ts
 assertSystemPolicyInput({ input: policyInput, binding });
 ```
 */
export function assertSystemPolicyInput(input: {
  readonly input: unknown;
  readonly binding: unknown;
}): void {
  assertPolicyInput(input);
}

/**
 Read an immutable declaration through its original owner, never action metadata.

 @param input - original policy-input capability

 @returns original immutable authority registration

 @example
 ```ts
 const registration = readAuthorityRegistration(policyInput);
 ```
 */
export function readAuthorityRegistration(input: unknown): unknown {
  /**
   Original state authenticated before its registration is read.
   */
  const state = stateFor(input);
  state.readCurrent();
  return state.registration;
}

/**
 Original explicitly configured host text, not the composite system message.

 @param input - original policy-input capability

 @returns original explicitly configured host text

 @example
 ```ts
 const hostPrompt = readHostPromptInput(policyInput);
 ```
 */
export function readHostPromptInput(input: unknown): unknown {
  /**
   Original state authenticated before its host prompt is read.
   */
  const state = stateFor(input);
  state.readCurrent();
  return state.hostPrompt;
}

/**
 Extend the incumbent collector with this owner's exact governing-source capture.

 @param input - original policy-input capability and incumbent collector context

 @returns incumbent collector extended by this owner's exact governing-source capture

 @example
 ```ts
 const collector = bindPolicyCollector({ input: policyInput, context });
 ```
 */
export function bindPolicyCollector({
  input,
  context
}: {
  readonly input: unknown;
  readonly context: unknown;
}): unknown {
  return stateFor(input)
    .bindCollector(context);
}

/**
 Retain actual native session/base/run publication links through the incumbent owner.

 @param input - original policy-input capability and original native session

 @returns incumbent session collector retaining its original publication links

 @example
 ```ts
 const collector = bindPolicySessionCollector({ input: policyInput, session });
 ```
 */
export function bindPolicySessionCollector({
  input,
  session
}: {
  readonly input: unknown;
  readonly session: unknown;
}): unknown {
  return stateFor(input)
    .bindSessionCollector(session);
}

//endregion Public capability entry points revalidate through the original ownership map.

/**
 Select governing policy without replacing any native prompt or context input.

 @param input - original owner, options, designation and fixed native readers

 @returns original policy-input capability for the governing-policy profile

 @example
 ```ts
 const policyInput = createGoverningPolicyLoader({ owner, options, policy, authority });
 ```
 */
export function createGoverningPolicyLoader(input: PolicyLoaderConfiguration): PolicyInputCapability {
  return issuePolicyInput(createPolicyLoaderState({
    ...input,
    systemSlot: false
  }));
}

/**
 Feed the same policy capture through a fixed system callback for the narrow placement profile.

 @param input - original owner, options, designation and fixed native readers

 @returns original policy-input capability for the system placement profile

 @example
 ```ts
 const systemInput = createSystemPolicyLoader({ owner, options, policy, authority, customPromptAuthority });
 ```
 */
export function createSystemPolicyLoader(input: PolicyLoaderConfiguration): PolicyInputCapability {
  return issuePolicyInput(createPolicyLoaderState({
    ...input,
    systemSlot: true
  }));
}
