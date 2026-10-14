/**
 Retain original native function identities across generated module loading.

 @module
 */
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { sdk } from '../current-sdk/paths.ts';
import { NativeCliHostError } from './host.mjs';

//region The bootstrap forwards original functions without claiming their opaque result shapes

/**
 Generated dependency diagnostics retain their own module boundary.
 */
const l = tagged({ tag: 'auto-mode-native-host-dependencies' });

/**
 Forwarded functions are called by the existing native runtime, never by this bridge.
 */
type NativeCallable = (...args: never[]) => unknown;

/**
 Check only callability without inventing parameter or result guarantees.

 @param value - original export selected from the generated module

 @returns whether the export can be forwarded as a native callback
 */
function isNativeCallable(value: unknown): value is NativeCallable {
  return (typeof value) === 'function';
}

/**
 Read one fixed native function while retaining its original identity.

 @param url - original emitted module selected by this bootstrap

 @param name - required native export

 @returns original callable export without wrapping it

 @throws NativeCliHostError when the qualified module lacks its expected function
 */
async function readNativeFunction({ url, name }: {
  readonly url: URL;
  readonly name: string;
}): Promise<NativeCallable> {
  /**
   Loading and validation retain the same diagnostic scope.
   */
  const rl = tagged({ tag: readNativeFunction.name, l });
  rl.debug(`loading native bootstrap function: ${name}`);
  /**
   Dynamic exports remain unknown until the required field is inspected.
   */
  const module: unknown = await import(url.href);
  if (((typeof module) !== 'object') || (module === null) || (!(name in module)))
    throw new NativeCliHostError(`Native bootstrap module lacks export: ${name}`);
  /**
   The field check permits lookup without assigning an unchecked import to a typed function.
   */
  const value: unknown = Reflect.get(module, name);
  if (!isNativeCallable(value)) throw new NativeCliHostError(`Native bootstrap export is not callable: ${name}`);
  return value;
}

/**
 Native tool registration receives the original qualified SDK wrapper.
 */
export const wrapToolDefinition = await readNativeFunction({
  url: pathToFileURL(join(sdk, 'dist/core/tools/tool-definition-wrapper.js')),
  name: 'wrapToolDefinition'
});

/**
 Native cleanup receives the original generated private-state reader.
 */
export const readSessionDisposalState = await readNativeFunction({
  url: new URL('../native-batch/generated/agent-session.mjs', import.meta.url),
  name: 'readSessionDisposalState'
});

//endregion The bootstrap forwards original functions without claiming their opaque result shapes
