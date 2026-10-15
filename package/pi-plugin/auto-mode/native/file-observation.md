# Synchronous selected-file observations

## Consumer boundary

`contract/lifecycle/external-dependency-controls/file-observer.mjs`
(renamed to `file-observer.ts` on 2026-10-15)
returns completed bytes and closes its descriptor before returning to the caller.
`contract/collector/host-governing-policy/selection.mjs`
uses those bytes directly during `capture` and `assertCurrent`.
`contract/lifecycle/native-text-read-contract/dependencies.mjs`
checks the original signal and deadline around observation,
then consumes the result in synchronous `prepare`,
`finalize`,
and `checkRetained` operations.
Replacing only the observer with an asynchronous API would change those contracts.

The file observer bounds allocation by the declared maximum plus one byte,
rejects symbolic links within the selected root,
compares descriptor and selected-path identity before and after reading,
and checks the completed byte count.
This does not establish a filesystem transaction or prevent other processes from writing.
It avoids introducing a JavaScript suspension inside the existing freshness operation.

## Scoped lint exceptions

`package/oxlint-plugin/no-restricted-syntax/src/rule/no-sync.ts`
reports each recognized Node synchronous call.
Its `meta` declares no options schema;
its visitor passes every recognized call directly to `context.report`.
The classifier in `no-sync.constants.ts` includes `fs` among Node builtins.
There is no supported per-call allow-list to configure.
`package/config/oxlint/src/rule/restriction.ts` enables this rule as an error.
The test-file override in `package/config/oxlint/src/overrides.ts`
does not apply to the production observer.
No configuration or severity is changed.

Local comments retain only the calls needed by this synchronous contract:

- `lstatSync` validates selected paths before returning metadata to the current operation.
- `openSync` opens the descriptor inside the same original observation.
- `readSync` fills the bounded buffer without yielding.
- Both `fstatSync` calls check the original descriptor around that read.
- `closeSync` settles descriptor cleanup before returning a snapshot or throwing its original failure.

The separate relevance-cache directory creation and publication operations now use asynchronous filesystem APIs.
Their refresh consumer awaits them and revalidates policy identity and cancellation after completion.
Those operations do not need these exceptions.

## Verification

`src/native-file-observer.unit.test.ts` loads the built observer and uses disposable directories.
The baseline passes synchronous completed-byte delivery,
short reads,
descriptor closure,
original read-error identity,
ordered read-plus-close failures,
invalid byte counts,
incomplete reads,
byte bounds,
missing paths,
symbolic links,
and traversal rejection.
The baseline receipt is
`${HOME}/temp/agent/pi-native-file-observer-baseline-20261015.log`.

The cleanup refactor replaces `finally` with a lexical descriptor owner.
Its disposer captures close failures before the existing ordered failure check.
The rebuilt observer,
cache store,
cache refresh,
source-freshness work,
approved-dependency integration,
and package type checks pass in
`${HOME}/temp/agent/pi-native-cache-observer-consumer-20261015.log`.

Process-local omission controls remove descriptor closure or the cache's post-await freshness checks
from the built module as it loads.
The committed consumer tests fail in both cases;
hashes confirm the copied artifacts are unchanged.
`${HOME}/temp/agent/pi-tool-call-scope-20261014/cache-observer-omissions.json`
retains the omission result and artifact identities.
The focused source and fixture lint pass has no errors;
its remaining warnings are recorded separately from consumer correctness.
