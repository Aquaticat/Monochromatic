/** Extend original manager input publications through observed native message copies. @module */
import { isDeepStrictEqual, types } from 'node:util';
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { SourceCollectionError } from '../collector.mjs';
import { copyMessageData } from '../run-prompt-custody/messages.mjs';
import type { SystemToolAlias, SystemToolCopy, SystemToolOwner } from './system-tool-publication-types.ts';

/** Diagnostics never include borrowed declaration data. */
const l = tagged({ tag: 'auto-mode-system-tool-publication' });

//region Native input identity and captured declaration integrity are separate checks

/**
 Read ordinary data fields without invoking caller accessors.
 @param value - borrowed native message or declaration
 @param key - selected field at the native processing boundary
 @returns data value when the record has the supported shape
 */
function data({ value, key }: { readonly value: object; readonly key: string }): unknown {
  if (types.isProxy(value) || Object.getPrototypeOf(value) !== Object.prototype) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor?.enumerable && Object.hasOwn(descriptor, 'value') ? descriptor.value : undefined;
}

/**
 Bind tools from an already captured manager input to its existing publication.
 Only original host copy observations can extend this membership.
 @param aliases - incumbent message publication alias index
 @param publication - existing source publication, never caller-authored authority
 @param message - original manager input message
 @param expected - owned declaration data already charged to the original input budget
 @throws SourceCollectionError when original declarations cannot retain their publication
 @example
 ```ts
 publishSystemToolInput({ aliases, publication, message, expected });
 ```
 */
export function publishSystemToolInput({ aliases, publication, message, expected }: {
  readonly aliases: WeakMap<object, SystemToolAlias>;
  readonly publication: object;
  readonly message: object;
  readonly expected: readonly object[];
}): void {
  const fl = tagged({ tag: publishSystemToolInput.name, l });
  let failure: Error | undefined;
  fl.debug('binding original system tool declarations to the existing source publication');

  /**
   Retire only this publication; conflicting owners keep their original entries.
   @param reason - neutral integrity diagnostic
   @returns false so callers cannot retain a changed declaration
   */
  function retire(reason: string): false {
    const rl = tagged({ tag: retire.name, l: fl });
    failure ??= new SourceCollectionError(reason);
    rl.debug(reason);
    return false;
  }

  /**
   Inspect declarations through the incumbent bounded copier before reading their elements.
   @param value - original or natively copied message
   @returns exact borrowed declaration array after data-profile validation
   @throws SourceCollectionError when declarations differ from the captured original input
   */
  function toolsFor(value: object): readonly object[] {
    const tl = tagged({ tag: toolsFor.name, l: fl });
    const tools: unknown = data({ value, key: 'toolsAdded' });
    if (data({ value, key: 'role' }) !== 'system' || !Array.isArray(tools)
      || !isDeepStrictEqual(copyMessageData(tools), expected)) {
      tl.debug('system declaration data differs from its captured input');
      throw new SourceCollectionError('Native system tool declarations differ from their captured manager input');
    }
    return tools;
  }

  /**
   Check alias ownership before reading any borrowed declaration.
   @param value - exact message or tool object observed by a native consumer
   @returns whether the original membership and owned data still hold
   */
  function current(value: object): boolean {
    const cl = tagged({ tag: current.name, l: fl });
    const known = aliases.get(value);
    if (failure !== undefined || known?.owner !== owner) return false;
    const root = known.kind === 'tool-declaration' ? known.message : value;
    if (root === undefined) return retire('Native tool alias has no original system input');
    const messageAlias = aliases.get(root);
    if (messageAlias?.owner !== owner || messageAlias.kind !== 'input-only') return false;
    try {
      const tools = toolsFor(root);
      if (tools !== messageAlias.tools) return retire('Original system tool declaration array was replaced');
      for (const [ordinal, tool] of tools.entries()) {
        const alias = aliases.get(tool);
        if (alias?.owner !== owner || alias.kind !== 'tool-declaration'
          || alias.message !== root || alias.ordinal !== ordinal)
          return retire('Original system tool declaration occurrence was replaced');
      }
      return known.kind === 'input-only'
        || (known.kind === 'tool-declaration' && known.ordinal !== undefined && tools[known.ordinal] === value);
    } catch (error) {
      cl.debug('system tool input integrity read failed', error);
      return retire('Original system tool input no longer has its captured data profile');
    }
  }

  /**
   Register only an original input or the output of an authenticated native copy call.
   @param value - message emitted at the observed native boundary
   @returns whether all alias slots retained their original source ownership
   */
  function register(value: object): boolean {
    const rl = tagged({ tag: register.name, l: fl });
    if (failure !== undefined) return false;
    if (aliases.has(value)) return aliases.get(value)?.owner === owner && current(value);
    const tools = toolsFor(value);
    if (new Set(tools).size !== tools.length || tools.some(function alreadyPublished(tool) { return aliases.has(tool); }))
      return retire('Native tool declaration already belongs to another original input or position');
    aliases.set(value, { owner, kind: 'input-only', tools });
    for (const [ordinal, tool] of tools.entries())
      aliases.set(tool, { owner, kind: 'tool-declaration', message: value, ordinal });
    rl.debug('retained native system and declaration aliases');
    return true;
  }

  /**
   Extend the existing publication only through an actual native copy observation.
   @param before - original message already owned by this publication
   @param after - message returned by the original native copy operation
   */
  function copy({ before, after }: SystemToolCopy): void {
    const cl = tagged({ tag: copy.name, l: fl });
    if (!current(before)) return;
    try { register(after); }
    catch (error) {
      cl.debug('native system tool copy observation failed', error);
      retire('Native system tool copy differs from its original captured input');
    }
  }

  /** Shared alias dispatch retains one original source publication across native copies. */
  const owner: SystemToolOwner = Object.freeze({ view: publication, current, copy, entry: copy, project: copy, convert: copy });
  if (!register(message)) throw failure ?? new SourceCollectionError('Original system tool message already has a publication');
}

//endregion Native input identity and captured declaration integrity are separate checks
