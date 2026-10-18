# Depot CLI 2.102.23 emits plain text for empty image JSON output

## Symptom

`depot image list --project <owned-project> --output json` emits `No images found`
when the registry returns no images.
That output is not JSON.
The same empty response bypasses rejection of an invalid output format.
This affects registry cleanup automation that expects the requested serialization.

## Root cause

The inspected upstream CLI checkout is `1f96d6d488f938de97ea640b115e9567ebfd6fbf`,
the source for installed version `2.102.23`.
Current upstream `pkg/cmd/image/list.go` also has Git blob
`1b15d0e0b89cc892e8966f082e416faf18386114`.
These are source identities, not a claim that every later CLI release behaves identically.

`pkg/cmd/image/list.go:56` fetches every returned page before dispatching the requested format.
`pkg/cmd/image/list.go:65` returns early when the resulting slice is empty:

```go
// Upstream pkg/cmd/image/list.go:65
if len(images) == 0 {
    fmt.Println("No images found")
    return nil
}
```

`pkg/cmd/image/list.go:70` therefore reaches neither the JSON writer nor the invalid-format error:

```go
// Upstream pkg/cmd/image/list.go:70
switch outputFormat {
case "csv":
    return images.WriteCSV()
case "json":
    return images.WriteJSON()
default:
    return errors.Errorf("unknown format: %s. Requires csv or json", outputFormat)
}
```

The JSON writer at `pkg/cmd/image/list.go:222` encodes the slice with `encoding/json`.
`fetchAllImages` initializes a nil slice at `pkg/cmd/image/list.go:136`.
Removing the early return consequently allows valid JSON `null` for this empty case.
It does not introduce an empty-array contract.
The CSV writer at `pkg/cmd/image/list.go:190` emits its header only for nonempty input,
so the corresponding empty CSV result is an empty stream.

## Verification

The owned-project cleanup observation is retained in
[`depot-native-buildkit-job-auth-2026-10-18.evidence.json`](../audit/depot-native-buildkit-job-auth-2026-10-18.evidence.json).
The public-project API returned the expected missing-project result after deletion;
plain-text empty output from a different image-list state must not be interpreted as an exhaustive listing.

A disposable upstream clone has push URL `DISABLED` and the exact source identity named in `Root cause`.
A bounded local before/after prototype is being prepared with synthetic registry responses,
no Depot credentials,
at most 2 CPU and 2 GiB,
and no cloud allocation.
Its controls must exercise the actual Cobra command,
pagination,
nonempty JSON and CSV,
empty JSON and CSV,
invalid formats,
and an API error.
This paragraph is a pending verification record, not a claim that the patch has passed.

## Verified workarounds

The research collector retained the exact exit status and output instead of parsing this text as JSON.
It used independent project deletion and registry HTTP controls for the cleanup conclusion.
That preserves this incident's evidence but is not a general machine-readable image inventory workaround.
Do not convert arbitrary parse failures into empty image lists.

## What does not work

Passing `--output json` alone does not remove the empty-result guard.
Assuming the existing JSON writer promises `[]` is also incorrect:
the current accumulator begins as a nil slice.
No account-wide inventory or broader credential is needed to diagnose this serialization branch.

## Upstream filing artifact

### Upstream filing decision

1.  Upstream behavior: yes.
    The empty-result return precedes the selected serializer and format validation.
2.  Fixable upstream: yes.
    Removing that return lets the existing writers and error branch execute.
    The local prototype must still establish the resulting behavior.
3.  Supported use case: yes.
    The command exposes `--output` and implements JSON and CSV writers.
4.  Contribution welcome: provisionally yes.
    The upstream README welcomes PR contributions.
    The fresh checkout contains no `CONTRIBUTING`, agent-policy, issue-template,
    PR-template or code-of-conduct filename match.
    The all-state tracker search for `"AI" in:title,body` returned no matches.
    These checks found no AI-assistance ban; they do not prove no policy can exist elsewhere.
5.  Active refusal: none found.
    All-state searches for `"No images found"` and `image list json` returned no issues.
    The inspected path history ends with the Bubble Tea dependency upgrade on `2026-08-17`,
    following the image command's `2025-09-12` introduction.
    Absence of a matching issue or refusal is not a prediction of maintainer acceptance.
6.  Prototype: pending local controlled execution.
    The smallest candidate removes only the early empty-result return.

No upstream issue or PR has been sent.
A local draft will retain the actual prototype evidence before any filing decision.
