# Search fetch migration handover

## Current goal

Change the current Pi Linkup package into an Exa-first search and fetch extension:

- Use Exa whenever available.
- Fall back to Linkup when Exa is missing or fails.
- Rename the extension to `pi-search-fetch`.
- Rewire Pi to use the renamed extension.
- Keep this package handover current while the work proceeds.

## Required skills for the next agent

Use these when the matching work starts:

- `testing-practices`, when changing or reviewing package tests.
- `troubleshooting-doc`, when documenting provider quirks or externally verified behavior.
- `grill-me`, if another design branch needs user decisions.

## User decisions already made

- Public tool names become `web_search` and `web_fetch`.
- Do not keep `linkup_web_search` or `linkup_web_fetch` aliases.
- Exa unavailability means missing Exa credentials or any Exa failure.
- Fallback to Linkup must be logged and covered by tests.
- Config should use a new canonical config file only.
- Migrate the existing old config file instead of keeping `pi-linkup.json` as a fallback path.
- `web_search` should use Exa `fast` by default.
- `web_fetch` should be Linkup-first, despite `web_search` being Exa-first.

## Repository state at latest update

- Package path has moved to `package/pi-plugin/search-fetch/`.
- Package metadata now names `@monochromatic-dev/pi-plugin-search-fetch`.
- Public tool implementation now registers `web_search` and `web_fetch` only.
- Global config loader now uses `pi-search-fetch.json` and migrates legacy `pi-linkup.json`.
- Provider implementation is in place:
  Exa-first `web_search`, Linkup-first `web_fetch`, and fallback metadata in tool details.
- Active Pi settings now point to `/var/home/user/Monochromatic/package/pi-plugin/search-fetch`.
- Active Pi config migrated to `~/.pi/agent/extensions/pi-search-fetch.json`.
- Legacy active Pi config `~/.pi/agent/extensions/pi-linkup.json` was removed after migration.
- Existing unrelated worktree change: `mise.lock`. Do not touch unless the task requires it.

Relevant prior artifacts:

- `doc/troubleshooting/linkup-grokipedia-results.md` records the Linkup pollution diagnosis,
  the Linkup `fast` comparison, and the initial Exa comparison.
- Commits already made for the troubleshooting doc:
  - `f0d91077b`
  - `f66b8863a`
  - `9ca3df6c2`

## Exa search mode benchmark so far

A broader Exa `/search` `auto` versus `fast` benchmark was run across 18 documentation and debugging queries.
The query set included KDE failure cases, Bazzite docs, Node, TypeScript, Rust, MDN, Playwright, Vite,
pnpm, mise, TypeBox, GitHub CLI, systemd, and Kirigami.

Measured fields:

- first expected-source rank
- expected-source count in top ten results
- Grokipedia pollution count
- latency
- simple rank score

Aggregate result after correcting expected hosts for `mise.en.dev` and GitHub-hosted Vite docs:

- `auto`: rank score 72, expected-source hits 104, misses 0, Grokipedia hits 0,
  cache-warmed sampled latency 1815 ms, wins 1 case.
- `fast`: rank score 72, expected-source hits 109, misses 0, Grokipedia hits 0,
  cache-warmed sampled latency 1665 ms, wins 2 cases.

Interpretation:

- The corrected proxy benchmark does not show a quality penalty for `fast`.
- `fast` had more expected-source hits in the corrected sample.
- Both modes had no misses and no Grokipedia pollution.
- `auto` remains Exa's documented recommended mode for most applications.
- The benchmark is still a proxy, not a formal IR benchmark.
- Decision: use Exa `fast` as the default `web_search` mode.
  The corrected benchmark showed no measured quality penalty for `fast`.

Notable benchmark cases:

- `mise.en.dev` is live mise documentation and should count as an expected source.
- GitHub-hosted Vite docs are source documentation and should not be treated as a miss by default.
- `playwright-locators`: `fast` had more expected-host hits than `auto`.
- `typebox-object`: `fast` had more expected-host hits than `auto`.

## Implementation notes

Package rename work:

- Done: move `package/pi-plugin/linkup/` to `package/pi-plugin/search-fetch/`.
- Done: rename package metadata to `@monochromatic-dev/pi-plugin-search-fetch`.
- Done: update `USER_AGENT_VALUE`, logger tags, temp-file prefixes, tests, and exported docs.
- Done: update generated root tooling references through file-enforcer instead of hand-editing `mise.toml`.
- Done: update workspace lockfile importer path only.

Config work:

- Done: canonical config path is `~/.pi/agent/extensions/pi-search-fetch.json`.
- Done: legacy `pi-linkup.json` migrates once into the new file.
- Done: runtime does not keep using the old config path after migration.
- Done: config keys are `exaApiKey`, `linkupApiKey`, and `blocklist`.
- Done: `EXA_API_KEY` wins over config `exaApiKey`.
- Done: `LINKUP_API_KEY` wins over config `linkupApiKey`.
- Done: legacy `apiKey` migrates to `linkupApiKey`.
- Do not write any API key into this handover or other docs.

Blocklist caveat:

- Exa rejects the current bare `gov` blocklist entry when sent through `excludeDomains`.
- Keep local post-response filtering for all normalized blocklist entries.
- Send only API-compatible domain entries to Exa `excludeDomains`.
- Linkup can continue receiving the existing blocklist if its API accepts it,
  but local filtering should remain the enforcement layer.

Search behavior:

- `web_search` should try Exa first when Exa credentials are configured.
- On missing Exa credentials or any Exa failure, log the fallback reason and try Linkup.
- If both providers are unavailable, throw a clear error naming both missing or failed providers.
- Preserve existing supported parameters where practical:
  - `query`
  - `fromDate`
  - `toDate`
  - `includeDomains`
- Map date fields to Exa published-date fields unless docs or tests show another field is better.
- Keep result-count controls fixed unless the user explicitly asks for them.

Fetch behavior decision:

- `web_fetch` should be Linkup-first.
- Exa `/contents` supports URL content extraction with `urls` and `text: true`.
- Linkup `/fetch` currently uses `renderJs=true`, `extractImages=false`, and `includeRawHtml=false`.
- Exa docs do not expose an equivalent `renderJs=true` knob in the fetched docs.
- The user chose Linkup-first fetch to preserve current rendering semantics.
- If Linkup fetch is unavailable and Exa credentials exist, fallback to Exa `/contents` is still plausible,
  but confirm or test before implementing that fallback branch.

Output behavior:

- Rename `LinkupToolDetails` and related output helpers to provider-neutral names.
- Include the provider used in tool details.
- Include fallback metadata when Exa fails and Linkup succeeds.
- Keep current truncation behavior and JSONL rendering for exact `{ "results": [...] }` payloads
  unless tests justify changing it.

## Tests to update or add

Update existing unit tests under the package after the rename.
Add coverage for these branches:

- config loads new file name and rejects unknown keys
- old config migration writes or produces the new config shape
- Exa key comes from `EXA_API_KEY`
- Linkup key comes from `LINKUP_API_KEY`
- Exa search request body shape
- Exa search filters API-forwardable blocklist entries for `excludeDomains`
- local blocklist removes blocked result URLs from Exa and Linkup responses
- Exa success does not call Linkup
- missing Exa key falls back to Linkup
- Exa HTTP failure falls back to Linkup and records/logs the reason
- Exa network failure falls back to Linkup and records/logs the reason
- both providers unavailable throws a clear error
- tools register only `web_search` and `web_fetch`
- old `linkup_web_*` names are absent
- extension verification expects the new names

## Verification commands

After implementation, run package-scoped tasks through mise, not raw tools.
Use the renamed package path once the directory moves:

```sh
mise run //package/pi-plugin/search-fetch:build
mise run //package/pi-plugin/search-fetch:lint:types
mise run //package/pi-plugin/search-fetch:lint:oxlint
mise run //package/pi-plugin/search-fetch:test:unit
mise run //package/pi-plugin/search-fetch:verify:extension
```

## Pi rewiring notes

After build and tests pass:

- Inspect the active Pi package or extension configuration before editing it.
- Replace references to the old package or path with the renamed package.
- Ensure duplicate old and new tools are not both registered.
- Migrate the global config file to `pi-search-fetch.json`.
- Verify a real Pi extension load registers `web_search` and `web_fetch`.

## Final verification in this session

Commands passed:

```sh
mise run //package/pi-plugin/search-fetch:build
mise run //package/pi-plugin/search-fetch:lint:types
mise run //package/pi-plugin/search-fetch:lint:oxlint
mise run //package/pi-plugin/search-fetch:test:unit
mise run //package/pi-plugin/search-fetch:verify:extension
```

Boundary checks passed through the built Pi extension interface with the real migrated config:

- `web_search` registered and returned `provider: "exa"`.
- `web_fetch` registered and returned `provider: "linkup"` with normal environment.
- `web_fetch` returned `provider: "exa"` with fallback metadata when `LINKUP_API_KEY` was cleared for the process.

## Next immediate step

No required implementation step remains for this migration.
Future work can rename internal `Linkup*` compatibility type names if desired,
but public tools and active Pi wiring are already provider-neutral.
