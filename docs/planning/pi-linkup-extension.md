# Planning: Pi Linkup extension

Status:
 resolved implementation plan from grill-me review.
 Not built.
 Authored 2026-06-18.

## Goal

Build a fresh Pi package that replaces the installed `@aliou/pi-linkup`
package with a smaller Linkup-only extension under `packages/pi/linkup/`.
The package keeps the current Linkup-prefixed tool names that the user expects,
but removes web-answer and balance surfaces.

The extension's job is narrow:

- Search with Linkup's `POST /v1/search` endpoint.
- Fetch pages with Linkup's `POST /v1/fetch` endpoint.
- Apply a global host blocklist to every search request and every fetch attempt.
- Return Linkup's own response object as raw JSON text for the model.

The extension is not a general web provider layer,
not a research tool,
not a web-answer tool,
and not a Linkup account-management UI.

## Source facts verified before this plan

- `docs/decisions/pi-web-search-extension.md` rejects every surveyed third-party package
  because none satisfies the web-answer and global-blocklist constraints together.
- Pi package docs say packages declare resources under `package.json#pi`,
  and existing repo Pi packages use `pi.extensions` pointing at `dist/final/node/index.mjs`.
- Existing Pi packages in this repo live under `packages/pi/<slug>/`,
  with package names such as `@monochromatic-dev/pi-advisor`
  and `@monochromatic-dev/pi-terminal-title`.
- Pi extension docs describe `pi.registerTool()` and `prepareArguments()`;
  `prepareArguments()` runs before schema validation and can normalize legacy tool-call shapes.
- Linkup's search reference documents `POST https://api.linkup.so/v1/search`
  with required `q`, `depth`, and `outputType`,
  plus optional `excludeDomains`, `fromDate`, `includeDomains`, `toDate`,
  `includeImages`, and `maxResults`.
- Linkup's fetch reference documents `POST https://api.linkup.so/v1/fetch`
  with required `url`,
  plus optional `renderJs`, `extractImages`, and `includeRawHtml`.
- Linkup fetch has no `excludeDomains` parameter,
  so fetch blocklist enforcement must happen locally before the network call.
- Existing repo Pi package tests are colocated as `src/*.unit.test.ts`
  and run through package-scoped `mise run` tasks.

## Package shape

Create `packages/pi/linkup/` with these package properties:

- Package name: `@monochromatic-dev/pi-linkup`.
- Entry point: `src/index.ts`.
- Built extension: `dist/final/node/index.mjs`.
- `package.json#pi.extensions`: `['./dist/final/node/index.mjs']`.
- Runtime dependencies: none beyond Pi peer dependencies and Node built-ins.
- Peer dependencies: `@earendil-works/pi-coding-agent` and `typebox`.
- Dev dependencies follow sibling Pi packages:
  `@earendil-works/pi-coding-agent`,
  `@monochromatic-dev/config-tsdown`,
  `@monochromatic-dev/config-typescript`,
  `@monochromatic-dev/module-test`,
  and `@types/node`.

The package should include these files at minimum:

- `package.json`
- `mise.toml`
- `tsdown.node.config.ts`
- `src/index.ts`
- `src/client.ts`
- `src/config.ts`
- `src/domain-policy.ts`
- `src/tool-output.ts`
- `src/tools.ts`
- colocated unit tests for each module with branch logic

## Public tools

Register exactly two model-callable tools:

- `linkup_web_search`
- `linkup_web_fetch`

Do not register:

- `linkup_web_answer`
- a generic `web_answer`
- a balance command
- a balance tool
- research tools

This intentionally preserves the user's current Linkup-prefixed tool muscle memory
while removing the low-quality web-answer path.

## Search contract

`linkup_web_search` supports this model-facing input:

```typescript
// docs/planning/pi-linkup-extension.md
type LinkupWebSearchInput = {
  readonly query: string;
  readonly fromDate?: string;
  readonly includeDomains?: readonly string[];
  readonly toDate?: string;
};
```

The request body sent to Linkup is always:

```typescript
// docs/planning/pi-linkup-extension.md
{
  q: input.query,
  depth: 'standard',
  outputType: 'searchResults',
  excludeDomains: config.blocklist,
  ...(input.fromDate === undefined ? {} : { fromDate: input.fromDate }),
  ...(input.includeDomains === undefined ? {} : { includeDomains: input.includeDomains }),
  ...(input.toDate === undefined ? {} : { toDate: input.toDate }),
}
```

Unsupported search parameters are accepted only as compatibility noise,
ignored,
and warned about in the tool result.
This includes:

- `depth`
- `excludeDomains`
- `includeImages`
- `limit`
- `maxResults`
- `outputType`
- every other extra key

The tool must never let a per-call value override the fixed `standard` depth,
the fixed `searchResults` output type,
or the global blocklist.

Search results are not post-filtered by the extension.
The extension relies on Linkup's `excludeDomains` handling for search.
This is an explicit design decision from grill-me review,
not an accidental omission.

## Fetch contract

`linkup_web_fetch` supports this model-facing input:

```typescript
// docs/planning/pi-linkup-extension.md
type LinkupWebFetchInput = {
  readonly url: string;
};
```

The request body sent to Linkup is always:

```typescript
// docs/planning/pi-linkup-extension.md
{
  url: input.url,
  renderJs: true,
  extractImages: false,
  includeRawHtml: false,
}
```

Unsupported fetch parameters are accepted only as compatibility noise,
ignored,
and warned about in the tool result.
This includes:

- `renderJs`
- `extractImages`
- `includeRawHtml`
- every other extra key

Fetch must check the input URL's host against the blocklist before any Linkup call.
If the URL is blocked,
the tool throws an error like:

```text
Blocked by pi-linkup blocklist: badwikipedia.invalid
```

A blocked fetch is a policy refusal,
so it should be a tool error rather than an empty Linkup-shaped response.

## Configuration

Only one config file is read:

```text
~/.pi/agent/extensions/pi-linkup.json
```

The file is optional.
When present,
it has this flat shape:

```json
{
  "apiKey": "optional fallback",
  "blocklist": ["badwikipedia.invalid"]
}
```

API key precedence:

- First: `LINKUP_API_KEY` environment variable.
- Second: `apiKey` in `pi-linkup.json`.

Do not read project config.
This is deliberate:
project config must not weaken or complicate the user's global web-source policy.

Malformed JSON or invalid config must throw a clear error that includes
`pi-linkup.json` and whether the failure came from parsing,
schema validation,
or blocklist normalization.

## Blocklist grammar

Each blocklist entry is a strict host suffix.
Normalization rules:

- Trim surrounding whitespace.
- Lowercase ASCII letters.
- Strip one trailing dot.
- Reject empty entries.
- Reject schemes.
- Reject slashes.
- Reject ports.
- Reject wildcards.
- Reject empty labels.

Matching rules:

- `badwikipedia.invalid` matches `badwikipedia.invalid`.
- `badwikipedia.invalid` matches `www.badwikipedia.invalid`.
- `badwikipedia.invalid` does not match `notbadwikipedia.invalid`.

The normalized blocklist is sent to Linkup search as `excludeDomains`.
The same normalized blocklist is used locally for fetch preflight.

## Tool output

Return Linkup's response object as raw JSON text.
The parsed response object is stored untouched in `details.linkupResponse`.

If ignored parameters were supplied,
return a separate warning text block before the raw JSON block.
The warning should name every ignored key and say the fixed behavior that won.
For example:

```text
Warning: ignored unsupported linkup_web_search parameters: depth, limit.
This extension always uses depth="standard" and Linkup's default result count.
```

Then return the raw response JSON as a separate text content item.
This keeps the Linkup response itself as-is while still making migration warnings
visible to the model.

Large JSON output should be truncated using Pi's default truncation helpers.
When truncation occurs,
write the full JSON response to a temp file and include the path in the visible text.

## Error handling

The client should throw clear errors for:

- missing API key
- non-2xx Linkup response
- invalid JSON response from Linkup
- aborted request
- blocked fetch URL
- invalid config

Error messages should include endpoint context,
but must not include the API key or authorization header.

## Tests

Unit tests should cover the exposed behavior,
not only happy paths.

Config tests:

- absent config uses empty blocklist and no config API key
- environment API key beats config API key
- flat config loads `apiKey` and `blocklist`
- invalid JSON reports config path
- invalid blocklist entry reports offending entry

Domain policy tests:

- exact host match
- subdomain suffix match
- non-boundary suffix does not match
- uppercase and trailing-dot normalization
- schemes, ports, slashes, wildcards, and empty labels are rejected

Client tests with mocked `fetch`:

- search sends `q`, fixed `standard`, fixed `searchResults`, and global `excludeDomains`
- search includes `fromDate`, `includeDomains`, and `toDate` when provided
- search does not send unsupported per-call options
- fetch sends fixed `renderJs: true`, `extractImages: false`, and `includeRawHtml: false`
- non-2xx response throws without leaking secrets

Tool tests:

- extension registers only `linkup_web_search` and `linkup_web_fetch`
- search ignored params produce model-visible warnings
- fetch ignored params produce model-visible warnings
- blocked fetch throws before mocked `fetch` is called
- raw Linkup response is preserved in `details.linkupResponse`
- visible output is JSON for the Linkup response

## Verification plan

Run package-scoped tasks only:

```bash
mise run //packages/pi/linkup:build
mise run //packages/pi/linkup:lint:types
mise run //packages/pi/linkup:lint:oxlint
mise run //packages/pi/linkup:test:unit
```

After package tests pass,
verify the extension at the user boundary:

- Load the local package or source extension through Pi.
- Confirm only `linkup_web_search` and `linkup_web_fetch` are registered.
- Run a real search and inspect the outgoing behavior through a safe fixture or logged mock.
- Run a fetch for an allowed URL.
- Run a fetch for a blocked host and confirm no Linkup network call occurs.
- Install `@monochromatic-dev/pi-linkup` into `~/.pi/agent`.
- Remove `@aliou/pi-linkup` so duplicate `linkup_web_*` tools do not coexist.
- Reload Pi and confirm `linkup_web_answer` is absent.

## Open issues

No user preference questions remain open from grill-me review.
Implementation may still discover API or Pi runtime constraints;
if that happens,
record the source path or docs URL that forced the change before editing behavior.
