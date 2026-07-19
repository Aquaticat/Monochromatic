# Morph MCP 0.8.193: Fast Apply fails with `Premature close` through OpenAI's Node `node-fetch`

> Scratch-path note: `/tmp/agent` paths in this document are historical.
> Use `~/temp/agent` for current work.

## Symptom

Morph MCP tools are registered and callable,
 but local file editing and codebase search fail before returning
Morph content.

The Pi MCP server is named `morph` and lists three tools.
 The edit tool still failed after the Morph key was
rotated and the MCP server metadata was reconnected:

```text
# morph_edit_file output, line wrapped for width
Error: ❌ Morph Edit Failed: Invalid response body while trying to fetch
https://api.morphllm.com/v1/chat/completions: Premature close
```

The Morph semantic search tool returned the related transport failure:

```text
# morph_codebase_search output, line wrapped for width
Error: Invalid response body while trying to fetch
https://api.morphllm.com/v1/chat/completions: Premature close
```

This is not the local missing-key or bad-key-format symptom.
 The same key from `/home/user/.pi/agent/mcp.json`
works with native `fetch`,
 and both `morph-v3-fast` and `morph-v3-large` return `HTTP 200` when called outside
MCP.

## Root cause

The failure is in the Node client transport used by Morph MCP,
 not in the rotated key and not in basic API
reachability.

The running Pi Morph MCP installation is:

- `@morphllm/morphmcp` 0.8.193.
- `@morphllm/morphsdk` 0.2.183.
- `openai` 4.104.0.

`@morphllm/morphsdk` 0.2.183 constructs a single OpenAI-compatible chat-completions request for Fast Apply.
It chooses `morph-v3-large` unless `large` is disabled,
 defaults the base API URL to
`https://api.morphllm.com`,
 creates an OpenAI client with `baseURL: ${apiUrl}/v1`,
 and calls
`client.chat.completions.create(...)`.

Installed Morph SDK file,
 package-relative path
`node_modules/@morphllm/morphsdk/dist/tools/index.cjs:401 to 430`:

```js
// .../node_modules/@morphllm/morphsdk/dist/tools/index.cjs
async function callMorphAPI(originalCode, codeEdit, instructions, filepath, config) {
  const apiKey = config.morphApiKey || (typeof process !== "undefined" ? process.env?.MORPH_API_KEY : void 0);
  const apiUrl = config.morphApiUrl || DEFAULT_API_URL;
  const useLarge = config.large ?? (typeof process !== "undefined" ? process.env?.MORPH_LARGE_APPLY !== "false" : true);
  const model = useLarge ? "morph-v3-large" : "morph-v3-fast";
  const timeout = config.timeout || DEFAULT_TIMEOUT;
  const debug = config.debug || false;
  if (!apiKey) {
    throw new Error(
      "Morph API key not found. Set MORPH_API_KEY environment variable or pass morphApiKey in config."
    );
  }
  const message = `<instruction>${instructions}</instruction>
<code>${originalCode}</code>
<update>${codeEdit}</update>`;
  logger.debug("FastApply", "http_request", {
    url: `${apiUrl}/v1/chat/completions`,
    model,
    filepath,
    instruction_len: instructions.length,
    original_len: originalCode.length,
    code_edit_len: codeEdit.length
  });
  const startTime = Date.now();
  const client = new import_openai.default({
    apiKey,
    baseURL: `${apiUrl}/v1`,
```

The same call creates the OpenAI client without a `fetch` override:

Installed Morph SDK file,
 package-relative path
`node_modules/@morphllm/morphsdk/dist/tools/index.cjs:426 to 431`:

```js
// .../node_modules/@morphllm/morphsdk/dist/tools/index.cjs
  const client = new import_openai.default({
    apiKey,
    baseURL: `${apiUrl}/v1`,
    timeout,
    maxRetries: config.retryConfig?.maxRetries ?? 3,
    defaultHeaders: { "X-Morph-SDK-Version": SDK_VERSION }
  });
```

OpenAI 4.104.0 documents that,
 on Node.
js,
 it uses `node-fetch` when no custom `fetch` function is provided:

Installed OpenAI package file,
 package-relative path
`node_modules/openai/index.d.ts:61 to 66`:

```ts
// .../node_modules/openai/index.d.ts
    /**
     * Specify a custom `fetch` function implementation.
     *
     * If not provided, we use `node-fetch` on Node.js and otherwise expect that `fetch` is
     * defined globally.
     */
    fetch?: Core.Fetch | undefined;
```

The OpenAI client parses JSON responses by awaiting `response.json()`.
 When its default Node `node-fetch`
transport reads Morph's 200 response body,
 `node-fetch` raises `ERR_STREAM_PREMATURE_CLOSE`.

`/tmp/agent/openai-4.104.0/src/core.ts:82 to 91`:

```ts
// /tmp/agent/openai-4.104.0/src/core.ts
  const contentType = response.headers.get('content-type');
  const mediaType = contentType?.split(';')[0]?.trim();
  const isJSON = mediaType?.includes('application/json') || mediaType?.endsWith('+json');
  if (isJSON) {
    const json = await response.json();

    debug('response', response.status, response.url, response.headers, json);

    return _addRequestID(json, response);
  }
```

That matches the observed MCP error shape:
 no HTTP status-specific Morph message,
 just
`Invalid response body while trying to fetch ... Premature close`.

## Verification

Versions and package artifacts checked:

- Running Pi installation:
   `@morphllm/morphmcp` 0.8.193,
   `@morphllm/morphsdk` 0.2.183,
   `openai` 4.104.0.
- Latest npm package inspected earlier:
   `@morphllm/morphmcp` 0.8.194,
   npm integrity
  `sha512-Wn1z3pAFN33uP7gDSeSrGN7jcuIhpXqm/mdFjlockqEgBvtnsudJTnxUREOjY6zgBofFZ3Enlz6jt/Eoz2+4wA==`.
- Latest npm package inspected earlier:
   `@morphllm/morphsdk` 0.2.184,
   npm integrity
  `sha512-v3ZEPQEY3xoAH3yxQX6c88RQ/9zwQXFxOAwvSg4TRPCGn1Z1PKjIyuia7z5LMNIF17koQ2elgPj5MXQCM1e2sw==`.
- `openai` 4.104.0,
   npm integrity
  `sha512-p99EFNsA/yX6UhVO93f5kJsDRLAg+CTA2RBqdHK4RtK8u5IJw32Hyb2dTGKbnnFmnuoBv5r7Z2CURI9sGZpSuA==`.

The configured Pi MCP key lives in `/home/user/.pi/agent/mcp.json` under server `morph`.
 The raw test printed
only a SHA-256 fingerprint prefix,
 not the key value.

### Version bump check

Bumping the Pi installation from `@morphllm/morphmcp` 0.8.193 to 0.8.194 is not expected to fix this failure.
`npm view @morphllm/morphmcp@latest version dependencies --json` returned 0.8.194 with
`@morphllm/morphsdk` pinned to 0.2.184.
 `npm view @morphllm/morphsdk@latest version dependencies --json`
returned 0.2.184 with `openai` `^4.52.7`.

The latest `@morphllm/morphsdk` 0.2.184 tarball was inspected under `/tmp/agent/morphsdk-0.2.184`.
Its Fast Apply code still constructs `new OpenAI(...)` without `fetch: globalThis.fetch`:

```text
# rg over /tmp/agent/morphsdk-0.2.184/dist/tools/fastapply/*.cjs and dist/tools/index.cjs
/tmp/agent/morphsdk-0.2.184/dist/tools/fastapply/apply.cjs:411:  const client = new import_openai.default({
/tmp/agent/morphsdk-0.2.184/dist/tools/fastapply/apply.cjs:413:    baseURL: `${apiUrl}/v1`,
/tmp/agent/morphsdk-0.2.184/dist/tools/fastapply/apply.cjs:416:
  defaultHeaders: { "X-Morph-SDK-Version": SDK_VERSION }
```

So the latest published MCP package moves from SDK 0.2.183 to 0.2.184,
 but the relevant transport path remains
OpenAI's default Node transport.
 Unless Morph publishes a newer package that passes a native fetch override or
moves off OpenAI's `node-fetch` default,
 the bump alone leaves the reproduced failure path intact.

### API host and auth behavior

The API host is reachable from this machine.
 An unauthenticated models request returned a structured Morph
401 JSON error through Cloudflare:

```bash
# /var/home/user/Monochromatic
curl --silent --show-error --include --max-time 20 https://api.morphllm.com/v1/models
```

```text
# output excerpt
HTTP/2 401
server: cloudflare

Error type: authentication_error
Error code: missing_api_key
Message: API key required. Please provide a valid API key in the Authorization header.
Dashboard: https://morphllm.com/dashboard
```

A chat-completions request with an invalid test key also returns a structured 401,
 not `Premature close`:

```bash
# /var/home/user/Monochromatic
curl --silent --show-error --include --max-time 20 --request POST \
  --url https://api.morphllm.com/v1/chat/completions \
  --header 'Authorization: Bearer invalid-test-key' \
  --header 'Content-Type: application/json' \
  --data '{"model":"morph-v3-fast","messages":[{"role":"user","content":"hello"}]}'
```

```text
# output excerpt
HTTP/2 401
server: cloudflare

Error type: authentication_error
Error code: invalid_api_key
Message: API key required. Please provide a valid API key in the Authorization header.
Dashboard: https://morphllm.com/dashboard
```

### Rotated-key raw API requests

A raw native `fetch` request using the key from `/home/user/.pi/agent/mcp.json` succeeds for both Morph Apply
models:

```text
# node script output, key not printed
Config path: /home/user/.pi/agent/mcp.json
Morph-keyed server count: 1

Server: morph
Command: morph-mcp
Env has MORPH_API_KEY: true
Key fingerprint: sha256:e3dce5fe1dac
MORPH_API_URL: https://api.morphllm.com
MORPH_LARGE_APPLY: (unset)
Raw morph-v3-fast: status=200 elapsed_ms=351 body_len=643
Raw morph-v3-large: status=200 elapsed_ms=419 body_len=644
```

A second native-vs-node-fetch harness using the same key shows the exact transport split:

```text
# node script output, key not printed
native fetch text: ok status=200 elapsed_ms=310
native fetch json: ok status=200 elapsed_ms=225
node-fetch text: error elapsed_ms=261
Error name: FetchError
Error message: Invalid response body while trying to fetch https://api.morphllm.com/v1/chat/completions: Premature close
Error type/code: system/ERR_STREAM_PREMATURE_CLOSE
node-fetch json: error elapsed_ms=226
Error name: FetchError
Error message: Invalid response body while trying to fetch https://api.morphllm.com/v1/chat/completions: Premature close
Error type/code: system/ERR_STREAM_PREMATURE_CLOSE
```

The OpenAI SDK fails when it uses its default Node transport:

```text
# node script output, key not printed
Imported OpenAI from:
/home/user/.local/share/mise/installs/npm-morphllm-morphmcp/latest/lib/node_modules/
@morphllm/morphmcp/node_modules/openai/index.mjs
OpenAI SDK morph-v3-fast: error elapsed_ms=311
Error name: FetchError
Error message: Invalid response body while trying to fetch https://api.morphllm.com/v1/chat/completions: Premature close
Error status: (none)
OpenAI SDK morph-v3-large: error elapsed_ms=368
Error name: FetchError
Error message: Invalid response body while trying to fetch https://api.morphllm.com/v1/chat/completions: Premature close
Error status: (none)
```

The same OpenAI SDK succeeds when explicitly constructed with native `fetch`:

```text
# node script output, key not printed
OpenAI SDK with native fetch: ok elapsed_ms=334 id=chatcmpl-9ebc84ed1a418b98
Content: const a = 2;\n
```

### Status host

The public status hostname was not usable as an outage oracle.
 TLS verification failed because the wildcard
certificate expired on 2025-11-05,
 and an insecure fetch returned Vercel `DEPLOYMENT_NOT_FOUND`:

```bash
# /var/home/user/Monochromatic
openssl s_client -servername status.morphllm.com -connect status.morphllm.com:443 </dev/null 2>/dev/null \
  | openssl x509 -noout -dates -subject
curl --silent --show-error --include --insecure --max-time 20 https://status.morphllm.com/
```

```text
# output excerpt
notBefore=Aug  7 11:26:22 2025 GMT
notAfter=Nov  5 11:26:21 2025 GMT
subject=CN=*.morphllm.com

HTTP/2 404
x-vercel-error: DEPLOYMENT_NOT_FOUND

The deployment could not be found on Vercel.
```

Morph documentation confirms the expected MCP configuration and endpoint:

- `docs.morphllm.com/mcpquickstart` says `MORPH_API_KEY` is required and `MORPH_API_URL` defaults to
  `https://api.morphllm.com`.
- `docs.morphllm.com/api-reference/endpoint/apply` shows Fast Apply using `baseURL:
  "https://api.morphllm.com/v1"` and `client.chat.completions.create(...)`.

### Patterns that work cleanly

- DNS,
   TLS,
   and HTTP connectivity to `https://api.morphllm.com/v1/models` work from this machine.
- Missing or invalid credentials produce structured 401 JSON responses from Morph.
- Native `fetch` with the rotated Pi MCP key succeeds against `morph-v3-fast` and `morph-v3-large`.
- OpenAI 4.104.0 succeeds against Morph when constructed with `fetch: globalThis.fetch`.

### Patterns that fail

- `morph_edit_file` fails with `Premature close` on a scratch TypeScript file after reconnecting metadata.
- `morph_codebase_search` fails with `Premature close` against this repository after key rotation.
- OpenAI 4.104.0 fails against Morph when it uses its default Node `node-fetch` transport.
- `node-fetch` fails against Morph's 200 JSON response for both `.text()` and `.json()`.

## Verified workarounds

### Consumer code using OpenAI directly can pass native `fetch`

When constructing the OpenAI client directly,
 pass `fetch: globalThis.fetch`:

```ts
// consumer-side workaround
const client = new OpenAI({
  apiKey: process.env.MORPH_API_KEY,
  baseURL: 'https://api.morphllm.com/v1',
  fetch: globalThis.fetch,
});
```

Tradeoff:
 this helps consumer code that owns OpenAI client construction.
 It does not fix the current Morph MCP
server because `@morphllm/morphsdk` constructs the OpenAI client internally without exposing a `fetch` option.

### Use Pi's non-Morph file tools while this persists

Use `morph_edit_file` only as the attempted fast path.
 If it returns `Premature close`,
 fall back to exact `edit`
or full `write` when creating new files.

Tradeoff:
 this loses Morph's semantic merge behavior and can cost more context.
 It avoids blocking work on a
remote body-read failure.

## What does not work

- Rotating the key in `/home/user/.pi/agent/mcp.json` did not fix MCP tool calls.
- Reconnecting Morph MCP metadata did not fix MCP tool calls.
- Changing the lazy edit snippet from a full replacement to `// ... existing code ...` markers did not change the
  failure.
- Treating this as a missing API key does not match the evidence.
   The same configured key succeeds with native
  `fetch`,
   and invalid credentials return structured 401 JSON from the public API.
- The public `status.morphllm.com` hostname does not currently provide status data from this workstation.

## Upstream filing artifact

### Out-of-scope check

No `.out-of-scope/` file names Morph,
 Morph MCP,
 Morph SDK,
 OpenAI's Node client,
 or `node-fetch`.

### Duplicate search

The following searches returned no matching open or closed issues or pull requests:

```bash
# /var/home/user/Monochromatic
gh search issues --owner morphllm --state open --limit 20 \
  '"Premature close" "Invalid response body" "chat/completions" morphmcp'
gh search issues --owner morphllm --state closed --limit 20 \
  '"Premature close" "Invalid response body" "chat/completions" morphmcp'
gh search prs --owner morphllm --state open --limit 20 \
  '"Premature close" "Invalid response body" "chat/completions" morphmcp'
gh search prs --owner morphllm --state closed --limit 20 \
  '"Premature close" "Invalid response body" "chat/completions" morphmcp'
```

### Upstream filing decision

- **Is it really upstream's fault?
  ** Yes,
   but the responsible boundary is split.
   Morph MCP and Morph SDK rely on
  OpenAI's default Node `node-fetch` transport.
   Native `fetch` works,
   and OpenAI with `fetch: globalThis.fetch`
  works.
   Morph can fix the user-facing MCP failure by passing a native fetch override or exposing one.
- **Can upstream fix it?
  ** Yes.
   Morph SDK's OpenAI client construction can include `fetch: globalThis.fetch` on
  runtimes where native fetch exists,
   or expose a `fetch` option through the SDK and MCP server.
- **Are they supporting this use case?
  ** Yes.
   Morph's MCP quickstart documents `edit_file`,
   `codebase_search`,
  `MORPH_API_KEY`,
   and the `https://api.morphllm.com` default.
- **Would the repo welcome our contribution?
  ** Unknown.
   The npm package metadata points `bugs` at
  `https://github.com/modelcontextprotocol/servers/issues`,
   which does not appear to be the Morph API issue
  tracker.
   Public Morph repos did not expose an obvious `morphmcp` source repository during this investigation.
- **Will they likely fix it?
  ** Unknown.
   There is not enough public issue-tracker signal for this exact transport
  failure.
- **Have we prototyped a minimal fix compatible with their architecture?
  ** Partly.
   A direct OpenAI client using
  `fetch: globalThis.fetch` succeeds with the configured Pi MCP key.
   This proves the transport substitution.
  It is not yet a patch against Morph SDK because the package source repository was not located.

Decision:
 do not file as-is.
 Keep this as a local troubleshooting record until the correct Morph MCP or SDK issue
tracker is known.

~~~md
Title: Morph MCP Fast Apply fails with `Invalid response body ... Premature close`
through OpenAI's default Node transport

Do not file as-is. This draft needs the correct upstream tracker for Morph MCP or Morph SDK.

## Symptom

Morph MCP tools are connected, but `edit_file` and `codebase_search` both fail with:

```text
Invalid response body while trying to fetch https://api.morphllm.com/v1/chat/completions: Premature close
```

## Evidence gathered

- The configured key from `/home/user/.pi/agent/mcp.json` works with native `fetch` against
  `https://api.morphllm.com/v1/chat/completions`.
- `morph-v3-fast` and `morph-v3-large` both return `HTTP 200` with native `fetch`.
- OpenAI 4.104.0 fails with `ERR_STREAM_PREMATURE_CLOSE` when it uses its default Node `node-fetch` transport.
- OpenAI 4.104.0 succeeds when constructed with `fetch: globalThis.fetch`.
- `@morphllm/morphsdk` constructs the OpenAI client internally without passing a `fetch` override.

## Suggested fix

In Morph SDK's Fast Apply OpenAI client construction, use native fetch when it is available, or expose a fetch
override from the SDK and MCP server config.

```diff
 const client = new OpenAI({
   apiKey,
   baseURL: `${apiUrl}/v1`,
   timeout,
   maxRetries: config.retryConfig?.maxRetries ?? 3,
+  fetch: globalThis.fetch,
   defaultHeaders: { "X-Morph-SDK-Version": SDK_VERSION },
 });
```

## Workaround for consumer code

If constructing the OpenAI client directly, pass `fetch: globalThis.fetch`.
~~~
