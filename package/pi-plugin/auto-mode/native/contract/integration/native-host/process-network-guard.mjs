/** Only the disposable CLI process fixture may load this explicit network rejection. */
if (process.env.PI_AUTO_MODE_CLI_FIXTURE_CHILD !== '1')
  throw new Error('Native CLI fixture network guard requires its isolated child process');

globalThis.fetch = async function rejectFixtureNetwork() {
  throw new Error('External fetch is disabled in the native CLI process fixture');
};
