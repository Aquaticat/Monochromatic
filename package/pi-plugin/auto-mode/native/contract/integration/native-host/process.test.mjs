import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { createEnvironment } from '../native-batch/environment.mjs';

if (process.env
  .PI_AUTO_MODE_CLI_FIXTURE_CHILD
  === '1')
  throw new Error('Recursive native CLI fixture is forbidden');
const env = await createEnvironment();
const requestReceipt = join(env.options.agentDir, 'native-cli-relevance-requests.json');
const entry = fileURLToPath(new URL(
  '../../../cli.mjs',
  import.meta.url
));
const networkGuard = fileURLToPath(new URL(
  'process-network-guard.ts',
  import.meta.url
));
const child = spawn(
  process.execPath,
  [
    '--max-old-space-size=512',
    '--import',
    networkGuard,
    entry,
    '--mode',
    'rpc',
    '--no-session',
    '--no-extensions',
    '--no-mcp',
    '--no-skills',
    '--no-prompt-templates',
    '--no-themes',
    '--provider',
    'qwen-token-plan-individual',
    '--model',
    'qwen3.8-flash'
  ],
  {
    cwd: env.options
      .cwd,
    env: {
      ...process.env,
      PI_OFFLINE: '1',
      PI_AUTO_MODE_CLI_FIXTURE_CHILD: '1',
      QWEN_TOKEN_PLAN_API_KEY: 'synthetic-local-fixture-only',
      AUTO_MODE_LLMGATEWAY_API_KEY: 'synthetic-local-fixture-only',
      PI_AUTO_MODE_CLI_FIXTURE_REQUESTS: requestReceipt
    },
    stdio: [
      'pipe',
      'pipe',
      'pipe'
    ],
    signal: AbortSignal.timeout(30_000),
    killSignal: 'SIGKILL',
  }
);
const diagnostics = [];
child.stderr
  .setEncoding('utf8');
child.stderr
  .on(
    'data',
    function retainChildStderr(chunk) { return ( diagnostics.push(chunk)); }
  );

async function readNativeState() {
  const lines = createInterface({ input: child.stdout });
  child.stdin
    .write(`${JSON.stringify({
      type: 'get_state',
      id: 'native-host-state'
    })  }\n`);
  using readerScope = {
    [Symbol.dispose]() {
      child.stdin.end();
      lines.close();
    }
  };
  {
    for await (const line of lines) {
      const response = JSON.parse(line);
      if ((response.type !== 'response') || (response.id !== 'native-host-state')) continue;
      assert.equal(
        response.success,
        true,
        JSON.stringify(response)
      );
      assert.equal(
        response.data
          .model
          .provider,
        'qwen-token-plan-individual'
      );
      assert.equal(
        response.data
          .model
          .id,
        'qwen3.8-flash'
      );
      assert.equal(
        response.data
          .isStreaming,
        false
      );
      assert.equal(
        response.data
          .pendingMessageCount,
        0
      );
      assert.equal(
        response.data
          .messageCount,
        0
      );
      return response.data;
    }
    throw new Error(`Native CLI exited without its requested RPC state: ${  diagnostics.join('')}`);
  }
}

await using processScope = {
  async [Symbol.asyncDispose]() {
    if ((child.exitCode === null) && (child.signalCode === null)) child.kill('SIGKILL');
    await env.drain();
  }
};
{
  const [state, [code, signal]] = await Promise.all([
    readNativeState(),
    once(
      child,
      'close'
    )
  ]);
  assert.equal(
    code,
    0,
    diagnostics.join('')
  );
  assert.equal(
    signal,
    null
  );
  assert.equal(
    diagnostics.join(''),
    '',
    'Native CLI lifecycle must not emit shutdown errors'
  );
  const requests = JSON.parse(await readFile(requestReceipt, 'utf8'));
  assert.ok(requests.length > 0, 'Positive control: startup classification must exercise the local transport');
  for (const request of requests) {
    assert.equal(request.url, 'https://api.llmgateway.io/v1/decisions');
    assert.ok(request.questions > 0);
  }
  console.log(JSON.stringify({
    complete: true,
    actualCliProcess: true,
    rpcStateVerified: true,
    provider: state.model
      .provider,
    model: state.model
      .id,
    externalProviderRequests: 0,
    localClassificationRequests: requests.length,
    cleanShutdown: true,
    genuineHumanApprovals: 0
  }));
}
