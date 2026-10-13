# @monochromatic-dev/agent-harness-shared-search-fetch

Host-neutral search and fetch core: provider fallback, global host blocklist,
gh URL routing, shared tool specs, and guarded valibot to TypeBox conversion.

## Why

The same search and fetch behavior serves the pi extension
(`@monochromatic-dev/pi-plugin-search-fetch`) and the MCP server
(`@monochromatic-dev/mcp-search-fetch`).
Keeping behavior here makes host differences structural only:
tool contracts, provider routing, blocklist enforcement, and output formatting
have exactly one implementation.

## Contents

- `tool-spec.ts` declares the two tool contracts once in valibot,
  including names, descriptions, and behavior text.
- `tool-exec.ts` runs search and fetch for every host:
  provider fallback, blocklist enforcement, ignored-key warnings, output formatting.
- `valibot-to-typebox.ts` converts the valibot specs into the TypeBox form pi compiles,
  covering exactly the constructs the specs use and throwing on anything else.
- `config.ts`, `client.ts`, `exa-client.ts`, `search-fetch-client.ts` load config and route providers.
- `gh-client.ts`, `gh-*.ts` plan and run gh CLI fetches for mapped GitHub URLs.
- `domain-policy.ts` enforces the global host blocklist.
- `markdown-data-image-filter.ts` strips base64 data-URL images from markdown.
- `tool-output.ts` formats model-visible output with truncation and a full-response temp path.
- `file-mutation-queue.ts` serializes same-path file mutations.

## Schema contract

Valibot is the single source for tool parameters.
Parameter schemas are open objects (`v.object`, never `v.strictObject`) because ignored keys
are a behavior: hosts warn about them instead of rejecting the call.

## Usage

```ts
import {
  executeWebSearchTool,
  loadLinkupConfig,
  webSearchToolSpec,
} from '@monochromatic-dev/agent-harness-shared-search-fetch/ts';
```

## Tests

- Moved suites cover clients, config, blocklist policy, gh routing plans, markdown filtering,
  and output formatting.
- `valibot-to-typebox.unit.test.ts` proves converter verdicts match valibot and that
  unsupported constructs fail loud.
- `file-mutation-queue.unit.test.ts` proves same-path serialization and cross-path concurrency.
- `tool-exec.unit.test.ts` covers shared execution branches.
