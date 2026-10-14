/**
 Keep original resource reloads inside their registered policy ownership boundary.

 @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import type { NativeHostReloadInput, NativeHostResource, NativeReloadable } from './resource-types.ts';

//region Original host resource owners keep reloads inside their policy capture boundary.

/**
 Each original loader has at most one retained resource record.
 */
const owners = new WeakMap<NativeReloadable, NativeHostResource>();

/**
 Resource diagnostics retain their original module scope.
 */
const l = tagged({tag:'auto-mode-native-host-resource'});

/**
 Resource ownership failures remain separate from policy interpretation.
 */
export class NativeHostResourceError extends Error {
  /**
   Native diagnostics name the original resource boundary.
   */
  override readonly name = 'NativeHostResourceError';
}

/**
 Register once before the original loader is published to native services.

 @param input - original resource record whose loader becomes the private lookup key

 @throws NativeHostResourceError when the loader already has a registered owner

 @example
 ```ts
 registerHostResource({loader, policyInput});
 ```
 */
export function registerHostResource(input: NativeHostResource): void {
  /**
   Registration logs identify the ownership boundary without serializing source content.
   */
  const rl=tagged({tag:registerHostResource.name,l});
  rl.debug('registering original native resource loader');
  /**
   Exact loader identity selects this record throughout native reload and session construction.
   */
  const { loader } = input;
  if (owners.has(loader)) throw new NativeHostResourceError('Resource loader already has a native host owner');
  owners.set(
    loader,
    Object.freeze(input)
  );
}

/**
 Require the host's original record when constructing its session.

 @param loader - original resource-loader identity

 @returns retained original resource record without copying its capabilities

 @throws NativeHostResourceError when the loader is not registered

 @example
 ```ts
 const resource=readHostResource(loader);
 ```
 */
export function readHostResource(loader: NativeReloadable): NativeHostResource {
  /**
   Lookups retain their own diagnostic scope.
   */
  const rl=tagged({tag:readHostResource.name,l});
  rl.debug('reading original native resource record');
  /**
   Equal-shaped replacement loaders cannot select another loader's record.
   */
  const input = owners.get(loader);
  if (input === undefined) throw new NativeHostResourceError('Session resource loader was not created by this native host');
  return input;
}

/**
 Reload through the original policy owner when registered; standalone SDK loaders keep native reload.

 @param loader - original loader selected by native services or session reload

 @param options - original native trust-resolution options

 @returns original reload result without replacing its identity

 @throws Error when the original selected reload operation fails

 @example
 ```ts
 await reloadHostResource({loader,options});
 ```
export async function reloadHostResource({
  loader,
  options
}: NativeHostReloadInput): Promise<unknown> {
  /**
   Reload diagnostics identify whether the original policy record owns this operation.
   */
  const rl=tagged({tag:reloadHostResource.name,l});
  /**
   The existing registry controls routing without assigning new source or session authority.
   */
  const input = owners.get(loader);
  if (input === undefined) {
    rl.debug('reloading standalone native SDK resources');
    return await loader.reload(options);
  }
  rl.debug('reloading original policy-owned native resources');
  return await input.policyInput.reload(options);
}

//endregion
