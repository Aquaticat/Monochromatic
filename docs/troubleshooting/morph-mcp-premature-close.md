# Morph MCP 0.8.194: Fast Apply and WarpGrep calls fail with `Premature close` from `api.morphllm.com`

## Symptom

Morph MCP tools are registered and callable, but both local file editing and codebase search fail before returning
Morph content.

The Pi direct edit tool returned this error twice against a scratch file:

```text
# filesystem_with_morph_edit_file output, line wrapped for width
Error: ❌ Morph Edit Failed: Invalid response body while trying to fetch
https://api.morphllm.com/v1/chat/completions: Premature close
```

The same edit call through the MCP gateway returned the same message:

```text
# mcp filesystem_with_morph_edit_file output, line wrapped for width
Error: ❌ Morph Edit Failed: Invalid response body while trying to fetch
https://api.morphllm.com/v1/chat/completions: Premature close
```

The Morph semantic search tool returned the related transport failure:

```text
# filesystem_with_morph_codebase_search output, line wrapped for width
Error: Invalid response body while trying to fetch
https://api.morphllm.com/v1/chat/completions: Premature close
```

This is not the local missing-key or bad-key-format symptom. The MCP server remained connected, and `mcp({})`
reported `filesystem-with-morph` as connected with three tools.

## Root cause

The exact upstream service cause was not confirmed from this workstation. The verified local call chain reaches
Morph's OpenAI-compatible `/v1/chat/completions` endpoint and then fails while the client reads the response body.

`@morphllm/morphsdk` 0.2.184 constructs a single OpenAI-compatible chat-completions request for Fast Apply.
It chooses `morph-v3-large` unless `large` is disabled, defaults the base API URL to
`https://api.morphllm.com`, creates an OpenAI client with `baseURL: ${apiUrl}/v1`, and calls
`client.chat.completions.create(...)`.

`/tmp/agent/morphsdk-0.2.184/dist/tools/index.cjs:401 to 431`:

```js
// /tmp/agent/morphsdk-0.2.184/dist/tools/index.cjs
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
    timeout,
    maxRetries: config.retryConfig?.maxRetries ?? 3,
    defaultHeaders: { "X-Morph-SDK-Version": SDK_VERSION }
  });
```

`@morphllm/morphsdk` 0.2.184 surfaces authentication and rate-limit responses as different messages.
A 401 response becomes `Authentication failed...`; a 429 response becomes `Rate limited...`.

`/tmp/agent/morphsdk-0.2.184/dist/tools/index.cjs:433 to 461`:

```js
// /tmp/agent/morphsdk-0.2.184/dist/tools/index.cjs
  try {
    const completion = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: message }]
    });
    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Morph API returned empty response");
    }
    const elapsed = Date.now() - startTime;
    logger.debug("FastApply", "http_response", {
      status: 200,
      completion_id: completion.id,
      content_len: content.length,
      latency_ms: elapsed
    });
    return { content, completionId: completion.id };
  } catch (error) {
    const elapsed = Date.now() - startTime;
    const status = error?.status || error?.response?.status;
    logger.error("FastApply", "http_error", {
      status,
      error: error?.message,
      latency_ms: elapsed
    });
    if (status === 401) {
      const err = new Error(
        "Authentication failed: Your Morph API key is invalid or has been revoked. " +
        "Please visit https://morphllm.com to get a valid API key, then update your MCP configuration."
      );
```

The OpenAI TypeScript client parses JSON responses by awaiting `response.json()`. If the HTTP response body
closes before the JSON body is complete, the underlying fetch stack raises a body-read error instead of a
structured API status.

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

That matches the observed error shape: no HTTP status-specific Morph message, just
`Invalid response body while trying to fetch ... Premature close`.

## Verification

Versions and package artifacts checked:

- `@morphllm/morphmcp` 0.8.194, npm integrity
  `sha512-Wn1z3pAFN33uP7gDSeSrGN7jcuIhpXqm/mdFjlockqEgBvtnsudJTnxUREOjY6zgBofFZ3Enlz6jt/Eoz2+4wA==`.
- `@morphllm/morphsdk` 0.2.184, npm integrity
  `sha512-v3ZEPQEY3xoAH3yxQX6c88RQ/9zwQXFxOAwvSg4TRPCGn1Z1PKjIyuia7z5LMNIF17koQ2elgPj5MXQCM1e2sw==`.
- `openai` 4.104.0, npm integrity
  `sha512-p99EFNsA/yX6UhVO93f5kJsDRLAg+CTA2RBqdHK4RtK8u5IJw32Hyb2dTGKbnnFmnuoBv5r7Z2CURI9sGZpSuA==`.

The API host is reachable from this machine. An unauthenticated models request returned a structured Morph
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

The chat-completions endpoint also returns a structured 401 for an invalid test key, not `Premature close`:

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

The public status hostname was not usable as an outage oracle. TLS verification failed because the wildcard
certificate expired on 2025-11-05, and an insecure fetch returned Vercel `DEPLOYMENT_NOT_FOUND`:

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

- DNS, TLS, and HTTP connectivity to `https://api.morphllm.com/v1/models` work from this machine.
- Missing or invalid API credentials produce structured 401 JSON responses from Morph.
- The local MCP server is connected and lists `filesystem-with-morph` tools.

### Patterns that fail

- `filesystem_with_morph_edit_file` fails with `Premature close` on a scratch TypeScript file.
- `filesystem_with_morph_codebase_search` fails with `Premature close` against this repository.
- Calling `filesystem_with_morph_edit_file` through the generic MCP gateway fails with the same message.

## Verified workarounds

### Use Pi's non-Morph file tools while this persists

Use `filesystem_with_morph_edit_file` only as the attempted fast path. If it returns `Premature close`, fall back
to exact `edit`, `filesystem_with_morph_edit_file` alternatives are not required for correctness, or full `write`
when creating new files.

Tradeoff: this loses Morph's semantic merge behavior and can cost more context. It avoids blocking work on a
remote body-read failure.

### Retry after checking the API host

Run the unauthenticated `curl` checks above first. If they return structured 401 responses, local DNS and TLS to
the API host are working. Retry the Morph tool later.

Tradeoff: this only distinguishes host reachability from the Fast Apply response-body failure. It cannot prove
whether valid-key traffic is healthy without a known-good key and a raw API harness.

## What does not work

- Changing the lazy edit snippet from a full replacement to `// ... existing code ...` markers did not change the
  failure.
- Routing the same edit through the generic MCP gateway did not change the failure.
- Treating this as a missing API key does not match the observed messages. Missing and invalid credentials return
  structured 401 JSON from the public API, and the MCP server has separate missing-key and invalid-format messages.
- The public `status.morphllm.com` hostname does not currently provide status data from this workstation.

## Upstream filing artifact

### Out-of-scope check

No `.out-of-scope/` file names Morph, Morph MCP, Morph SDK, or Morph API.

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

- **Is it really upstream's fault?** Not proven. The evidence points at a Morph API or network-edge body closure
  after the MCP server sends a valid-looking request, but this workstation did not run a raw valid-key request.
- **Can upstream fix it?** Unknown. If Morph's service is closing response bodies, upstream can fix it. If an
  intermediary specific to this environment is closing the body, upstream may only be able to improve diagnostics.
- **Are they supporting this use case?** Yes. Morph's MCP quickstart documents `edit_file`, `codebase_search`,
  `MORPH_API_KEY`, and the `https://api.morphllm.com` default.
- **Would the repo welcome our contribution?** Unknown. The npm package metadata points `bugs` at
  `https://github.com/modelcontextprotocol/servers/issues`, which does not appear to be the Morph API issue
  tracker. Public Morph repos did not expose an obvious `morphmcp` source repository during this investigation.
- **Will they likely fix it?** Unknown. There is not enough public issue-tracker signal for this exact transport
  failure.
- **Have we prototyped a minimal fix compatible with their architecture?** No. The failure was not narrowed to a
  client-side source change. A server-side premature response close cannot be prototyped from the npm package.

Decision: do not file as-is. Keep this as a local troubleshooting record until a valid-key raw API reproduction
or Morph-provided incident signal exists.

~~~md
Title: Morph MCP Fast Apply fails with `Invalid response body ... Premature close`

Do not file as-is. This draft lacks a valid-key raw API reproduction and a confirmed upstream tracker.

## Symptom

Morph MCP tools are connected, but `edit_file` and `codebase_search` both fail with:

```text
Invalid response body while trying to fetch https://api.morphllm.com/v1/chat/completions: Premature close
```

## Evidence gathered

- `@morphllm/morphsdk` 0.2.184 sends Fast Apply requests through the OpenAI client to
  `https://api.morphllm.com/v1/chat/completions`.
- The public API host is reachable from the affected machine.
- Missing and invalid credentials return structured 401 JSON from `api.morphllm.com`.
- The generic MCP gateway and Pi's direct Morph tool both return the same `Premature close` message.
- `status.morphllm.com` has an expired wildcard certificate and returns Vercel `DEPLOYMENT_NOT_FOUND` when fetched
  insecurely, so it is not usable as a status source.

## Missing before filing

- Raw valid-key API reproduction outside MCP.
- Confirmation of the right upstream issue tracker.
- Confirmation that the error reproduces outside this workstation or session.
~~~
