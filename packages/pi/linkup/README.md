# Pi Linkup

`@monochromatic-dev/pi-linkup` is a narrow Pi package for Linkup search and fetch.
It registers only two model-callable tools:

- `linkup_web_search`
- `linkup_web_fetch`

The package deliberately does not provide `linkup_web_answer`, balance commands,
research tools, or per-call search-depth controls.

## Configuration

The extension reads one optional global config file:

```json
{
  "apiKey": "optional fallback",
  "blocklist": ["badwikipedia.invalid"]
}
```

Config path:

```text
~/.pi/agent/extensions/pi-linkup.json
```

`LINKUP_API_KEY` wins over `apiKey` in the config file.
The blocklist is always global and is applied to every search request,
every search result after Linkup responds,
and every fetch attempt before Linkup is called.

## Tool behavior

`linkup_web_search` sends Linkup `POST /v1/search` requests with fixed behavior:

- `depth: "standard"`
- `outputType: "searchResults"`
- `excludeDomains` set to the normalized global blocklist

Legacy or unsupported keys such as `depth`, `limit`, `maxResults`,
`excludeDomains`, `includeImages`, and `outputType` are ignored.
The tool returns a warning text item before the JSON response when that happens.

`linkup_web_fetch` sends Linkup `POST /v1/fetch` requests with fixed behavior:

- `renderJs: true`
- `extractImages: false`
- `includeRawHtml: false`

Blocked fetch hosts throw before any network request is made.

## Verification

Run package-scoped tasks:

```bash
mise run //packages/pi/linkup:build
mise run //packages/pi/linkup:lint:types
mise run //packages/pi/linkup:lint:oxlint
mise run //packages/pi/linkup:test:unit
mise run //packages/pi/linkup:verify:extension
```
