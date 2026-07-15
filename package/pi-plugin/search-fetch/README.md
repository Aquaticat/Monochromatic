# Pi Search Fetch

`@monochromatic-dev/pi-plugin-search-fetch` is a narrow Pi package for web search and page fetch.
It registers only two model-callable tools:

- `web_search`
- `web_fetch`

The package deliberately does not provide web-answer,
account-management,
or per-call search-depth controls.

## Configuration

The extension reads one optional global config file:

```json
{
  "exaApiKey": "optional Exa fallback",
  "linkupApiKey": "optional Linkup fallback",
  "blocklist": ["badwikipedia.invalid"]
}
```

Config path:

```text
~/.pi/agent/extensions/pi-search-fetch.json
```

`EXA_API_KEY` wins over `exaApiKey` in the config file.
`LINKUP_API_KEY` wins over `linkupApiKey` in the config file.
The blocklist is always global and is applied locally after search results,
before fetch attempts,
and to provider-supported request filters where compatible.

A one-time migration can convert the old `pi-linkup.json` shape into this file.
Do not keep runtime fallback to the old config path after migration.

## Tool behavior

`web_search` searches with Exa first when Exa credentials are configured.
It falls back to Linkup when Exa credentials are missing or Exa fails.

Exa search uses fixed behavior:

- `type: "fast"`
- `numResults: 10`
- `excludeDomains` set to provider-compatible configured blocklist entries

Linkup fallback search uses fixed behavior:

- `depth: "standard"`
- `outputType: "searchResults"`
- `excludeDomains` set to the normalized global blocklist

Legacy or unsupported keys such as `depth`,
`limit`,
`maxResults`,
`excludeDomains`,
`includeImages`,
and `outputType` are ignored.
The tool returns a warning text item before the response when that happens.

When a search response is exactly `{ "results": [...] }`,
or has exactly the top-level keys `requestId`,
`resolvedSearchType`,
`results`,
`searchTime`,
and `costDollars`,
and every result is an object,
the tool returns the inner results array as JSONL,
one result object per line.
Other search response shapes are returned as JSON.

`web_fetch` fetches through Linkup first to preserve rendered-page behavior.
It may fall back to Exa contents when Linkup is unavailable and Exa credentials are configured.

Linkup fetch uses fixed behavior:

- `renderJs: true`
- `extractImages: false`
- `includeRawHtml: false`

Blocked fetch hosts throw before any network request is made.

Responses that are exactly a single `markdown` string field are returned as raw markdown text,
for example `{ "markdown": "# Meow" }` becomes `# Meow`.
Other fetch response shapes are returned as JSON.

Both tools cap model-visible response text at 100KB or 2000 lines,
whichever is hit first.
When truncation happens,
the full response is written to a temporary file and the tool result names that path.

## Verification

Run package-scoped tasks:

```bash
mise run //package/pi-plugin/search-fetch:build
mise run //package/pi-plugin/search-fetch:lint:types
mise run //package/pi-plugin/search-fetch:lint:oxlint
mise run //package/pi-plugin/search-fetch:test:unit
mise run //package/pi-plugin/search-fetch:verify:extension
```
