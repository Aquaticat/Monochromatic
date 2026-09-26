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

`web_fetch` routes GitHub URLs through the local `gh` CLI before any paid provider.
Every other URL fetches through Linkup first to preserve rendered-page behavior.
Linkup failures fall back to Exa contents when Exa credentials are configured.

GitHub hosts carrying a `gh` mapping:

- `github.com` and `www.github.com`
- `gist.github.com`
- `api.github.com`
- `raw.githubusercontent.com`

Mapped GitHub URL shapes and the `gh` work each one uses:

- repository home page:
   `gh repo view` returning repository metadata and the README
- `blob`/`raw`/`blame` file URLs:
   `gh api` contents read with the raw media type
- `tree` directory URLs:
   `gh api` contents read projected to tab-separated `type`/`name`/`size` lines
- numbered `issues` URLs:
   `gh issue view` for the body plus `gh issue view --comments` for the thread
- numbered `pull` URLs:
   `gh pr view` for the body plus `gh pr view --comments` for the thread
- `pull` changed-file URLs:
   `gh pr diff`
- `commit` URLs:
   `gh api` with the diff media type
- `compare` URLs:
   `gh api` with the diff media type
- `releases` URLs:
   `gh release list`
- `releases/tag` URLs:
   `gh release view` with an explicit `--repo`
- gist URLs:
   `gh gist view`
- `api.github.com` URLs:
   `gh api` with the same path and query

GitHub shapes with no `gh` mapping fall through to the paid provider chain:

- owner and organization pages
- `actions` runs
- `wiki` pages
- `discussions`
- `projects`
- `pulse` and other graph pages
- release asset downloads

One git reference may itself contain slashes,
 so blob and tree URLs are ambiguous.
The planner builds one ordered attempt per split point with the shortest reference first,
encodes the decoded reference as one whole `ref` query value,
and the first attempt whose `gh` call exits zero answers.
A failure other than gh's ordinary exit code 1 ends the sequence instead of trying another split,
so an environmental failure costs one attempt rather than one per split point.

Each `gh` invocation runs in a temporary working directory so no ambient repository context reaches it.
One invocation carries a fixed 60-second deadline and a 32 MiB captured output ceiling.
The child environment pins `GH_HOST` to `github.com`,
 `GH_FORCE_TTY` to empty,
 `CLICOLOR_FORCE` to `0`,
and `NO_COLOR` to `1`,
so ambient values cannot redirect a fetch or switch gh to colored terminal-shaped output.
Pull request diffs also pass `--color never`.

These outcomes all fall back to Linkup and then Exa:

- missing `gh` executable
- unauthenticated `gh`
- exceeded deadline
- exceeded output ceiling
- non-zero `gh` exit
- unmapped GitHub shape

Tool-result details record every fallback step as `fallbackChain`.
A cancelled tool call rethrows before every provider hop instead of continuing to the next provider.

`gh` output returns in the same single-field `{ "markdown": ... }` shape Linkup uses,
 so the model sees raw text.
Output that is not renderable text returns a one-line notice naming the captured byte count instead of
replacement characters.
Font and image blobs take that path,
as does any payload carrying a NUL byte.
A failed optional comment read leaves its own one-line notice after the thread body,
so a partial thread is visible rather than silent.
Whitespace-only file content is preserved exactly.

Linkup fetch uses fixed behavior:

- `renderJs: true`
- `extractImages: false`
- `includeRawHtml: false`

Blocked fetch hosts throw before any `gh` invocation or provider network request is made.

After fetching,
the extension removes Markdown inline images backed by base64 `data:image/` URLs from the model-visible response.
Line-isolated images remove their complete physical lines,
while images sharing a line with prose remove only the image construct.
The untouched provider response remains available in tool-result details.

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
