# Linkup `/v1/search` with pi-linkup 0.0.1 returns Grokipedia clusters for unrelated KDE error queries

## Symptom

Pi sessions that call `linkup_web_search` for unrelated KDE or Qt error text can receive result lists dominated by
Grokipedia pages and pages about Grokipedia.
The session transcript from 2026-07-04 showed no query containing `grok` or `gork`,
 but four unrelated KDE searches
returned visible `Grokipedia - Wikipedia` results.

The failing query shapes were exact or near-exact technical snippets:

```text
"kcm_keyboard/main.qml:57" "Kirigami.Action"
"Cannot install element 'NumLockState' into protected module 'org.kde.plasma.private.kcm_keyboard'"
site:bugs.kde.org "kcm_keyboard/main.qml:57:63" OR "configureLayoutsAction"
"Cannot install element" "org.kde.plasma.private.kcm_keyboard"
```

The transcript details showed raw upstream Linkup results containing blocked Grokipedia-family hosts,
then Pi's local filter removed those hosts.
For example,
 one raw result list began with `https://grokipedia.com/`,
`https://en.wikipedia.org/wiki/Grokipedia`,
 and `https://grokipedia.com/page/grokipedia`.
The model-visible list still contained `https://en.wikipedia.org/wiki/Grokipedia` because the Pi blocklist is a host
blocklist,
 not a topic filter.

## Root cause

The local wrapper is not rewriting the query into Grokipedia.
It forwards the model's query as Linkup `q`,
 fixes the search mode to `standard`,
 and sends the configured blocklist as
`excludeDomains`.

`package/pi-plugin/linkup/src/client.ts:122` to `package/pi-plugin/linkup/src/client.ts:129`:

```ts
const body: LinkupSearchRequestBody = {
  q: input.query,
  depth: LINKUP_SEARCH_DEPTH,
  outputType: LINKUP_SEARCH_OUTPUT_TYPE,
  excludeDomains: runtime.blocklist,
  ...(input.fromDate === undefined ? {} : { fromDate: input.fromDate, }),
  ...(input.includeDomains === undefined ? {} : { includeDomains: input.includeDomains, }),
  ...(input.toDate === undefined ? {} : { toDate: input.toDate, }),
};
```

The wrapper then applies a second local blocklist filter after Linkup responds.
This is why raw transcript details can contain Grokipedia-family URLs while the visible output omits those exact hosts.

`package/pi-plugin/linkup/src/tools.ts:321` to `package/pi-plugin/linkup/src/tools.ts:334`:

```ts
const filtered = filterBlockedSearchResults({
  response: rawLinkupResponse,
  blocklist: options.config
    .blocklist,
},);

return createLinkupToolOutput({
  toolName: LINKUP_WEB_SEARCH_TOOL_NAME,
  linkupResponse: filtered.linkupResponse,
  rawLinkupResponse: filtered.rawLinkupResponse,
  ignoredKeys,
  fixedBehavior: SEARCH_FIXED_BEHAVIOR,
  renderResultsArrayAsJsonl: true,
  removedBlockedUrls: filtered.removedBlockedUrls,
},);
```

The local filter only removes results whose URL host matches a configured host suffix.
It does not remove pages on other hosts that discuss the blocked site.

`package/pi-plugin/linkup/src/domain-policy.ts:512` to `package/pi-plugin/linkup/src/domain-policy.ts:544`:

```ts
const filteredResults = rawResults.filter(function keepAllowedResult(result,) {
  /**
   * Local value for resultUrl.
   */
  const resultUrl = searchResultUrl(result,);
  if (!resultUrl.found)
    return true;

  /**
   * Local value for blockedEntry.
   */
  const blockedEntry = blockedEntryForPossiblyInvalidUrl({
    url: resultUrl.url,
    blocklist,
  },);
  if (!blockedEntry.blocked)
    return true;

  removedBlockedUrls.push(resultUrl.url,);
  return false;
},);

if (removedBlockedUrls.length === 0)
  return unfilteredSearchResponse(response,);

l.warn(`removed ${String(removedBlockedUrls.length,)} blocked Linkup search result(s)`,);
return {
  linkupResponse: {
    ...response,
    results: filteredResults,
  },
  rawLinkupResponse: response,
  removedBlockedUrls,
};
```

The upstream reason is Linkup retrieval and ranking,
 not model intent.
Linkup's own documentation describes `standard` as agentic search that interprets the query,
while `fast` is keyword-only and passes the query string to the index as-is.
That explains why sparse technical error snippets can fan out into adjacent or high-SEO results instead of behaving like
literal code search.

The Grokipedia-specific recurrence is also consistent with broader search-provider reports.
A public Startpage thread from 2025-12-02 reports Grokipedia appearing as a top result for an unrelated scientific term.
A Startpage account replied that they are dependent on result providers and pointed to Grokipedia's own SEO.
Another commenter reported the same behavior on Kagi.

## Verification

Version and surfaces checked:

- `@monochromatic-dev/pi-linkup` package version:
   `0.0.1`,
   from `package/pi-plugin/linkup/package.json`.
- Linkup API surface:
   `POST https://api.linkup.so/v1/search`,
   checked on 2026-07-04.
- Pi transcript:

```text
Directory: /var/home/user/.pi/agent/sessions/--var-home-user-Monochromatic--
File: 2026-07-04T11-46-54-985Z_019f2cf3-fb89-7da1-af35-51b83c55b816.jsonl
```

Transcript scan:

```text
linkup_web_search calls: 18
queries containing grok/gork: 0
search result messages containing Grokipedia/Gorkipedia: 4
Gorkipedia exact count: 0
Grokipedia exact count: 1149
```

Direct Linkup API reproduction harness:

```js
// doc/troubleshooting/linkup-grokipedia-results.repro.mjs
const query = '"Cannot install element" "org.kde.plasma.private.kcm_keyboard"';
const response = await fetch('https://api.linkup.so/v1/search', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${process.env.LINKUP_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    q: query,
    depth: 'standard',
    outputType: 'searchResults',
    maxResults: 5,
  }),
});
const body = await response.json();
for (const [index, result] of (body.results ?? []).entries()) {
  console.log(`${index + 1}. ${result.name} | ${result.url}`);
}
```

Failing catalog:

```text
Query: "Cannot install element" "org.kde.plasma.private.kcm_keyboard"
Observed class: broad KDE-ish results can include Grokipedia-family pages,
including a Grokipedia-hosted Fedora KDE result on a direct API retest.

Query: site:bugs.kde.org "kcm_keyboard/main.qml:57:63" OR "configureLayoutsAction"
Observed class: transcript raw Linkup response contained Grokipedia-family hosts,
and visible output still contained pages about Grokipedia on non-blocked hosts.
```

Working catalog:

```text
Query: "Cannot install element" "org.kde.plasma.private.kcm_keyboard"
Parameter: includeDomains=["bugs.kde.org"]
Observed: results were restricted to bugs.kde.org.
Tradeoff: recall is limited to the named host.

Query: "Cannot assign object of type \"Kirigami.Action\"" "Action_QMLTYPE_0" "kcm_keyboard" -site:grokipedia.com
Observed: direct Linkup API returned KDE, NixOS, KDE Bugzilla, mail archive, and Qt Bug Tracker results.
Tradeoff: Google-style operators are query text, not a documented Linkup filtering API.
Prefer `excludeDomains` or local filtering when the caller controls the API body.
```

Fast-depth comparison,
 checked with direct Linkup API calls on 2026-07-04:

```text
Query id: kcm-line
Query: "kcm_keyboard/main.qml:57" "Kirigami.Action"
fast: 10 results, 10 Grokipedia-related, 0 selected KDE or Qt hosts
standard: 2 results, 0 Grokipedia-related, 2 selected KDE or Qt hosts

Query id: numlock-protected
Query: "Cannot install element 'NumLockState' into protected module 'org.kde.plasma.private.kcm_keyboard'"
fast: 10 results, 6 Grokipedia-related, 4 selected KDE or Qt hosts
standard: 10 results, 6 Grokipedia-related, 4 selected KDE or Qt hosts

Query id: bugsite-or
Query: site:bugs.kde.org "kcm_keyboard/main.qml:57:63" OR "configureLayoutsAction"
fast: 10 results, 7 Grokipedia-related, 3 selected KDE or Qt hosts
standard: 10 results, 7 Grokipedia-related, 3 selected KDE or Qt hosts

Query id: protected-module
Query: "Cannot install element" "org.kde.plasma.private.kcm_keyboard"
fast: 10 results, 5 Grokipedia-related, 3 selected KDE or Qt hosts
standard: 10 results, 8 Grokipedia-related, 1 selected KDE or Qt host

Query id: qtbug
Query: QTBUG-144092 Kirigami Cannot assign object of type Kirigami.Action Action_QMLTYPE_0
fast: 10 results, 0 Grokipedia-related, 6 selected KDE or Qt hosts
standard: 10 results, 0 Grokipedia-related, 5 selected KDE or Qt hosts
standard ranked `Action QML Type | Kirigami` first, while fast ranked LinkedIn first.

Query id: bazzite
Query: Bazzite documentation update system ujust update
fast: 10 results, 0 Grokipedia-related, 6 selected Bazzite or code-host results
standard: 10 results, 0 Grokipedia-related, 6 selected Bazzite or code-host results
```

Result:

- `fast` is not a reliable fix for the Grokipedia problem.
- `fast` is sometimes worse,
   sometimes equal,
   and sometimes better on the same failure family.
- A fixed `standard` to `fast` swap would trade one ranking failure mode for another.

Exa comparison,
 checked with the same query set on 2026-07-04:

```text
Configuration: Exa `/search` with type `auto` and `fast`, `numResults: 10`,
and the current Pi blocklist after dropping the invalid Exa entry `gov`.
Linkup comparison used `/v1/search`, `depth: "standard"`, and the same valid blocklist.

Query id: kcm-line
exa-auto: 10 results, 0 Grokipedia-related, 10 selected KDE or Qt hosts
exa-fast: 10 results, 0 Grokipedia-related, 10 selected KDE or Qt hosts
linkup-standard: 0 results

Query id: numlock-protected
exa-auto: 10 results, 0 Grokipedia-related, 9 selected KDE or Qt hosts
exa-fast: 10 results, 0 Grokipedia-related, 9 selected KDE or Qt hosts
linkup-standard: 10 results, 10 Grokipedia-related before local host filtering

Query id: bugsite-or
exa-auto: 10 results, 0 Grokipedia-related, 10 selected KDE or Qt hosts
exa-fast: 10 results, 0 Grokipedia-related, 10 selected KDE or Qt hosts
linkup-standard: 10 results, 10 Grokipedia-related before local host filtering

Query id: protected-module
exa-auto: 10 results, 0 Grokipedia-related, 6 selected KDE or Qt hosts
exa-fast: 10 results, 0 Grokipedia-related, 5 selected KDE or Qt hosts
linkup-standard: 10 results, 10 Grokipedia-related before local host filtering

Query id: qtbug
exa-auto: 10 results, 0 Grokipedia-related, 6 selected KDE or Qt hosts
exa-fast: 10 results, 0 Grokipedia-related, 6 selected KDE or Qt hosts
linkup-standard: 10 results, 0 Grokipedia-related, 5 selected KDE or Qt hosts

Query id: bazzite
exa-auto: 10 results, 0 Grokipedia-related, 7 selected Bazzite or code-host results
exa-fast: 10 results, 0 Grokipedia-related, 9 selected Bazzite or code-host results
linkup-standard: 10 results, 0 Grokipedia-related, 8 selected Bazzite or code-host results
```

Exa result:

- Exa was materially better on this failure set.
- Exa had zero Grokipedia-related results across the sampled query set.
- Exa respected the valid host blocklist in the sampled result URLs.
- Exa rejects the existing bare `gov` blocklist entry with `Domain must include a top-level domain: gov`.
  A migration must either remove that entry,
   represent it with a separate local suffix filter,
  or keep local post-filtering for top-level-domain policies.

Public duplicate or known-issue search:

```text
gh repo list LinkupPlatform --limit 50 --json name,isPrivate,hasIssuesEnabled,url
```

The LinkupPlatform organization has public repositories with issues enabled.
Searches for `Linkup irrelevant results`,
 `Linkup search relevance`,
 and `Grokipedia` across open and closed
LinkupPlatform issues returned no matching public issue.
Linkup Discord and support channels were not checked.

## Verified workarounds

### Keep the local host filter

Pi's local post-response filter is necessary because transcript raw responses contained blocked host URLs.
It is a defense in depth layer after Linkup's own `excludeDomains` handling.

Tradeoff:

- It removes only exact blocked hosts and subdomains.
- It intentionally does not remove pages on other hosts that mention the blocked site.

### Use `includeDomains` for source-specific debugging

For bug searches,
 constrain the search to sources like `bugs.kde.org`,
 `invent.kde.org`,
 `discuss.kde.org`,
or `bugreports.qt.io`.

Tradeoff:

- It avoids SEO-heavy unrelated clusters.
- It can miss useful reports outside the allow-list.

### Add a URL or content filter only if the requirement is topic blocking

If future Pi behavior must hide every result about Grokipedia,
 not just Grokipedia-hosted pages,
the current host blocklist is the wrong abstraction.
A consumer-side URL or title/content deny filter would be needed.

Tradeoff:

- It can hide useful third-party criticism or analysis about the blocked site.
- It requires a separate policy from host safety filtering.

## What does not work

### Assuming the AI searched Grokipedia

The transcript queries do not contain `grok` or `gork`.
The Grokipedia entries came from Linkup result payloads.

### Treating the host blocklist as a topic blocklist

Blocking `grokipedia.com` does not block `en.wikipedia.org/wiki/Grokipedia`,
 NBC News reporting about Grokipedia,
or other third-party pages whose hosts are not blocked.

### Relying on broad unscoped technical snippets

Bare snippets such as `"Cannot install element" "org.kde.plasma.private.kcm_keyboard"` can fall into broad
agentic retrieval.
Constrain domains or add explicit source instructions for bug-tracker searches.

### Switching the fixed depth to `fast`

A direct `fast` versus `standard` comparison did not show `fast` is consistently better.
For the exact `kcm_keyboard/main.qml:57` query,
`fast` returned only Grokipedia-related results in the sampled top results,
while `standard` returned GitHub code-search pages.
For the `protected-module` query,
`fast` had fewer Grokipedia-related results than `standard`,
but it was not enough to justify making every Pi search use `fast`.

### Passing the current blocklist directly to Exa

Exa rejects the bare `gov` entry in the current Pi blocklist because its `excludeDomains` parameter requires entries
with a top-level domain.
A direct Exa migration needs a separate local filter for bare public-suffix policies,
or the config schema needs to distinguish API-forwardable host filters from local-only suffix filters.

## Upstream filing artifact

### Upstream filing decision

Out-of-scope check:

- `grep` over `.out-of-scope/**` for `linkup`,
   `grokipedia`,
   `search api`,
   and `web search` found no matching exemption.

Duplicate search:

- Public GitHub issue searches in LinkupPlatform repositories for `Linkup irrelevant results`,
  `Linkup search relevance`,
   and `Grokipedia` returned no matching open or closed issue.

Constraint check:

- Is it really upstream's fault?
  Partly yes.
  The raw Linkup response can contain irrelevant Grokipedia-family results for unrelated KDE technical queries.
  The remaining third-party pages about Grokipedia are not a Pi host-filter bug.
- Can upstream fix it?
  Likely yes for result ranking and `excludeDomains` reliability,
  but the backend source is not public.
- Are they supporting this use case?
  Yes.
  Linkup documents `/search` as retrieving web content,
  and documents `includeDomains` and `excludeDomains` source control.
- Would the repo welcome our contribution?
  No patch path was found for the hosted search backend.
  Public repositories exist for SDKs,
   MCP,
   CLI,
   skills,
   and benchmarks,
  but not the proprietary search ranking service.
- Will they likely fix it?
  Unknown.
  No public matching issue was found,
  and support or Discord were not contacted.
- Have we prototyped a minimal fix compatible with their architecture?
  No.
  The backend is not public.
  The consumer-side host-filter workaround already exists in Pi,
  and a topic-filter improvement would be a Pi product decision rather than an upstream fix.

Decision:

- Do not file a GitHub issue as-is.
  There is no public repository that appears to own the Linkup search backend.
  A support ticket or Discord report would be the appropriate upstream channel
  if we want to report the reproducible queries.

Draft support report,
 do not file as-is:

~~~md
Title: `/v1/search` returns Grokipedia clusters for unrelated KDE technical error queries

Hi Linkup team,

I saw `/v1/search` return Grokipedia-related result clusters for unrelated KDE or Qt error queries.
This happened through a Pi integration using `depth: "standard"` and `outputType: "searchResults"`.

Reproduction query:

```text
"Cannot install element" "org.kde.plasma.private.kcm_keyboard"
```

Example request shape:

```json
{
  "q": "\"Cannot install element\" \"org.kde.plasma.private.kcm_keyboard\"",
  "depth": "standard",
  "outputType": "searchResults",
  "maxResults": 5
}
```

Observed result class:

- Result sets can include Grokipedia-family pages or pages about Grokipedia.
- In one Pi transcript, unrelated KDE searches returned raw results containing `grokipedia.com`, `grokxpedia.us`,
  `thegrokipedias.com`, and third-party Grokipedia articles.
- The integration's local host filter removed blocked hosts,
  but pages about Grokipedia on other hosts remained visible.

Expected:

- Exact KDE or Qt error snippets should prioritize KDE Bugzilla, KDE Invent, Qt Bug Tracker,
  distribution bug trackers, and technical discussion pages.
- If `excludeDomains` contains `grokipedia.com` and related hosts,
  those hosts should not appear in raw results.

Workaround:

- Restricting `includeDomains` to sources such as `bugs.kde.org`, `invent.kde.org`,
  `discuss.kde.org`, and `bugreports.qt.io` avoids the Grokipedia cluster,
  but loses recall outside the allow-list.

Thanks.
~~~
