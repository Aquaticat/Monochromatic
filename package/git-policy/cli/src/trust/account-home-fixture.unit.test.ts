/**
 Disposable account home for tests that spawn the built wrapper.

 The wrapper derives its trust registry from the operating-system account home,
 not `HOME`,
 so setting `HOME` alone leaves every spawned wrapper on the real account registry:
 the suite then wrote a record per disposable repository there
 and contended on its recursive-operation lock with the developer's own commits.
 {@link disposableAccountEnvironment} adds the test-only account preload,
 so the registry lives under the disposable home.

 @module
 */
import { pathToFileURL, } from 'node:url';
import { join, } from 'node:path';

/**
 Preload making `os.userInfo().homedir` report `HOME`.
 */
const ACCOUNT_HOME_PRELOAD_URL = pathToFileURL(join(import.meta.dirname, 'fixture', 'account-home-preload.ts',),).href;

/**
 Environment entries that give spawned Node processes a disposable account home.

 @param home - canonical disposable home

 @returns `HOME` and `NODE_OPTIONS` entries to merge over the inherited environment

 @example
 ```ts
 const env = { ...process.env, ...disposableAccountEnvironment('/tmp/fixture/home') };
 ```
 */
export function disposableAccountEnvironment(home: string,): Readonly<Record<'HOME' | 'NODE_OPTIONS', string>> {
  /**
   Inherited Node options kept ahead of the preload.
   */
  const inherited = process.env.NODE_OPTIONS ?? '';
  return {
    HOME: home,
    NODE_OPTIONS: `${inherited} --import=${ACCOUNT_HOME_PRELOAD_URL}`.trim(),
  };
}
