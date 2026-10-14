//region Original host resource owners keep reloads inside their policy capture boundary.

const owners = new WeakMap();

export class NativeHostResourceError extends Error {}

/** Register once, before the original loader is published to native services. */
export function registerHostResource(input) {
  const { loader } = input;
  if (owners.has(loader)) throw new NativeHostResourceError('Resource loader already has a native host owner');
  owners.set(loader, Object.freeze(input));
}

/** Require the host's original record when constructing its session. */
export function readHostResource(loader) {
  const input = owners.get(loader);
  if (!input) throw new NativeHostResourceError('Session resource loader was not created by this native host');
  return input;
}

/** Standalone SDK loaders retain native behavior without acquiring a host policy binding. */
export async function reloadHostResource(loader, options) {
  const input = owners.get(loader);
  return input ? await input.policyInput.reload(options) : await loader.reload(options);
}

//endregion
