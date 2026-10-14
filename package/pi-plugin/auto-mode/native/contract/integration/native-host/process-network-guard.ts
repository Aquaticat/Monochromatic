/**
 Preserve the disposable CLI fixture's fetch rejection through native HTTP setup.

 @module
 */

//region Fixture-only setup loads Pi's original fetch snapshot before overriding it.

/**
 Report a fixture boundary violation without making a provider request.
 */
class NativeCliFixtureNetworkError extends Error {
  /**
   Distinguish fixture isolation failures from upstream transport failures.
   */
  override readonly name = 'NativeCliFixtureNetworkError';
}

if (process.env
  .PI_AUTO_MODE_CLI_FIXTURE_CHILD
  !== '1')
  throw new NativeCliFixtureNetworkError('Native CLI fixture network guard requires its isolated child process');

// Pi preserves overrides installed after its dispatcher module captured the original fetch.
await import(new URL(
  '../../../pi/coding-agent/dist/core/http-dispatcher.js',
  import.meta.url
).href);

/**
 Reject every fetch made by the isolated fixture after native initialization.

 @throws NativeCliFixtureNetworkError for every attempted request
 */
function rejectFixtureNetwork(): Promise<never> {
  return Promise.reject(new NativeCliFixtureNetworkError('External fetch is disabled in the native CLI process fixture'));
}

globalThis.fetch = rejectFixtureNetwork;

//endregion
