/**
 Extend original manager input publications through observed native message copies. @module
 */
import { isDeepStrictEqual } from 'node:util';
import {
  readSystemInputFields,
  type SystemInputFields
} from './system-input-fields.ts';
import { tagged } from '@monochromatic-dev/module-logger/ts';
import type {
  SystemToolAlias,
  SystemToolCopy,
  SystemToolOwner
} from './system-tool-publication-types.ts';

/**
 Diagnostics never include borrowed declaration data.
 */
const l = tagged({ tag: 'auto-mode-system-tool-publication' });

//region Native input identity and captured declaration integrity are separate checks

/**
 Bind system fields and tools from an already captured manager input to its existing publication.
 Only original host copy observations can extend this membership.
 
 @param aliases - incumbent message publication alias index
 
 @param publication - existing source publication, never caller-authored authority
 
 @param message - original manager input message
 
 @param expected - owned system data already charged to the original input budget
 
 @param copyInput - incumbent bounded data copier supplied by the publication owner
 
 @param InputError - incumbent source failure constructor
 
 @throws SourceCollectionError when original declarations cannot retain their publication
 
 @example
 ```ts
 publishSystemToolInput({ aliases, publication, message, expected, copyInput, InputError });
 ```
 */
export function publishSystemToolInput({
  aliases,
  publication,
  message,
  expected,
  copyInput,
  InputError
}: {
  readonly aliases: WeakMap<object, SystemToolAlias>;
  readonly publication: object;
  readonly message: object;
  readonly expected: SystemInputFields;
  readonly copyInput: (value: unknown) => unknown;
  readonly InputError: new (message: string) => Error;
}): void {
  /**
   Construction diagnostics remain scoped to this original publication.
   */
  const fl = tagged({
    tag: publishSystemToolInput.name,
    l
  });
  /**
   Retirement is irreversible and retains its original diagnostic.
   */
  const state: { failure?: Error } = {};
  fl.debug('binding original system tool declarations to the existing source publication');

  /**
   Retire only this publication; conflicting owners keep their original entries.
   
   @param reason - neutral integrity diagnostic
   
   @returns false so callers cannot retain a changed declaration
   */
  function retire(reason: string): false {
    /**
     Retirement logs contain no borrowed declaration data.
     */
    const rl = tagged({
      tag: retire.name,
      l: fl
    });
    state.failure ??= new InputError(reason);
    rl.debug(reason);
    return false;
  }

  /**
   Inspect declarations through the incumbent bounded copier before reading their elements.
   
   @param value - original or natively copied message
   
   @returns exact borrowed declaration array after data-profile validation
   
   @throws SourceCollectionError when declarations differ from the captured original input
   */
  function toolsFor(value: object): {
    readonly fields: SystemInputFields;
    readonly tools?: readonly object[]
  } {
    /**
     Data-profile checks have a distinct diagnostic boundary.
     */
    const tl = tagged({
      tag: toolsFor.name,
      l: fl
    });
    /**
     The copier validates descriptors before any array elements are consumed.
     */
    const selected = readSystemInputFields({
      value,
      InputError
    });
    if (!isDeepStrictEqual(
      copyInput(selected),
      expected
    )) {
      tl.debug('system data differs from its captured input');
      throw new InputError('Native system fields differ from their captured manager input');
    }
    /**
     Tool absence is an original input state, not an empty replacement array.
     */
    const tools = selected.toolsAdded;
    if (tools === undefined) return { fields: selected };
    if (!Array.isArray(tools)) throw new InputError('Native system tools require their original declaration array');
    /**
     Explicit narrowing preserves the borrowed array identity without an unsafe element type.
     */
    const declarations: readonly unknown[] = tools;
    if (!declarations.every(function isDeclaration(item): item is object {
      return (item !== null) && ((typeof item) === 'object');
    })) throw new InputError('Native system tool declarations require original records');
    return {
      fields: selected,
      tools: declarations
    };
  }

  /**
   Check alias ownership before reading any borrowed declaration.
   
   @param value - exact message or tool object observed by a native consumer
   
   @returns whether the original membership and owned data still hold
   */
  function current(value: object): boolean {
    /**
     Currentness reads never log the captured source itself.
     */
    const cl = tagged({
      tag: current.name,
      l: fl
    });
    /**
     Membership is authenticated before inspecting borrowed values.
     */
    const known = aliases.get(value);
    if ((state.failure !== undefined) || (known?.owner !== owner)) return false;
    /**
     A declaration remains tied to its own original containing message.
     */
    const root = known.kind === 'tool-declaration' ? known.message : value;
    if (root === undefined) return retire('Native tool alias has no original system input');
    /**
     The root and declaration must share the same publication owner.
     */
    const messageAlias = aliases.get(root);
    if ((messageAlias?.owner !== owner) || (messageAlias.kind !== 'system-input')) return false;
    try {
      /**
       Captured data equality checks integrity only after identity membership.
       */
      const {
        fields: selected,
        tools
      } = toolsFor(root);
      if (tools !== messageAlias.tools) return retire('Original system tool declaration array was replaced');
      if ((selected.content !== messageAlias.content) || (selected.sections !== messageAlias.sections)
        || (selected.toolsRemoved !== messageAlias.toolsRemoved))
        return retire('Original system field identity was replaced');
      for (const [ordinal, tool] of (tools ?? []).entries()) {
        /**
         Position and container identities reject equal replacement objects.
         */
        const alias = aliases.get(tool);
        if ((alias?.owner !== owner) || (alias.kind !== 'tool-declaration')
          || (alias.message !== root)
          || (alias.ordinal !== ordinal))
          return retire('Original system tool declaration occurrence was replaced');
      }
      return (known.kind === 'system-input')
        || ((known.kind === 'tool-declaration') && (known.ordinal !== undefined)
          && (tools?.[known.ordinal] === value));
    } catch (error) {
      cl.debug(String(error));
      return retire('Original system tool input no longer has its captured data profile');
    }
  }

  /**
   Register only an original input or the output of an authenticated native copy call.
   
   @param value - message emitted at the observed native boundary
   
   @returns whether all alias slots retained their original source ownership
   */
  function register(value: object): boolean {
    /**
     Registration diagnostics distinguish native copy propagation from semantic permission.
     */
    const rl = tagged({
      tag: register.name,
      l: fl
    });
    if (state.failure !== undefined) return false;
    if (aliases.has(value)) return (aliases.get(value)
      ?.owner
      === owner) && current(value);
    /**
     Validate the entire native copy before occupying any alias slot.
     */
    const {
      fields: selected,
      tools
    } = toolsFor(value);
    if ((new Set(tools).size !== (tools?.length ?? 0)) || (tools?.some(function alreadyPublished(tool) {
      return aliases.has(tool);
    }) === true))
      return retire('Native tool declaration already belongs to another original input or position');
    aliases.set(
      value,
      {
        owner,
        kind: 'system-input',
        ...(tools === undefined ? {} : { tools }),
        ...selected
      }
    );
    for (const [ordinal, tool] of (tools ?? []).entries())
      aliases.set(
        tool,
        {
          owner,
          kind: 'tool-declaration',
          message: value,
          ordinal
        }
      );
    rl.debug('retained native system and declaration aliases');
    return true;
  }

  /**
   Extend the existing publication only through an actual native copy observation.
   
   @param before - original message already owned by this publication
   
   @param after - message returned by the original native copy operation
   */
  function copy({
    before,
    after
  }: SystemToolCopy): void {
    /**
     Copy failures retain the original caught value in diagnostics.
     */
    const cl = tagged({
      tag: copy.name,
      l: fl
    });
    if (!current(before)) return;
    try {
      register(after);
    }
    catch (error) {
      cl.debug(String(error));
      retire('Native system tool copy differs from its original captured input');
    }
  }

  /**
   Shared alias dispatch retains one original source publication across native copies.
   */
  const owner: SystemToolOwner = Object.freeze({
    view: publication,
    current,
    copy,
    entry: copy,
    project: copy,
    convert: copy
  });
  if (!register(message)) throw state.failure ?? new InputError('Original system tool message already has a publication');
}

//endregion Native input identity and captured declaration integrity are separate checks
