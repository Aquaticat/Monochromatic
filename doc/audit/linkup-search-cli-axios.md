# linkup-search-cli adoption rejection

Audit date:
 2026-06-24.

## Verdict

Do not adopt `linkup-search-cli` as a repo dependency or scripted integration.

The blocker is unnecessary `axios` usage in the official `linkup-sdk` dependency.
That usage pulls in `form-data` and related HTTP compatibility packages even though the SDK targets Node `>=22.0.0`,
where native `fetch` is available.
For this integration shape,
 the extra HTTP client dependency surface buys little and adds avoidable supply-chain risk.

One-off local CLI use remains a personal-tool choice.
This rejection is about adopting it into repo workflow,
 package dependencies,
 CI,
 or agent automation.

## Evidence

Evidence checked during vetting:

- `linkup-search-cli@1.0.2` depends on `linkup-sdk`.
- `linkup-sdk@3.2.5` declares `axios` in `package.json`.
- Upstream source `LinkupPlatform/linkup-js-sdk/src/linkup-client.ts` imports `axios`,
   creates an axios instance,
  and uses that instance for `/search`,
   `/fetch`,
   `/research`,
   and task calls.
- `axios@1.18.1` declares `form-data` as a runtime dependency.
- The SDK's request pattern is ordinary JSON `GET` and `POST` plus response interception.
  Native `fetch` plus small local helpers can cover that in Node `>=22.0.0` without `axios` or `form-data`.
- The CLI itself already uses native `fetch` directly for its credits check,
  which shows the package does not require axios for every Linkup API boundary.

## Why this matters

`form-data` is not directly used by the Linkup CLI path we want.
It arrives because axios keeps broad Node/browser HTTP compatibility and multipart support in its dependency graph.
That is reasonable for axios as a general-purpose library,
but it is unnecessary for a focused Node `>=22` SDK that sends JSON requests to one API.

The dependency choice matters more than the line count:

- It expands the runtime audit surface beyond Linkup's own code.
- It introduces historical advisory churn from axios and its HTTP compatibility dependencies.
- It weakens the value of adopting a small official CLI,
  because the most security-sensitive boundary,
   API-key-bearing network calls,
   sits behind a broad third-party client.

## Alternatives

Preferred shape if Linkup is needed later:

- Use a small local wrapper around native `fetch`,
   with explicit JSON encoding,
  explicit timeout and abort behavior,
   and typed response validation.
- Keep `LINKUP_API_KEY` handling at the final call boundary.
- Avoid `axios`,
   `form-data`,
   and general-purpose multipart/request compatibility packages
  unless a concrete API path needs them.

## Revisit criteria

Reconsider `linkup-search-cli` or `linkup-sdk` only if one of these changes lands upstream:

- The SDK removes axios and uses native `fetch` for Node `>=22`.
- The SDK isolates axios behind an optional adapter so normal JSON use does not install `form-data`.
- The repo has a documented reason for axios that native `fetch` cannot satisfy for Linkup's supported runtime.
