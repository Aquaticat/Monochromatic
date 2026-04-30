import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';
import {
  resetApiKeyCache,
  resolveMorphApiKey,
} from './api-key.ts';

/** Disposable that restores an env var and resets the API key cache. */
class EnvRestore implements Disposable {
  readonly #key: string;
  readonly #original: string | undefined;

  constructor(envKey: string, original: string | undefined,) {
    this.#key = envKey;
    this.#original = original;
  }

  [Symbol.dispose](): void {
    if (this.#original === undefined)
      Reflect.deleteProperty(process.env, this.#key,);
    else
      process.env[this.#key] = this.#original;
    resetApiKeyCache();
  }
}

/** Set an env var and return a disposable that restores the original value. */
function setEnv(
  key: string,
  value: string,
): EnvRestore {
  const original = process.env[key];
  process.env[key] = value;
  resetApiKeyCache();
  return new EnvRestore(key, original,);
}

await describe({
  name: '',
  children: [
    describe({
      name: resolveMorphApiKey.name,
      children: [
        it({
          name: 'resolves MORPH_API_KEY from environment',
          fn: async () => {
            // oxlint-disable-next-line no-restricted-syntax -- env cleanup requires using block
            using _restore = setEnv('MORPH_API_KEY', 'test-key-from-env',);
            const key = await resolveMorphApiKey();
            expect(key,).toBe('test-key-from-env',);
          },
        },),
        it({
          name: 'returns env value directly when set',
          fn: async () => {
            // oxlint-disable-next-line no-restricted-syntax -- env cleanup requires using block
            using _restore = setEnv('MORPH_API_KEY', 'cached-key',);
            const first = await resolveMorphApiKey();
            // Env var takes priority over cache
            process.env.MORPH_API_KEY = 'new-key';
            const second = await resolveMorphApiKey();
            // Env var always wins over cache
            expect(second,).toBe('new-key',);
          },
        },),
        it({
          name: 'resetApiKeyCache clears the cache',
          fn: async () => {
            // oxlint-disable-next-line no-restricted-syntax -- env cleanup requires using block
            using _restore = setEnv('MORPH_API_KEY', 'before-reset',);
            await resolveMorphApiKey();
            process.env.MORPH_API_KEY = 'after-reset';
            resetApiKeyCache();
            const key = await resolveMorphApiKey();
            expect(key,).toBe('after-reset',);
          },
        },),
      ],
    },),
    describe({
      name: resetApiKeyCache.name,
      children: [
        it({
          name: 'allows re-reading after cache reset',
          fn: async () => {
            // oxlint-disable-next-line no-restricted-syntax -- env cleanup requires using block
            using _restore = setEnv('MORPH_API_KEY', 'initial',);
            await resolveMorphApiKey();
            process.env.MORPH_API_KEY = 'post-reset';
            resetApiKeyCache();
            const key = await resolveMorphApiKey();
            expect(key,).toBe('post-reset',);
          },
        },),
      ],
    },),
  ],
},);
