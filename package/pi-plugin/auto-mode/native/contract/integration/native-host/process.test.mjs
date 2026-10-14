import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { createEnvironment } from '../native-batch/environment.mjs';

if (process.env.PI_AUTO_MODE_CLI_FIXTURE_CHILD === '1')
  throw new Error('Recursive native CLI fixture is forbidden');
const env = await createEnvironment();
const entry = fileURLToPath(new URL('../../../cli.mjs', import.meta.url));
const networkGuard = fileURLToPath(new URL('./process-network-guard.mjs', import.meta.url));
const child = spawn(process.execPath, ['--max-old-space-size=512', '--import', networkGuard,
  entry, '--mode', 'rpc', '--no-session', '--no-extensions', '--no-mcp', '--no-skills',
  '--no-prompt-templates', '--no-themes', '--provider', 'qwen-token-plan-individual',
  '--model', 'qwen3.8-flash'], {
  cwd: env.options.cwd,
  env: { ...process.env, PI_OFFLINE: '1', PI_AUTO_MODE_CLI_FIXTURE_CHILD: '1',
    QWEN_TOKEN_PLAN_API_KEY: 'synthetic-local-fixture-only' },
  stdio: ['pipe', 'pipe', 'pipe'], signal: AbortSignal.timeout(30_000), killSignal: 'SIGKILL',
});
const diagnostics = [];
child.stderr.setEncoding('utf8');
child.stderr.on('data', chunk => diagnostics.push(chunk));

async function readNativeState() {
  const lines = createInterface({ input: child.stdout });
  child.stdin.write(JSON.stringify({ type: 'get_state', id: 'native-host-state' }) + '\n');
  try {
    for await (const line of lines) {
      const response = JSON.parse(line);
      if (response.type !== 'response' || response.id !== 'native-host-state') continue;
      assert.equal(response.success, true, JSON.stringify(response));
      assert.equal(response.data.model.provider, 'qwen-token-plan-individual');
      assert.equal(response.data.model.id, 'qwen3.8-flash');
      assert.equal(response.data.isStreaming, false);
      assert.equal(response.data.pendingMessageCount, 0);
      assert.equal(response.data.messageCount, 0);
      return response.data;
    }
    throw new Error('Native CLI exited without its requested RPC state: ' + diagnostics.join(''));
  } finally {
    child.stdin.end();
    lines.close();
  }
}

try {
  const [state, [code, signal]] = await Promise.all([readNativeState(), once(child, 'exit')]);
  assert.equal(code, 0, diagnostics.join(''));
  assert.equal(signal, null);
  assert.equal(diagnostics.join(''), '', 'Native CLI lifecycle must not emit shutdown errors');
  console.log(JSON.stringify({ complete: true, actualCliProcess: true, rpcStateVerified: true,
    provider: state.model.provider, model: state.model.id, externalProviderRequests: 0,
    cleanShutdown: true, genuineHumanApprovals: 0 }));
} finally {
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  await env.drain();
}
