import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { createEnvironment } from '../native-batch/environment.mjs';

/**
 Model identity reported by the native host RPC state.

 @typedef {{ readonly provider: string, readonly id: string }} NativeStateModel
 */
/**
 Native host RPC state fields asserted below.

 @typedef {{ readonly model: NativeStateModel, readonly isStreaming: boolean, readonly pendingMessageCount: number, readonly messageCount: number }} NativeState
 */
/**
 Private receipt entry appended by the network guard before each local response.

 @typedef {{ readonly url: string, readonly questions: number }} RequestReceiptEntry
 */

if (process.env
  .PI_AUTO_MODE_CLI_FIXTURE_CHILD
  === '1')
  throw new Error('Recursive native CLI fixture is forbidden');
const env = await createEnvironment();
const requestReceipt = join(
  env.options
    .agentDir,
  'native-cli-relevance-requests.json'
);
const entry = fileURLToPath(new URL(
  '../../../cli.mjs',
  import.meta.url
));
const networkGuard = fileURLToPath(new URL(
  'process-network-guard.ts',
  import.meta.url
));
/** Abort the disposable CLI child once the fixture deadline elapses. */
const CHILD_TIMEOUT_MS = 30_000;
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
    signal: AbortSignal.timeout(CHILD_TIMEOUT_MS),
    killSignal: 'SIGKILL',
  }
);
const diagnostics = [];
child.stderr
  .setEncoding('utf8');
child.stderr
  .on(
    'data',
    function retainChildStderr(chunk) { diagnostics.push(chunk); }
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
      child.stdin
        .end();
      lines.close();
    }
  };
  {
    for await (const line of lines) {
      /**
       Parsed RPC line narrowed to the asserted state shape before typed access.

       @type {unknown}
       */
      const response = JSON.parse(line);
      if ((response === null) || ((typeof response) !== 'object')
        || (!('type' in response))
        || (response.type !== 'response')
        || (!('id' in response))
        || (response.id !== 'native-host-state'))
        continue;
      if ((!('success' in response))
        || (!('data' in response))
        || (response.data === null)
        || ((typeof response.data) !== 'object')
        || (!('model' in response.data))
        || (response.data
          .model
          === null)
        || ((typeof response.data
          .model) !== 'object')
        || (!('provider'
          in response.data
          .model))
        || ((typeof response.data
          .model
          .provider) !== 'string')
        || (!('id'
          in response.data
          .model))
        || ((typeof response.data
          .model
          .id) !== 'string')
        || (!('isStreaming' in response.data))
        || ((typeof response.data
          .isStreaming) !== 'boolean')
        || (!('pendingMessageCount' in response.data))
        || ((typeof response.data
          .pendingMessageCount) !== 'number')
        || (!('messageCount' in response.data))
        || ((typeof response.data
          .messageCount) !== 'number'))
        throw new Error(`Native CLI emitted an unrecognized RPC state: ${line}`);
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
      /**
       Validated native state assembled from the asserted response fields.

       @type {NativeState}
       */
      const state = {
        model: {
          provider: response.data
            .model
            .provider,
          id: response.data
            .model
            .id
        },
        isStreaming: response.data
          .isStreaming,
        pendingMessageCount: response.data
          .pendingMessageCount,
        messageCount: response.data
          .messageCount
      };
      return state;
    }
    throw new Error(`Native CLI exited without its requested RPC state: ${  diagnostics.join('')}`);
  }
}

/**
 Read the private JSONL receipt the guard appends before each local response.

 An unexercised guard leaves no receipt file behind, which reads as an empty receipt.

 @returns entries recorded by the local classifier transport
 */
async function readRequestReceipt() {
  /**
   Receipt entries accumulated from the private JSONL receipt.

   @type {RequestReceiptEntry[]}
   */
  const entries = [];
  try {
    const receiptText = await readFile(
      requestReceipt,
      'utf8'
    );
    for (const line of receiptText.split('\n')) {
      if (line === '') continue;
      /**
       Parsed receipt entry narrowed to its recorded shape before typed access.

       @type {unknown}
       */
      const receiptEntry = JSON.parse(line);
      if ((receiptEntry === null) || ((typeof receiptEntry) !== 'object')
        || (!('url' in receiptEntry))
        || ((typeof receiptEntry.url) !== 'string')
        || (!('questions' in receiptEntry))
        || ((typeof receiptEntry.questions) !== 'number'))
        throw new Error(`The network guard wrote an unrecognized receipt entry: ${line}`);
      entries.push({
        url: receiptEntry.url,
        questions: receiptEntry.questions
      });
    }
  }
  catch (error) {
    if (((typeof error) === 'object') && (error !== null)
      && ('code' in error)
      && (error.code === 'ENOENT'))
      return entries;
    throw error;
  }
  return entries;
}

/**
 Resolve the disposable CLI child's close status without reading its output streams.

 @returns exit status observed when the child closed
 */
async function awaitChildClose() {
  /**
   Close status captured from the disposable child's close event.

   @type {[code: number | null, signal: string | null]}
   */
  const closeEvent = await once(
    child,
    'close'
  );
  return closeEvent;
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
    awaitChildClose()
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
  const requests = await readRequestReceipt();
  assert.ok(
    requests.length > 0,
    'Positive control: startup classification must exercise the local transport'
  );
  for (const request of requests) {
    assert.equal(
      request.url,
      'https://api.llmgateway.io/v1/decisions'
    );
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
